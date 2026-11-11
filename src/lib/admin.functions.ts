// Admin server functions for the /admin dashboards. Every data function calls
// assertAdmin() first: these are callable over HTTP, so hiding the UI is not
// enough. Reads use the service-role client (the bf_* tables have no public
// policies).
//
// Pages degrade gracefully: if a table / function hasn't been created yet, or
// a secret is missing, the result says so ("setup") instead of throwing.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CAMPAIGN_END, CAMPAIGN_START } from "@/lib/campaign-config";

// ── Auth ──────────────────────────────────────────────────────────────

export const adminSignIn = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { signIn } = await import("./admin-session.server");
    return { result: await signIn(data.password) };
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { signOut } = await import("./admin-session.server");
  await signOut();
  return { ok: true };
});

export const checkAdminAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("./admin-session.server");
  return { isAdmin: await isAdmin() };
});

// ── Shared ────────────────────────────────────────────────────────────

const MAX_RANGE_DAYS = 120;
const DAY_MS = 86_400_000;

const RangeInput = z
  .object({
    since: z.string().datetime({ offset: true }),
    until: z.string().datetime({ offset: true }),
  })
  .partial()
  .optional()
  .transform((r) => {
    const since = new Date(r?.since ?? CAMPAIGN_START);
    const until = new Date(r?.until ?? CAMPAIGN_END);
    if (!(since < until)) throw new Error("Invalid range");
    if (until.getTime() - since.getTime() > MAX_RANGE_DAYS * DAY_MS)
      throw new Error("Range too long");
    return { since: since.toISOString(), until: until.toISOString() };
  });

type Loose = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

async function db(): Promise<Loose> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Loose;
}

/** True when Postgres/PostgREST says the table or function does not exist. */
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

const n = (v: unknown) => Number(v) || 0;
const key = (...parts: Array<string | null | undefined>) =>
  parts.map((p) => p ?? "").join("\u0001");

// ── Sources breakdown ─────────────────────────────────────────────────

export type SourceRow = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  sessions: number;
  product_views: number;
  cart_sessions: number;
  checkout_sessions: number;
  orders: number;
  revenue: number;
  new_customers: number;
};

export const getSources = createServerFn({ method: "GET" })
  .validator((d: unknown) => RangeInput.parse(d))
  .handler(async ({ data: range }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { fetchSiteOrders } = await import("./shopify-admin.server");

    const client = await db();
    const [funnel, shop] = await Promise.all([
      client.rpc("bf_source_funnel", { p_since: range.since, p_until: range.until }),
      fetchSiteOrders(range.since, range.until),
    ]);

    const rows = new Map<string, SourceRow>();
    const row = (s: string | null, m: string | null, c: string | null) => {
      const k = key(s, m, c);
      let r = rows.get(k);
      if (!r) {
        r = {
          utm_source: s,
          utm_medium: m,
          utm_campaign: c,
          sessions: 0,
          product_views: 0,
          cart_sessions: 0,
          checkout_sessions: 0,
          orders: 0,
          revenue: 0,
          new_customers: 0,
        };
        rows.set(k, r);
      }
      return r;
    };

    const eventsMissing = isMissing(funnel.error);
    type FunnelRow = {
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      sessions: number | string;
      product_views: number | string;
      cart_sessions: number | string;
      checkout_sessions: number | string;
    };
    for (const f of (funnel.data as FunnelRow[] | null) ?? []) {
      const r = row(f.utm_source ?? null, f.utm_medium ?? null, f.utm_campaign ?? null);
      r.sessions += n(f.sessions);
      r.product_views += n(f.product_views);
      r.cart_sessions += n(f.cart_sessions);
      r.checkout_sessions += n(f.checkout_sessions);
    }

    let currency = "JOD";
    if (shop.status === "ok") {
      for (const o of shop.orders) {
        if (o.cancelled) continue;
        currency = o.currency;
        const r = row(o.utm_source, o.utm_medium, o.utm_campaign);
        r.orders += 1;
        r.revenue += o.total;
        if (o.isFirstOrder) r.new_customers += 1;
      }
    }

    const list = [...rows.values()].sort(
      (a, b) => b.revenue - a.revenue || b.sessions - a.sessions,
    );
    const totals = list.reduce(
      (t, r) => {
        t.sessions += r.sessions;
        t.product_views += r.product_views;
        t.cart_sessions += r.cart_sessions;
        t.checkout_sessions += r.checkout_sessions;
        t.orders += r.orders;
        t.revenue += r.revenue;
        t.new_customers += r.new_customers;
        return t;
      },
      {
        sessions: 0,
        product_views: 0,
        cart_sessions: 0,
        checkout_sessions: 0,
        orders: 0,
        revenue: 0,
        new_customers: 0,
      },
    );

    return {
      range,
      currency,
      rows: list,
      totals,
      setup: {
        events: eventsMissing ? "missing" : funnel.error ? "error" : "ok",
        eventsError: !eventsMissing && funnel.error ? funnel.error.message : null,
        shopify: shop.status,
        shopifyError: shop.status === "error" ? shop.message : null,
      },
    };
  });

// ── Activity over time ────────────────────────────────────────────────

export type ActivityDay = {
  day: string; // YYYY-MM-DD (Amman)
  visits: number;
  product_views: number;
  carts: number;
  checkouts: number;
  orders: number;
  revenue: number;
};

export const getActivity = createServerFn({ method: "GET" })
  .validator((d: unknown) => RangeInput.parse(d))
  .handler(async ({ data: range }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { fetchSiteOrders } = await import("./shopify-admin.server");

    const client = await db();
    const [daily, shop] = await Promise.all([
      client.rpc("bf_activity_daily", { p_since: range.since, p_until: range.until }),
      fetchSiteOrders(range.since, range.until),
    ]);

    // Pre-fill every day so the chart has no gaps.
    const days = new Map<string, ActivityDay>();
    const ammanDay = (iso: string) =>
      new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
    for (
      let t = new Date(range.since).getTime();
      t < new Date(range.until).getTime();
      t += DAY_MS
    ) {
      const d = ammanDay(new Date(t).toISOString());
      days.set(d, {
        day: d,
        visits: 0,
        product_views: 0,
        carts: 0,
        checkouts: 0,
        orders: 0,
        revenue: 0,
      });
    }
    const get = (d: string) => {
      let r = days.get(d);
      if (!r) {
        r = { day: d, visits: 0, product_views: 0, carts: 0, checkouts: 0, orders: 0, revenue: 0 };
        days.set(d, r);
      }
      return r;
    };

    type DailyRow = {
      day: string;
      visits: number | string;
      product_views: number | string;
      carts: number | string;
      checkouts: number | string;
    };
    for (const r of (daily.data as DailyRow[] | null) ?? []) {
      const d = get(String(r.day).slice(0, 10));
      d.visits = n(r.visits);
      d.product_views = n(r.product_views);
      d.carts = n(r.carts);
      d.checkouts = n(r.checkouts);
    }
    let currency = "JOD";
    if (shop.status === "ok") {
      for (const o of shop.orders) {
        if (o.cancelled) continue;
        currency = o.currency;
        const d = get(ammanDay(o.createdAt));
        d.orders += 1;
        d.revenue += o.total;
      }
    }

    const eventsMissing = isMissing(daily.error);
    return {
      range,
      currency,
      days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      setup: {
        events: eventsMissing ? "missing" : daily.error ? "error" : "ok",
        eventsError: !eventsMissing && daily.error ? daily.error.message : null,
        shopify: shop.status,
        shopifyError: shop.status === "error" ? shop.message : null,
      },
    };
  });

// ── Error log ─────────────────────────────────────────────────────────

export type ErrorRow = {
  id: string;
  created_at: string;
  area: string;
  message: string;
  path: string | null;
  user_agent: string | null;
};

export const getErrorLog = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const client = await db();

  const recent = await client
    .from("bf_error_log")
    .select("id, created_at, area, message, path, user_agent")
    .order("created_at", { ascending: false })
    .limit(100);
  if (isMissing(recent.error))
    return { setup: "missing" as const, rows: [], summary: [], total24h: 0, total7d: 0 };

  const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const since24h = Date.now() - DAY_MS;
  const week = await client
    .from("bf_error_log")
    .select("area, created_at")
    .gte("created_at", since7d)
    .limit(5000);

  const byArea = new Map<string, { area: string; count_24h: number; count_7d: number }>();
  for (const r of (week.data as Array<{ area: string; created_at: string }> | null) ?? []) {
    const a = byArea.get(r.area) ?? { area: r.area, count_24h: 0, count_7d: 0 };
    a.count_7d += 1;
    if (new Date(r.created_at).getTime() >= since24h) a.count_24h += 1;
    byArea.set(r.area, a);
  }
  const summary = [...byArea.values()].sort((a, b) => b.count_7d - a.count_7d);

  return {
    setup: "ok" as const,
    rows: (recent.data ?? []) as ErrorRow[],
    summary,
    total24h: summary.reduce((t, a) => t + a.count_24h, 0),
    total7d: summary.reduce((t, a) => t + a.count_7d, 0),
  };
});

// ── Customer cohort (all Fyxx channels, from the synced Shopify tables) ──

type ChannelRow = { channel: string; orders: number; revenue: number; customers: number };
type PeriodStats = {
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
};

type OrderRow = {
  order_id: string;
  ordered_at: string;
  revenue_jod: number;
  shopify_customer_id: string | null;
  sub_channel: string;
};

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

export const getCohort = createServerFn({ method: "GET" })
  .validator((d: unknown) => RangeInput.parse(d))
  .handler(async ({ data: range }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const client = await db();

    // Compare with the same number of days right before the range.
    const len = new Date(range.until).getTime() - new Date(range.since).getTime();
    const prevSince = new Date(new Date(range.since).getTime() - len).toISOString();

    try {
      const [current, previous] = await Promise.all([
        loadOrders(client, range.since, range.until),
        loadOrders(client, prevSince, range.since),
      ]);
      const ids = [
        ...new Set(
          [...current, ...previous]
            .map((o) => o.shopify_customer_id)
            .filter((v): v is string => !!v),
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
        current: summarize(current, firstOrders, range.since),
        previous: summarize(previous, firstOrders, prevSince),
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
  });
