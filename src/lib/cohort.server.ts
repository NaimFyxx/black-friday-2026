// Server-only: whole-store sales + new vs returning customers for a period,
// compared with the same number of days right before it. Shared by the
// /admin Customers page and the campaign report so their numbers match.
//
// Shopify orders, EXCEPT the "Odoo Connector" channel (partial copies of Odoo
// POS sales), plus POS from Odoo (Pulse's nightly pos_sync_days).

export type Loose = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

const DAY_MS = 86_400_000;
const n = (v: unknown) => Number(v) || 0;

function isMissing(err: { message: string; code?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    err.code === "42883" ||
    err.code === "PGRST202" ||
    err.code === "PGRST205" ||
    /does not exist|could not find/i.test(err.message)
  );
}

// ── Customer cohort (all Fyxx channels, from the synced Shopify tables) ──

export type ChannelRow = { channel: string; orders: number; revenue: number; customers: number };
export type PeriodStats = {
  orders: number;
  revenue: number;
  aov: number;
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  unknownCustomers: number;
  newRevenue: number;
  returningRevenue: number;
  guestOrders: number;
  channels: ChannelRow[];
  /** Odoo POS coverage: days with data vs days in the period. */
  pos?: { days: number; expectedDays: number };
};

type OrderRow = {
  order_id: string;
  ordered_at: string;
  revenue_jod: number;
  shopify_customer_id: string | null;
  sub_channel: string;
};

/** Shopify source_name of the "Odoo Connector" channel (copies of Odoo POS sales). */
export const ODOO_CONNECTOR_SOURCE = "179433";
const POS_CHANNEL = "POS (Odoo)";

/** Amman calendar day (YYYY-MM-DD) of an instant. */
export const ammanDate = (iso: string) =>
  new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

type OdooPos = { orders: number; revenue: number; days: number; expectedDays: number };

/** Odoo POS totals per Amman day, from Pulse's nightly pos_sync_days (read only). */
async function loadOdooPos(client: Loose, since: string, until: string): Promise<OdooPos> {
  const from = ammanDate(since);
  const to = ammanDate(new Date(new Date(until).getTime() - 1).toISOString()); // until is exclusive
  const { data, error } = await client
    .from("pos_sync_days")
    .select("day, odoo_orders, odoo_total")
    .gte("day", from)
    .lte("day", to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ day: string; odoo_orders: number; odoo_total: number }>;
  const expectedDays = Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS) + 1;
  return {
    orders: rows.reduce((t, r) => t + n(r.odoo_orders), 0),
    revenue: rows.reduce((t, r) => t + n(r.odoo_total), 0),
    days: rows.length,
    expectedDays,
  };
}

/** Add Odoo POS as its own channel and to the order/revenue totals. */
function withPos(stats: PeriodStats, pos: OdooPos): PeriodStats {
  const orders = stats.orders + pos.orders;
  const revenue = stats.revenue + pos.revenue;
  return {
    ...stats,
    orders,
    revenue,
    aov: orders ? revenue / orders : 0,
    channels: [
      ...stats.channels,
      { channel: POS_CHANNEL, orders: pos.orders, revenue: pos.revenue, customers: 0 },
    ].sort((a, b) => b.revenue - a.revenue),
    pos: { days: pos.days, expectedDays: pos.expectedDays },
  };
}

async function loadOrders(client: Loose, since: string, until: string): Promise<OrderRow[]> {
  const out: OrderRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await client
      .from("shopify_orders")
      .select("order_id, ordered_at, revenue_jod, shopify_customer_id, sub_channel")
      .gte("ordered_at", since)
      .lt("ordered_at", until)
      .is("cancelled_at", null)
      // POS sales come from Odoo (see loadOdooPos). Shopify's "Odoo Connector"
      // orders are partial copies of them (only POS sales with a customer), so
      // counting them would double count POS.
      .or(`source_name.is.null,source_name.neq.${ODOO_CONNECTOR_SOURCE}`)
      .order("ordered_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as OrderRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

type FirstOrders = {
  /** Customer ID -> first order timestamp ever (any channel). */
  first: Map<string, string>;
  /** Shared walk-in "house" accounts: not real people, not counted. */
  house: Set<string>;
  /** "orders" = exact, from the full order history (bf_first_order_dates).
   *  "customers_table" = fallback from shopify_customers, which may be stale. */
  source: "orders" | "customers_table";
};

async function loadFirstOrders(client: Loose, ids: string[]): Promise<FirstOrders> {
  const first = new Map<string, string>();
  const house = new Set<string>();
  let source: FirstOrders["source"] = "orders";

  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { data, error } = await client.rpc("bf_first_order_dates", { p_customer_ids: chunk });
    if (isMissing(error)) {
      source = "customers_table";
      break;
    }
    if (error) throw new Error(error.message);
    for (const r of (data as Array<{
      shopify_customer_id: string;
      first_order_at: string;
    }> | null) ?? []) {
      first.set(r.shopify_customer_id, r.first_order_at);
    }
  }

  // House-account flags (and the fallback first-order dates) from shopify_customers.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await client
      .from("shopify_customers")
      .select("shopify_customer_id, first_order_date, is_house_account")
      .in("shopify_customer_id", chunk);
    if (error) throw new Error(error.message);
    for (const c of (data ?? []) as Array<{
      shopify_customer_id: string;
      first_order_date: string | null;
      is_house_account: boolean;
    }>) {
      if (c.is_house_account) house.add(c.shopify_customer_id);
      if (source === "customers_table" && c.first_order_date) {
        first.set(c.shopify_customer_id, c.first_order_date);
      }
    }
  }
  return { first, house, source };
}

function summarize(orders: OrderRow[], fo: FirstOrders, since: string): PeriodStats {
  const sinceMs = new Date(since).getTime();
  const channels = new Map<string, ChannelRow & { ids: Set<string> }>();
  const customerRevenue = new Map<string, number>();
  let revenue = 0;
  let guestOrders = 0;

  for (const o of orders) {
    const rev = n(o.revenue_jod);
    revenue += rev;
    const ch = channels.get(o.sub_channel) ?? {
      channel: o.sub_channel,
      orders: 0,
      revenue: 0,
      customers: 0,
      ids: new Set<string>(),
    };
    ch.orders += 1;
    ch.revenue += rev;
    const id = o.shopify_customer_id;
    if (id && !fo.house.has(id)) {
      ch.ids.add(id);
      customerRevenue.set(id, (customerRevenue.get(id) ?? 0) + rev);
    } else {
      guestOrders += 1;
    }
    channels.set(o.sub_channel, ch);
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  let unknownCustomers = 0;
  let newRevenue = 0;
  let returningRevenue = 0;
  for (const [id, rev] of customerRevenue) {
    const first = fo.first.get(id);
    if (first == null) {
      unknownCustomers += 1; // only possible on the stale fallback
    } else if (new Date(first).getTime() >= sinceMs) {
      newCustomers += 1;
      newRevenue += rev;
    } else {
      returningCustomers += 1;
      returningRevenue += rev;
    }
  }

  return {
    orders: orders.length,
    revenue,
    aov: orders.length ? revenue / orders.length : 0,
    customers: customerRevenue.size,
    newCustomers,
    returningCustomers,
    unknownCustomers,
    newRevenue,
    returningRevenue,
    guestOrders,
    channels: [...channels.values()]
      .map(({ ids, ...c }) => ({ ...c, customers: ids.size }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export async function computeCohort(client: Loose, range: { since: string; until: string }) {
  // Compare with the same number of days right before the range.
  const len = new Date(range.until).getTime() - new Date(range.since).getTime();
  const prevSince = new Date(new Date(range.since).getTime() - len).toISOString();

  try {
    const [current, previous, posNow, posBefore] = await Promise.all([
      loadOrders(client, range.since, range.until),
      loadOrders(client, prevSince, range.since),
      loadOdooPos(client, range.since, range.until),
      loadOdooPos(client, prevSince, range.since),
    ]);
    const ids = [
      ...new Set(
        [...current, ...previous].map((o) => o.shopify_customer_id).filter((v): v is string => !!v),
      ),
    ];
    const firstOrders = await loadFirstOrders(client, ids);

    // Last time the order sync wrote anything, so stale data is obvious.
    const { data: latest } = await client
      .from("shopify_orders")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1);

    return {
      status: "ok" as const,
      range,
      previousRange: { since: prevSince, until: range.since },
      current: withPos(summarize(current, firstOrders, range.since), posNow),
      previous: withPos(summarize(previous, firstOrders, prevSince), posBefore),
      firstOrderSource: firstOrders.source,
      syncedAt: (latest as Array<{ synced_at: string }> | null)?.[0]?.synced_at ?? null,
    };
  } catch (e) {
    return {
      status: "error" as const,
      message: e instanceof Error ? e.message : String(e),
      range,
    };
  }
}
