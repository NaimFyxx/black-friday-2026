// Server-only: builds the one-click Black Friday campaign report.
//
// Every section is gathered independently; a section that can't be built
// (missing secret, source not synced yet...) says why instead of breaking the
// report. Sources, all read only:
//   store      whole-store sales (cohort.server: Shopify minus Odoo Connector,
//              plus Odoo POS), vs the same number of days before
//   marketing  Pulse's marketing-influence attribution (mkt_influence_orders,
//              unlocked read-only for the service role on 16 Nov 2026),
//              Odoo Connector orders left out
//   klaviyo    Pulse's klaviyo_campaigns (emails / SMS sent in the period)
//   meta       Meta Ads campaign results via bf-admin (BLACK_FRIDAY_META_TOKEN)
//   site       the Black Friday site's own funnel + Shopify orders by source
//   products   which products were viewed / added to cart / reached checkout
//   summary    plain-English summary by Lovable's AI gateway (via bf-admin)

import { callBfAdmin } from "./bf-edge.server";
import { CAMPAIGN_END, CAMPAIGN_START } from "./campaign-config";
import { ammanDate, computeCohort, ODOO_CONNECTOR_SOURCE, type Loose } from "./cohort.server";
import { fetchSiteOrders } from "./shopify-admin.server";
import { normalizeSource } from "./source-labels";

/** 1 USD in JOD (the JOD is pegged to the dollar). */
export const USD_TO_JOD = 0.709;
const DAY_MS = 86_400_000;
const n = (v: unknown) => Number(v) || 0;

type Range = { since: string; until: string };
type Section<T> = { status: "ok"; data: T } | { status: "unavailable"; reason: string };

const ok = <T>(data: T): Section<T> => ({ status: "ok", data });
const unavailable = (reason: string): Section<never> => ({ status: "unavailable", reason });
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Amman calendar days covered by [since, until). */
function days(r: Range) {
  return {
    from: ammanDate(r.since),
    to: ammanDate(new Date(new Date(r.until).getTime() - 1).toISOString()),
  };
}

function previousOf(r: Range): Range {
  const len = new Date(r.until).getTime() - new Date(r.since).getTime();
  return { since: new Date(new Date(r.since).getTime() - len).toISOString(), until: r.since };
}

// ── Marketing influence (Pulse) ───────────────────────────────────────

type InfluenceRow = {
  order_id: string;
  channel: string;
  net_jod: number;
  influenced: boolean;
  main_reason: string | null;
  klaviyo_message: string | null;
  codes_counted: string[] | null;
  code_programmes: string[] | null;
  ga_source: string | null;
  ga_medium: string | null;
  visit_source: string | null;
  visit_medium: string | null;
};

async function loadInfluence(client: Loose, r: Range): Promise<InfluenceRow[]> {
  const d = days(r);
  const out: InfluenceRow[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 50_000; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .rpc("mkt_influence_orders", { p_from: d.from, p_to: d.to })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as InfluenceRow[]));
    if (!data || data.length < PAGE) break;
  }
  // POS comes from Odoo; the Odoo Connector orders in Shopify are copies.
  return out.filter((o) => o.channel !== "Odoo Connector");
}

type Bucket = { name: string; orders: number; revenue: number };
function topBuckets(
  rows: InfluenceRow[],
  keyOf: (r: InfluenceRow) => string[] | string | null,
  limit = 10,
): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const r of rows) {
    const k = keyOf(r);
    const keys = Array.isArray(k) ? k : k ? [k] : [];
    for (const name of keys) {
      const b = m.get(name) ?? { name, orders: 0, revenue: 0 };
      b.orders += 1;
      b.revenue += n(r.net_jod);
      m.set(name, b);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

function influenceSummary(rows: InfluenceRow[]) {
  const infl = rows.filter((r) => r.influenced);
  const sum = (rs: InfluenceRow[]) => rs.reduce((t, r) => t + n(r.net_jod), 0);
  return {
    orders: rows.length,
    revenue: sum(rows),
    influencedOrders: infl.length,
    influencedRevenue: sum(infl),
    byReason: topBuckets(infl, (r) => r.main_reason ?? "Other", 12),
    byChannel: topBuckets(rows, (r) => r.channel, 12),
    topKlaviyoMessages: topBuckets(infl, (r) => r.klaviyo_message, 10),
    // Grouped by programme (one-off personal codes like FR-PO15-XXXX roll up),
    // falling back to the code itself when Pulse has no programme for it.
    topCodes: topBuckets(
      infl,
      (r) => {
        const progs = [...new Set((r.code_programmes ?? []).filter(Boolean))];
        return progs.length ? progs : (r.codes_counted ?? []);
      },
      10,
    ),
    topGaSources: topBuckets(
      infl,
      (r) =>
        r.ga_source
          ? `${r.ga_source.toLowerCase()} / ${(r.ga_medium ?? "(none)").toLowerCase()}`
          : null,
      10,
    ),
  };
}

// ── Klaviyo campaigns (Pulse) ─────────────────────────────────────────

async function loadKlaviyo(client: Loose, r: Range) {
  const d = days(r);
  const { data, error } = await client
    .from("klaviyo_campaigns")
    .select(
      "name, sent_on, send_channel, sent, delivered, opened, clicked, open_rate, click_rate, orders, revenue_jod, unsubscribes",
    )
    .gte("sent_on", d.from)
    .lte("sent_on", d.to)
    .order("sent_on", { ascending: true });
  if (error) throw new Error(error.message);
  type KRow = {
    name: string | null;
    sent_on: string | null;
    send_channel: string | null;
    sent: number | null;
    open_rate: number | null;
    click_rate: number | null;
    orders: number | null;
    revenue_jod: number | null;
    unsubscribes: number | null;
  };
  const rows = (data ?? []) as KRow[];
  const list = rows.map((c) => ({
    name: String(c.name ?? ""),
    sentOn: String(c.sent_on ?? ""),
    channel: String(c.send_channel ?? ""),
    sent: n(c.sent),
    openRate: n(c.open_rate),
    clickRate: n(c.click_rate),
    orders: n(c.orders),
    revenue: n(c.revenue_jod),
    unsubscribes: n(c.unsubscribes),
  }));
  return {
    campaigns: list,
    totals: {
      sends: list.length,
      recipients: list.reduce((t, c) => t + c.sent, 0),
      orders: list.reduce((t, c) => t + c.orders, 0),
      revenue: list.reduce((t, c) => t + c.revenue, 0),
    },
  };
}

// ── Meta Ads (via bf-admin) ───────────────────────────────────────────

type MetaCampaign = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
};

async function loadMeta(r: Range) {
  const d = days(r);
  const res = await callBfAdmin<
    | { status: "ok"; currency: string; campaigns: MetaCampaign[] }
    | { status: "not_configured" }
    | { status: "error"; message: string }
  >({ action: "meta", since: d.from, until: d.to });
  if (res.status === "not_configured") {
    throw new Error("Meta key not saved yet (secret BLACK_FRIDAY_META_TOKEN).");
  }
  if (res.status === "error") throw new Error(res.message);
  const toJod = res.currency === "JOD" ? 1 : res.currency === "USD" ? USD_TO_JOD : NaN;
  const camps = res.campaigns.filter((c) => c.spend > 0 || c.purchases > 0);
  const spend = camps.reduce((t, c) => t + c.spend, 0);
  const value = camps.reduce((t, c) => t + c.purchase_value, 0);
  return {
    currency: res.currency,
    spend,
    spendJod: Number.isFinite(toJod) ? spend * toJod : null,
    purchases: camps.reduce((t, c) => t + c.purchases, 0),
    purchaseValue: value,
    purchaseValueJod: Number.isFinite(toJod) ? value * toJod : null,
    clicks: camps.reduce((t, c) => t + c.clicks, 0),
    impressions: camps.reduce((t, c) => t + c.impressions, 0),
    roas: spend > 0 ? value / spend : null,
    campaigns: camps
      .map((c) => ({ ...c, roas: c.spend > 0 ? c.purchase_value / c.spend : null }))
      .sort((a, b) => b.spend - a.spend),
  };
}

// ── The Black Friday site ─────────────────────────────────────────────

async function loadSite(client: Loose, r: Range) {
  const [funnel, shop] = await Promise.all([
    client.rpc("bf_source_funnel", { p_since: r.since, p_until: r.until }),
    fetchSiteOrders(r.since, r.until),
  ]);
  if (funnel.error) throw new Error(funnel.error.message);
  type Row = {
    source: string;
    visits: number;
    carts: number;
    checkouts: number;
    orders: number;
    revenue: number;
    newCustomers: number;
  };
  const rows = new Map<string, Row>();
  const row = (src: string | null, m: string | null, c: string | null) => {
    const s = normalizeSource(src);
    const k = [s ?? "(direct / none)", m, c].filter(Boolean).join(" / ");
    const x = rows.get(k) ?? {
      source: k,
      visits: 0,
      carts: 0,
      checkouts: 0,
      orders: 0,
      revenue: 0,
      newCustomers: 0,
    };
    rows.set(k, x);
    return x;
  };
  type FRow = {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    sessions: number | string;
    cart_sessions: number | string;
    checkout_sessions: number | string;
  };
  for (const f of (funnel.data as FRow[] | null) ?? []) {
    const x = row(f.utm_source, f.utm_medium, f.utm_campaign);
    x.visits += n(f.sessions);
    x.carts += n(f.cart_sessions);
    x.checkouts += n(f.checkout_sessions);
  }
  if (shop.status === "ok") {
    for (const o of shop.orders) {
      if (o.cancelled) continue;
      const x = row(o.utm_source, o.utm_medium, o.utm_campaign);
      x.orders += 1;
      x.revenue += o.total;
      if (o.isFirstOrder) x.newCustomers += 1;
    }
  }
  const list = [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
  const sum = (k: keyof Omit<Row, "source">) => list.reduce((t, x) => t + x[k], 0);
  return {
    totals: {
      visits: sum("visits"),
      carts: sum("carts"),
      checkouts: sum("checkouts"),
      orders: sum("orders"),
      revenue: sum("revenue"),
      newCustomers: sum("newCustomers"),
    },
    sources: list.slice(0, 15),
    ordersNote:
      shop.status === "ok"
        ? null
        : shop.status === "not_configured"
          ? "Shopify orders not connected"
          : `Shopify orders unavailable: ${shop.message}`,
  };
}

// ── Products (from the site's event log) ──────────────────────────────

async function loadProducts(client: Loose, r: Range) {
  type Ev = {
    event: string;
    variant_id: string | null;
    product_title: string | null;
    items: Array<{ variant_id: string; title: string; qty: number }> | null;
  };
  const evs: Ev[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await client
      .from("bf_events")
      .select("event, variant_id, product_title, items")
      .in("event", ["view_item", "add_to_cart", "begin_checkout"])
      .eq("internal", false) // the team's own visits don't count
      .gte("created_at", r.since)
      .lt("created_at", r.until)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    evs.push(...((data ?? []) as Ev[]));
    if (!data || data.length < PAGE) break;
  }
  type P = { title: string; views: number; carts: number; checkoutUnits: number };
  const m = new Map<string, P>();
  const get = (id: string, title: string) => {
    const p = m.get(id) ?? { title, views: 0, carts: 0, checkoutUnits: 0 };
    if (!p.title && title) p.title = title;
    m.set(id, p);
    return p;
  };
  for (const e of evs) {
    if (e.event === "begin_checkout") {
      for (const i of e.items ?? []) get(i.variant_id, i.title).checkoutUnits += n(i.qty);
    } else if (e.variant_id) {
      const p = get(e.variant_id, e.product_title ?? "");
      if (e.event === "view_item") p.views += 1;
      else p.carts += 1;
    }
  }
  const all = [...m.values()];
  return {
    tracked: all.length > 0,
    mostAdded: [...all].sort((a, b) => b.carts - a.carts || b.views - a.views).slice(0, 10),
    mostViewed: [...all].sort((a, b) => b.views - a.views).slice(0, 10),
    // Popular but not converting: at least 10 views, fewest adds per view.
    viewedNotAdded: all
      .filter((p) => p.views >= 10)
      .map((p) => ({ ...p, addRate: p.carts / p.views }))
      .sort((a, b) => a.addRate - b.addRate)
      .slice(0, 10),
  };
}

// ── The report ────────────────────────────────────────────────────────

async function section<T>(fn: () => Promise<T>): Promise<Section<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return unavailable(errText(e));
  }
}

type PeriodLike = {
  orders: number;
  revenue: number;
  aov: number;
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  channels: Array<{ channel: string; orders: number; revenue: number }>;
  pos?: { days: number; expectedDays: number } | undefined;
};

type ReportCore = {
  isCampaignPeriod: boolean;
  comparison: {
    likeForLike: boolean;
    basis: string;
    now: number;
    before: number;
    changePct: number | null;
  } | null;
  period: { from: string; to: string; days: number };
  previousPeriod: { from: string; to: string };
  store: Section<{ current: PeriodLike; previous: PeriodLike }>;
  marketing: { now: Section<unknown>; before: Section<unknown> };
  klaviyo: Section<unknown>;
  meta: Section<unknown>;
  site: Section<unknown>;
  products: Section<unknown>;
  notes: string[];
};

export async function buildCampaignReport(client: Loose, range: Range, withAi: boolean) {
  const prev = previousOf(range);
  const [store, marketingNow, marketingBefore, klaviyo, meta, site, products] = await Promise.all([
    section(async () => {
      const c = await computeCohort(client, range);
      if (c.status !== "ok") throw new Error(c.message);
      return c;
    }),
    section(async () => influenceSummary(await loadInfluence(client, range))),
    section(async () => influenceSummary(await loadInfluence(client, prev))),
    section(() => loadKlaviyo(client, range)),
    section(() => loadMeta(range)),
    section(() => loadSite(client, range)),
    section(() => loadProducts(client, range)),
  ]);

  // Like-for-like: Odoo POS totals only exist from 19 Oct 2026. If either
  // period is missing POS days, compare the store WITHOUT POS.
  let comparison: {
    likeForLike: boolean;
    basis: string;
    now: number;
    before: number;
    changePct: number | null;
  } | null = null;
  if (store.status === "ok") {
    const c = store.data.current;
    const p = store.data.previous;
    const posOf = (x: typeof c) =>
      x.channels.find((ch) => ch.channel === "POS (Odoo)")?.revenue ?? 0;
    const full = (x: typeof c) => !x.pos || x.pos.days >= x.pos.expectedDays;
    const likeForLike = full(c) && full(p);
    const now = likeForLike ? c.revenue : c.revenue - posOf(c);
    const before = likeForLike ? p.revenue : p.revenue - posOf(p);
    comparison = {
      likeForLike,
      basis: likeForLike
        ? "all channels"
        : "Shopify channels only (POS left out of the comparison: Odoo POS data starts 19 Oct 2026, so the earlier period has none)",
      now,
      before,
      changePct: before > 0 ? ((now - before) / before) * 100 : null,
    };
  }

  const isCampaignPeriod =
    Math.abs(new Date(range.since).getTime() - new Date(CAMPAIGN_START).getTime()) <
      2 * 3_600_000 &&
    Math.abs(new Date(range.until).getTime() - new Date(CAMPAIGN_END).getTime()) < 2 * 3_600_000;

  const report = {
    generatedAt: new Date().toISOString(),
    isCampaignPeriod,
    comparison,
    period: {
      ...range,
      ...days(range),
      days: Math.round(
        (new Date(range.until).getTime() - new Date(range.since).getTime()) / DAY_MS,
      ),
    },
    previousPeriod: { ...prev, ...days(prev) },
    store,
    marketing: { now: marketingNow, before: marketingBefore },
    klaviyo,
    meta,
    site,
    products,
    notes: [
      `POS sales come from Odoo; Shopify's "Odoo Connector" orders (source ${ODOO_CONNECTOR_SOURCE}) are copies and are left out everywhere.`,
      `Meta spend is in the ad account's currency; JOD figures use 1 USD = ${USD_TO_JOD} JOD.`,
      "Marketing-influenced revenue uses Pulse's attribution: each order is credited to one main reason (Klaviyo message, marketing code, Google Analytics marketing source or Shopify visit source).",
    ],
  };

  let summary: Section<{ text: string; model: string }> = unavailable("Not requested");
  type AiRes =
    | { status: "ok"; text: string; model: string }
    | { status: "not_configured" }
    | { status: "error"; message: string };
  if (withAi) {
    summary = await section(async () => {
      const res: AiRes = await callBfAdmin<AiRes>({
        action: "ai_summary",
        facts: factsForAi(report),
      });
      if (res.status === "not_configured") throw new Error("Lovable AI key not available");
      if (res.status === "error") throw new Error(res.message);
      return { text: res.text, model: res.model };
    });
  }
  return { ...report, summary };
}

/** Compact, rounded numbers for the AI (no ids, nothing personal). */
function factsForAi(r: ReportCore): Record<string, unknown> {
  const round = (x: unknown): unknown =>
    typeof x === "number"
      ? Math.round(x * 100) / 100
      : Array.isArray(x)
        ? x.map(round)
        : x && typeof x === "object"
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
          : x;
  const sec = <T>(s: Section<T>) =>
    s.status === "ok" ? round(s.data) : { not_available: s.reason };
  return {
    campaign: "Fyxx Friday (Black Friday 2026), Amman, prices in JOD",
    what_this_period_is: r.isCampaignPeriod
      ? "The Black Friday campaign period itself."
      : "A TEST / normal period, NOT the Black Friday campaign. Do not call it 'the campaign'; describe it as a normal trading period.",
    sales_comparison_to_use: r.comparison
      ? round(r.comparison)
      : { not_available: "store sales missing" },
    period: `${r.period.from} to ${r.period.to} (${r.period.days} days)`,
    previous_period_for_comparison: `${r.previousPeriod.from} to ${r.previousPeriod.to}`,
    whole_store_all_channels:
      r.store.status === "ok"
        ? round({ now: strip(r.store.data.current), before: strip(r.store.data.previous) })
        : { not_available: r.store.reason },
    marketing_influenced_revenue: { now: sec(r.marketing.now), before: sec(r.marketing.before) },
    klaviyo_emails_and_sms: sec(r.klaviyo),
    meta_ads: sec(r.meta),
    black_friday_site: sec(r.site),
    products_on_site: sec(r.products),
    channel_changes_vs_before: channelChanges(r),
    tracking_status: {
      black_friday_site_launched: siteHasActivity(r),
      product_tracking:
        "ON since 16 Nov 2026 (records every product view, add to cart and checkout on the Black Friday site). Empty product data only means the site had no visitors in this period, NOT that tracking is missing.",
    },
    notes: [
      ...r.notes,
      "For 'total sales up/down vs before' use ONLY sales_comparison_to_use. If it says POS was left out, do NOT describe POS as growing from zero: POS simply has no data before 19 Oct 2026.",
      "'What worked' may ONLY contain things that went UP vs before or clearly beat the others. A channel or message whose revenue went DOWN (see channel_changes_vs_before) belongs in 'What didn't', even if it is still large.",
      "Never recommend setting up or enabling tracking that tracking_status says is already ON. If the Black Friday site was not launched in this period, say so in one line and do not treat its zeros as a failure.",
    ],
  };
}

/** Per channel: revenue now vs before and the % change (null when no data before). */
function channelChanges(r: ReportCore) {
  if (r.store.status !== "ok") return { not_available: r.store.reason };
  const { current, previous } = r.store.data;
  const posMissingBefore = !!previous.pos && previous.pos.days < previous.pos.expectedDays;
  return current.channels.map((c) => {
    const b = previous.channels.find((x) => x.channel === c.channel);
    const noData = c.channel === "POS (Odoo)" && posMissingBefore;
    const before = noData ? null : (b?.revenue ?? 0);
    return {
      channel: c.channel,
      revenue_jod_now: Math.round(c.revenue),
      revenue_jod_before: before === null ? "no data" : Math.round(before),
      direction:
        before === null
          ? "unknown (no data before)"
          : c.revenue > before
            ? "UP"
            : c.revenue < before
              ? "DOWN"
              : "flat",
      change_pct: before ? Math.round(((c.revenue - before) / before) * 100) : null,
    };
  });
}

function siteHasActivity(r: ReportCore): boolean {
  if (r.site.status !== "ok") return false;
  const t = (r.site.data as { totals?: { visits?: number; orders?: number } }).totals;
  return !!t && ((t.visits ?? 0) > 0 || (t.orders ?? 0) > 0);
}

function strip(p: {
  orders: number;
  revenue: number;
  aov: number;
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  channels: Array<{ channel: string; orders: number; revenue: number }>;
}) {
  return {
    orders: p.orders,
    revenue_jod: p.revenue,
    average_order_jod: p.aov,
    customers: p.customers,
    new_customers: p.newCustomers,
    returning_customers: p.returningCustomers,
    by_channel: p.channels.map((c) => ({
      channel: c.channel,
      orders: c.orders,
      revenue_jod: c.revenue,
    })),
  };
}

export type CampaignReport = Awaited<ReturnType<typeof buildCampaignReport>>;
