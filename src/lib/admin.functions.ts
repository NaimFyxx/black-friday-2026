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
import { normalizeSource } from "@/lib/source-labels";
import type { CampaignReport } from "@/lib/report.server";

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
  const { isAdminAndRenew } = await import("./admin-session.server");
  return { isAdmin: await isAdminAndRenew() };
});

// ── Tracking switches (/admin → Tracking) ─────────────────────────────

export const getTrackingSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const { getSiteTracking, isDeviceExcluded } = await import("./tracking-settings.server");
  const site = await getSiteTracking(true);
  return { siteEnabled: site.enabled, siteSetup: site.setup, deviceExcluded: isDeviceExcluded() };
});

export const updateSiteTracking = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { setSiteTracking } = await import("./tracking-settings.server");
    await setSiteTracking(data.enabled);
    return { ok: true };
  });

export const updateDeviceTracking = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ excluded: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { setDeviceExcluded } = await import("./tracking-settings.server");
    setDeviceExcluded(data.excluded);
    return { ok: true };
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
    const row = (src: string | null, m: string | null, c: string | null) => {
      const s = normalizeSource(src);
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
    // Outlook / Defender link scanners, not visitors.
    .not("message", "like", "Object Not Found Matching Id:%")
    .order("created_at", { ascending: false })
    .limit(100);
  if (isMissing(recent.error))
    return { setup: "missing" as const, rows: [], summary: [], total24h: 0, total7d: 0 };

  const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const since24h = Date.now() - DAY_MS;
  const week = await client
    .from("bf_error_log")
    .select("area, created_at")
    .not("message", "like", "Object Not Found Matching Id:%")
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

export const getCohort = createServerFn({ method: "GET" })
  .validator((d: unknown) => RangeInput.parse(d))
  .handler(async ({ data: range }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { computeCohort } = await import("./cohort.server");
    return computeCohort(await db(), range);
  });

// ── Campaign report (/admin/report) ───────────────────────────────────

export const generateCampaignReport = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const o = (d ?? {}) as { since?: string; until?: string; withAi?: boolean };
    const range = RangeInput.parse(
      o.since || o.until ? { since: o.since, until: o.until } : undefined,
    );
    return { range, withAi: o.withAi !== false };
  })
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { buildCampaignReport } = await import("./report.server");
    return buildCampaignReport(await db(), data.range, data.withAi);
  });

// ── Saved reports (bf_reports) ────────────────────────────────────────

export type SavedReportMeta = {
  id: string;
  created_at: string;
  title: string;
  period_from: string;
  period_to: string;
  is_campaign: boolean;
};

export const saveCampaignReport = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ title: z.string().trim().min(1).max(200), report: z.record(z.unknown()) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const r = data.report as {
      period?: { from?: string; to?: string };
      isCampaignPeriod?: boolean;
    };
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!r.period?.from || !r.period?.to || !day.test(r.period.from) || !day.test(r.period.to)) {
      throw new Error("Not a report");
    }
    if (JSON.stringify(data.report).length > 2_000_000) throw new Error("Report too large");
    const { data: row, error } = await (
      await db()
    )
      .from("bf_reports")
      .insert({
        title: data.title,
        period_from: r.period.from,
        period_to: r.period.to,
        is_campaign: r.isCampaignPeriod === true,
        report: data.report,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const listSavedReports = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const { data, error } = await (
    await db()
  )
    .from("bf_reports")
    .select("id, created_at, title, period_from, period_to, is_campaign")
    .order("created_at", { ascending: false })
    .limit(50);
  if (isMissing(error)) return { setup: "missing" as const, reports: [] as SavedReportMeta[] };
  if (error) throw new Error(error.message);
  return { setup: "ok" as const, reports: (data ?? []) as SavedReportMeta[] };
});

export const getSavedReport = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { data: row, error } = await (
      await db()
    )
      .from("bf_reports")
      .select("id, created_at, title, report")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Report not found");
    return row as unknown as {
      id: string;
      created_at: string;
      title: string;
      report: CampaignReport;
    };
  });

export const deleteSavedReport = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { error } = await (await db()).from("bf_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Most added to cart ────────────────────────────────────────────────

export type TopAddedRow = {
  product: string;
  handle: string | null;
  adds: number;
  people: number;
  value: number;
  /** quantity x regular price (higher of price and compare-at): stays full after the sale starts */
  value_full: number;
  top_source: string | null;
  top_source_adds: number;
};

/** Products by add-to-carts (bf_events), "today" (Amman) or since launch.
 *  Test visits (bf_settings.test_utm_sources: claude-qa, test) are left out. */
export const getTopAdded = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ range: z.enum(["today", "launch"]) }).parse(d))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const now = new Date();
    // Amman is UTC+3 all year: today's 00:00 there.
    const amman = new Date(now.getTime() + 3 * 3_600_000);
    const todayStart = new Date(
      Date.UTC(amman.getUTCFullYear(), amman.getUTCMonth(), amman.getUTCDate()) - 3 * 3_600_000,
    );
    const since = data.range === "today" ? todayStart : new Date(CAMPAIGN_START);
    const client = await db();
    const { data: rows, error } = await client.rpc("bf_top_added", {
      p_since: since.toISOString(),
      p_until: new Date(now.getTime() + 60_000).toISOString(),
    });
    if (error) throw new Error(error.message);
    const { data: tot, error: totErr } = await client.rpc("bf_cart_value_totals", {
      p_since: since.toISOString(),
      p_until: new Date(now.getTime() + 60_000).toISOString(),
    });
    if (totErr) throw new Error(totErr.message);
    const t = (tot ?? {}) as {
      value?: unknown;
      value_full?: unknown;
      adds?: unknown;
      people?: unknown;
    };
    return {
      since: since.toISOString(),
      totals: {
        value: n(t.value),
        valueFull: n(t.value_full),
        adds: n(t.adds),
        people: n(t.people),
      },
      rows: ((rows as TopAddedRow[] | null) ?? []).map((r) => ({
        ...r,
        adds: n(r.adds),
        people: n(r.people),
        value: n(r.value),
        value_full: n(r.value_full),
        top_source_adds: n(r.top_source_adds),
      })),
    };
  });

// ── What goes out: leaving for myfyxx.com / the app ────────────────────

export type OutboundRow = { destination: string; link: string; clicks: number; people: number };
export type AfterVisitRow = {
  source: string | null;
  medium: string | null;
  orders: number;
  revenue: number;
  new_customers: number;
};

/** Clicks out (bf_events) and myfyxx.com website orders by Friday visitors. */
export const getLeaving = createServerFn({ method: "GET" })
  .validator((d: unknown) => RangeInput.parse(d))
  .handler(async ({ data: range }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { fetchSiteOrders } = await import("./shopify-admin.server");
    const client = await db();
    const [out, shop] = await Promise.all([
      client.rpc("bf_outbound", { p_since: range.since, p_until: range.until }),
      fetchSiteOrders(range.since, range.until),
    ]);
    if (out.error && !isMissing(out.error)) throw new Error(out.error.message);
    const clicks = ((out.data as OutboundRow[] | null) ?? []).map((r) => ({
      ...r,
      clicks: n(r.clicks),
      people: n(r.people),
    }));
    const bySource = new Map<string, AfterVisitRow>();
    let orders = 0;
    let revenue = 0;
    let currency = "JOD";
    if (shop.status === "ok") {
      for (const o of shop.afterVisit ?? []) {
        if (o.cancelled) continue;
        currency = o.currency || currency;
        orders += 1;
        revenue += o.total;
        const k = key(o.source, o.medium);
        const r = bySource.get(k) ?? {
          source: o.source,
          medium: o.medium,
          orders: 0,
          revenue: 0,
          new_customers: 0,
        };
        r.orders += 1;
        r.revenue += o.total;
        if (o.isFirstOrder) r.new_customers += 1;
        bySource.set(k, r);
      }
    }
    return {
      clicks,
      websiteClicks: clicks
        .filter((c) => c.destination === "website")
        .reduce((t, c) => t + c.clicks, 0),
      appClicks: clicks.filter((c) => c.destination === "app").reduce((t, c) => t + c.clicks, 0),
      orders,
      revenue: Math.round(revenue * 1000) / 1000,
      currency,
      bySource: [...bySource.values()].sort((a, b) => b.revenue - a.revenue),
      shopify: shop.status,
    };
  });

// ── Sales forecast (box above "Most added to cart") ────────────────────

export type Bucket = { orders: number; total: number };
export type Channels = {
  website: Bucket;
  app: Bucket;
  inStore: Bucket;
  staff: Bucket;
  other: Bucket;
};
export type DaySales = { orders: number; total: number; channels: Channels };
export type SalesForecast = {
  mode: "before" | "friday" | "after";
  now: string;
  dayStart: string;
  lastYear: (DaySales & { day: string }) | null;
  carts: { value: number; carts: number; units: number; rates: number[] } | null;
  thisYear: DaySales | null;
  thisYearError: string | null;
  pace: number | null;
  tooEarlyBefore: number;
};

const emptyBucket = (): Bucket => ({ orders: 0, total: 0 });
function toChannels(raw: unknown): Channels {
  const r = (raw ?? {}) as Partial<Record<keyof Channels, { orders?: unknown; total?: unknown }>>;
  const b = (k: keyof Channels): Bucket =>
    r[k] ? { orders: n(r[k]?.orders), total: n(r[k]?.total) } : emptyBucket();
  return {
    website: b("website"),
    app: b("app"),
    inStore: b("inStore"),
    staff: b("staff"),
    other: b("other"),
  };
}

/**
 * Before the sale: cart value at Friday prices (bf_cart_forecast). From the
 * sale day: Shopify orders since 00:00 Amman that day, every channel, via
 * bf-admin day_sales, compared with last year's Fyxx Friday (whole day, same
 * method, bf_settings.forecast_last_year), plus the pace by midnight. Totals
 * only: no prices or cost.
 */
export const getSalesForecast = createServerFn({ method: "GET" }).handler(
  async (): Promise<SalesForecast> => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { ammanHour, paceByMidnight } = await import("./forecast");
    const client = await db();
    const keys = [
      "sale_start",
      "sale_end",
      "forecast_last_year",
      "forecast_too_early_before_hour",
      "forecast_buy_rates",
    ];
    const { data: rows, error } = await client
      .from("bf_settings")
      .select("key, value")
      .in("key", keys);
    if (error) throw new Error(error.message);
    const cfg = new Map<string, unknown>(
      ((rows ?? []) as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
    );
    const saleStart = new Date(String(cfg.get("sale_start") ?? "2026-11-27T10:00:00+03:00"));
    const saleEnd = new Date(String(cfg.get("sale_end") ?? "2026-11-28T00:00:00+03:00"));
    // 00:00 Amman (UTC+3) on the sale day.
    const a = new Date(saleStart.getTime() + 3 * 3_600_000);
    const dayStart = new Date(
      Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - 3 * 3_600_000,
    );
    const tooEarlyBefore = n(cfg.get("forecast_too_early_before_hour")) || 13;
    const rates = Array.isArray(cfg.get("forecast_buy_rates"))
      ? (cfg.get("forecast_buy_rates") as unknown[]).map(n).filter((r) => r > 0 && r <= 1)
      : [0.2, 0.35, 0.5];
    const ly = cfg.get("forecast_last_year") as
      | {
          day?: unknown;
          orders?: unknown;
          total?: unknown;
          channels?: unknown;
          share_by_hour?: Record<string, number>;
        }
      | undefined;
    const lastYear = ly
      ? {
          day: String(ly.day ?? ""),
          orders: n(ly.orders),
          total: n(ly.total),
          channels: toChannels(ly.channels),
        }
      : null;

    const now = new Date();
    const mode = now < saleStart ? "before" : now < saleEnd ? "friday" : "after";

    let carts: SalesForecast["carts"] = null;
    if (mode === "before") {
      const { data: c, error: cErr } = await client.rpc("bf_cart_forecast");
      if (cErr) throw new Error(cErr.message);
      const v = (c ?? {}) as { value?: unknown; carts?: unknown; units?: unknown };
      carts = { value: n(v.value), carts: n(v.carts), units: n(v.units), rates };
    }

    let thisYear: DaySales | null = null;
    let thisYearError: string | null = null;
    let pace: number | null = null;
    if (mode !== "before") {
      const { callBfAdmin } = await import("./bf-edge.server");
      const until = mode === "friday" ? new Date(now.getTime() + 60_000) : saleEnd;
      try {
        const r = await callBfAdmin<{
          status: string;
          message?: string;
          orders?: unknown;
          total?: unknown;
          channels?: unknown;
        }>({ action: "day_sales", since: dayStart.toISOString(), until: until.toISOString() });
        if (r.status === "ok") {
          thisYear = { orders: n(r.orders), total: n(r.total), channels: toChannels(r.channels) };
          if (mode === "friday" && ly?.share_by_hour) {
            pace = paceByMidnight({
              soFar: thisYear.total,
              hour: ammanHour(now),
              shareByHour: ly.share_by_hour,
              tooEarlyBefore,
            });
          }
        } else {
          thisYearError = r.message ?? r.status;
        }
      } catch (e) {
        thisYearError = (e as Error).message;
      }
    }

    return {
      mode,
      now: now.toISOString(),
      dayStart: dayStart.toISOString(),
      lastYear,
      carts,
      thisYear,
      thisYearError,
      pace,
      tooEarlyBefore,
    };
  },
);

// ── Carts: one row per shopper's cart ─────────────────────────────────

export type CartRow = {
  session: string;
  units: number;
  value_full: number;
  value_friday: number;
  items: Array<{ title: string; qty: number }>;
  first_at: string;
  last_at: string;
  checkout: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  referrer: string | null;
};

/** Every shopper's cart (browser session), most recently active first (bf_carts_list). */
export const getCarts = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const client = await db();
  const { data, error } = await client.rpc("bf_carts_list", { p_limit: 500 });
  if (error) throw new Error(error.message);
  const rows = ((data as CartRow[] | null) ?? []).map((r) => ({
    ...r,
    units: n(r.units),
    value_full: n(r.value_full),
    value_friday: n(r.value_friday),
    items: (r.items ?? []).map((i) => ({ title: String(i.title ?? ""), qty: n(i.qty) })),
  }));
  rows.sort((a, b) => Date.parse(b.last_at) - Date.parse(a.last_at));
  return { rows };
});

// ── Offers on the site: on/off switches (bf_settings) ──────────────────

const OFFER_KEYS = [
  "gift_card_discount_enabled",
  "mystery_gift_enabled",
  "rewards_strip_enabled",
] as const;
export type OfferKey = (typeof OFFER_KEYS)[number];

/** The /admin Offers switches and the gift card percent. */
export const getOfferSwitches = createServerFn({ method: "GET" }).handler(async () => {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const client = await db();
  const { data, error } = await client
    .from("bf_settings")
    .select("key, value")
    .in("key", [...OFFER_KEYS, "gift_card_discount_pct"]);
  if (error) throw new Error(error.message);
  const m = new Map(
    ((data ?? []) as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
  );
  return {
    gift_card_discount_enabled: m.get("gift_card_discount_enabled") === true,
    gift_card_discount_pct: n(m.get("gift_card_discount_pct")) || 10,
    mystery_gift_enabled: m.get("mystery_gift_enabled") === true,
    rewards_strip_enabled: m.get("rewards_strip_enabled") === true,
  };
});

/** Turn one offer on or off. Live on the site within a minute, no Publish. */
export const setOfferSwitch = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ key: z.enum(OFFER_KEYS), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const client = await db();
    const { error } = await client
      .from("bf_settings")
      .upsert({ key: data.key, value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * "Clear reviewed errors" on /admin/errors: copies every logged error into
 * bf_error_log_archive (kept, out of sight) and then removes it from
 * bf_error_log, so the page shows only what comes in afterwards.
 */
export const clearErrorLog = createServerFn({ method: "POST" }).handler(async () => {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const client = await db();
  let moved = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await client
      .from("bf_error_log")
      .select("*")
      .order("id", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data as Array<{ id: number }> | null) ?? [];
    if (rows.length === 0) break;
    const saved = await client
      .from("bf_error_log_archive")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (saved.error) throw new Error(`Archive failed: ${saved.error.message}`);
    const ids = rows.map((r) => r.id);
    const del = await client.from("bf_error_log").delete().in("id", ids);
    if (del.error) throw new Error(del.error.message);
    moved += ids.length;
    if (rows.length < 500) break;
  }
  return { moved };
});

// ── Visitors (anonymous visitor ID, from 23 Nov 2026) ──────────────────

export type VisitorRow = {
  visitor_id: string;
  visits: number;
  first_seen: string;
  last_seen: string;
  utm_source: string | null;
  utm_medium: string | null;
  visits_viewed: number;
  adds: number;
  visits_carted: number;
  checked_out: boolean;
};

/** Visitors (one per browser), how often each came, and what they did (bf_visitors). */
export const getVisitors = createServerFn({ method: "GET" })
  .validator((d: unknown) => RangeInput.parse(d))
  .handler(async ({ data: range }) => {
    const { assertAdmin } = await import("./admin-session.server");
    await assertAdmin();
    const { fetchSiteOrders } = await import("./shopify-admin.server");
    const client = await db();
    const [{ data, error }, shop] = await Promise.all([
      client.rpc("bf_visitors", { p_since: range.since, p_until: range.until, p_limit: 100 }),
      fetchSiteOrders(range.since, range.until),
    ]);
    if (error) throw new Error(error.message);

    // Orders through this site's checkout, split by how many visits the
    // browser had made by the time it ordered (cart attribute _bf_visitor).
    const paid = shop.status === "ok" ? shop.orders.filter((o) => !o.cancelled) : [];
    const withId = paid.filter((o) => o.visitorId);
    const visitsBefore = new Map<string, number>();
    if (withId.length) {
      const { data: vb, error: vbErr } = await client.rpc("bf_visits_before", {
        p_items: withId.map((o) => ({ visitor_id: o.visitorId, at: o.createdAt })),
      });
      if (vbErr) throw new Error(vbErr.message);
      for (const r of (vb as Array<{ visitor_id: string; at: string; visits: unknown }> | null) ??
        []) {
        visitsBefore.set(`${r.visitor_id}|${new Date(r.at).getTime()}`, n(r.visits));
      }
    }
    const split = {
      first: { orders: 0, sales: 0 },
      returning: { orders: 0, sales: 0, visits: 0 },
      unknown: { orders: 0, sales: 0 },
    };
    const byVisitor = new Map<string, { orders: number; sales: number }>();
    for (const o of paid) {
      const v = o.visitorId
        ? (visitsBefore.get(`${o.visitorId}|${new Date(o.createdAt).getTime()}`) ?? 0)
        : 0;
      if (!o.visitorId || v === 0) {
        split.unknown.orders += 1;
        split.unknown.sales += o.total;
      } else if (v === 1) {
        split.first.orders += 1;
        split.first.sales += o.total;
      } else {
        split.returning.orders += 1;
        split.returning.sales += o.total;
        split.returning.visits += v;
      }
      if (o.visitorId) {
        const b = byVisitor.get(o.visitorId) ?? { orders: 0, sales: 0 };
        b.orders += 1;
        b.sales += o.total;
        byVisitor.set(o.visitorId, b);
      }
    }
    const r = (data ?? {}) as {
      totals?: Record<string, unknown>;
      by_visits?: Record<string, unknown>;
      rows?: VisitorRow[];
    };
    const t = r.totals ?? {};
    const b = r.by_visits ?? {};
    return {
      totals: {
        visitors: n(t["visitors"]),
        returning: n(t["returning"]),
        visits: n(t["visits"]),
        carted: n(t["carted"]),
        returningCarted: n(t["returning_carted"]),
        checkedOut: n(t["checked_out"]),
        returningCheckedOut: n(t["returning_checked_out"]),
      },
      byVisits: [
        { label: "1 visit", count: n(b["1"]) },
        { label: "2 visits", count: n(b["2"]) },
        { label: "3 visits", count: n(b["3"]) },
        { label: "4 or more", count: n(b["4+"]) },
      ],
      orders: {
        shopify: shop.status,
        first: split.first,
        returning: {
          orders: split.returning.orders,
          sales: split.returning.sales,
          avgVisits: split.returning.orders ? split.returning.visits / split.returning.orders : 0,
        },
        unknown: split.unknown,
      },
      rows: (r.rows ?? []).map((x) => ({
        ...x,
        orders: byVisitor.get(x.visitor_id)?.orders ?? 0,
        sales: byVisitor.get(x.visitor_id)?.sales ?? 0,
        visits: n(x.visits),
        visits_viewed: n(x.visits_viewed),
        adds: n(x.adds),
        visits_carted: n(x.visits_carted),
        checked_out: !!x.checked_out,
      })),
    };
  });
