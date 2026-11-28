// bf-admin: Black Friday 2026 site helper (repo NaimFyxx/black-friday-2026).
//
// The Black Friday website runs on Lovable, which can't see the secrets saved
// in this Supabase project. This function can, so the site asks it for the two
// things that need secrets:
//   { key, action: "check_password", password }  -> { configured, ok }
//       checks BLACK_FRIDAY_ADMIN_PASSWORD
//   { key, action: "orders", since, until }       -> { status, orders }
//       reads Shopify orders placed through the Black Friday site, using
//       Pulse's Shopify app (SHOPIFY_STORE / SHOPIFY_CLIENT_ID /
//       SHOPIFY_CLIENT_SECRET). READ ONLY. Never changes any secret.
//   { key, action: "day_sales", since, until }    -> all Shopify orders in the
//       range (every channel), count and total, split into in store (Point of
//       Sale) and online (everything else). Cancelled and test orders left out.
//       Also margin (Zeid's formula, Odoo costs by SKU from bf_cost_odoo_products;
//       totals only), orders by signed-in Rewards members (_ff_member) and new
//       customers (the order is the customer's first ever order). From 2026,
//       in-store comes from Odoo POS directly (read only), not from Shopify.
//   { key, action: "usual", kx }                  -> Shopify product IDs this
//       shopper ordered most ("Your usual" shelf). kx = Klaviyo's _kx link
//       parameter from one of our emails; resolved with the Klaviyo private
//       key (KLAVIYO_PRIVATE_KEY, read only). Returns product IDs only, never
//       the email or profile.
//   { key, action: "probe" }                      -> which optional secrets exist
//       (true/false per NAME only, never values)
//   { key, action: "meta", since, until }          -> Meta ad results per campaign
//       for the "Fyxx Ads" account, read-only, with BLACK_FRIDAY_META_TOKEN
//   { key, action: "ai_summary", facts }           -> plain-English campaign
//       summary written by Lovable's AI gateway (LOVABLE_API_KEY)
//
// Only the site's server may call it: `key` must match bf_settings.edge_key
// (the same pattern as Pulse's inv_settings.cron_key). Touches no Pulse table.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const API_VERSION = "2026-10";
const MAX_PAGES = 40; // 40 x 250 orders
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
async function sameString(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

let edgeKey: { value: string; at: number } | null = null;
async function getEdgeKey(): Promise<string | null> {
  if (edgeKey && Date.now() - edgeKey.at < 60_000) return edgeKey.value;
  const { data } = await db.from("bf_settings").select("value").eq("key", "edge_key").maybeSingle();
  const v = typeof data?.value === "string" ? data.value : null;
  if (v) edgeKey = { value: v, at: Date.now() };
  return v;
}

// ── Shopify (Pulse's app, client-credentials grant, same as order-watch) ──
let token: { value: string; at: number } | null = null;
async function gql(query: string, variables: Record<string, unknown>) {
  const store = Deno.env.get("SHOPIFY_STORE");
  if (!token || Date.now() - token.at > 30 * 60_000) {
    const r = await fetch(`https://${store}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("SHOPIFY_CLIENT_ID"),
        client_secret: Deno.env.get("SHOPIFY_CLIENT_SECRET"),
        grant_type: "client_credentials",
      }),
    });
    const t = (await r.json()).access_token;
    if (!t) throw new Error(`Shopify sign-in failed (${r.status})`);
    token = { value: t, at: Date.now() };
  }
  const res = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token.value },
    body: JSON.stringify({ query, variables }),
  });
  const j = await res.json();
  if (j.errors) throw new Error(`Shopify: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j.data;
}

const ORDERS_QUERY = `
  query bfOrders($q: String!, $after: String) {
    orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name createdAt cancelledAt displayFinancialStatus
        customAttributes { key value }
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { numberOfOrders }
      }
    }
  }
`;

// Short customer names ("Sara K.") for the orders list and the visitors on
// /admin. A separate, optional query:
// if Pulse's app may not read customer names, orders still work without them.
const NAMES_QUERY = `
  query bfNames($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order { id customer { firstName lastName } }
    }
  }
`;

function shortName(first?: string | null, last?: string | null): string | null {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return null;
  return f ? (l ? `${f} ${l[0].toUpperCase()}.` : f) : `${l[0].toUpperCase()}.`;
}

// deno-lint-ignore no-explicit-any
async function addCustomerNames(orders: any[]) {
  const ids = orders.map((o) => o.id);
  const names = new Map<string, string | null>();
  try {
    for (let i = 0; i < ids.length; i += 100) {
      // deno-lint-ignore no-explicit-any
      const d: any = await gql(NAMES_QUERY, { ids: ids.slice(i, i + 100) });
      for (const n of d?.nodes ?? []) {
        if (n?.id) names.set(n.id, shortName(n.customer?.firstName, n.customer?.lastName));
      }
    }
  } catch (e) {
    console.error("[bf-admin] names", String((e as Error).message).slice(0, 200));
  }
  for (const o of orders) o.customerName = names.get(o.id) ?? null;
}

async function siteOrders(since: string, until: string) {
  const q = `created_at:>='${since}' AND created_at:<'${until}'`;
  const orders: unknown[] = [];
  // Orders on the myfyxx.com website by browsers that visited the Friday site
  // first (the theme snippet copies the fyxx_friday cookie onto the cart as
  // _bf_visit...). Kept apart from the Friday site's own orders.
  const afterVisit: unknown[] = [];
  let after: string | null = null;
  for (let p = 0; p < MAX_PAGES; p++) {
    // deno-lint-ignore no-explicit-any
    const d: any = await gql(ORDERS_QUERY, { q, after });
    for (const o of d.orders.nodes) {
      const attr = new Map<string, string>(
        // deno-lint-ignore no-explicit-any
        o.customAttributes.map((a: any) => [a.key, a.value ?? ""]),
      );
      const n = o.customer ? Number(o.customer.numberOfOrders) : NaN;
      if (!attr.has("_bf_session")) {
        if (attr.get("_bf_visit")) {
          afterVisit.push({
            id: o.id,
            name: o.name,
            createdAt: o.createdAt,
            total: Number(o.totalPriceSet.shopMoney.amount) || 0,
            currency: o.totalPriceSet.shopMoney.currencyCode,
            cancelled: o.cancelledAt != null,
            financialStatus: o.displayFinancialStatus ?? null,
            source: attr.get("_bf_visit_source") || null,
            medium: attr.get("_bf_visit_medium") || null,
            campaign: attr.get("_bf_visit_campaign") || null,
            firstVisit: attr.get("_bf_visit_first") || null,
            // Only once the myfyxx.com theme snippet also copies the fyxx_vid cookie.
            visitorId: attr.get("_bf_visit_visitor") || null,
            isFirstOrder: Number.isFinite(n) ? n <= 1 : null,
          });
        }
        continue; // not placed through the Black Friday site
      }
      orders.push({
        id: o.id,
        name: o.name,
        createdAt: o.createdAt,
        total: Number(o.totalPriceSet.shopMoney.amount) || 0,
        currency: o.totalPriceSet.shopMoney.currencyCode,
        cancelled: o.cancelledAt != null,
        financialStatus: o.displayFinancialStatus ?? null,
        utm_source: attr.get("_utm_source") || null,
        // No UTM tags: the referring site (instagram.com, direct...) takes the
        // medium's place, the same rule the Sources page uses for visits.
        utm_medium: attr.get("_utm_source")
          ? attr.get("_utm_medium") || null
          : attr.get("_bf_referrer") || null,
        utm_campaign: attr.get("_utm_campaign") || null,
        utm_content: attr.get("_utm_content") || null,
        // Anonymous visitor ID (from 23 Nov 2026), to tell new from returning visitors.
        visitorId: attr.get("_bf_visitor") || null,
        isFirstOrder: Number.isFinite(n) ? n <= 1 : null,
      });
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  // deno-lint-ignore no-explicit-any
  await addCustomerNames([...orders, ...afterVisit] as any[]);
  return { orders, afterVisit };
}

const DAY_SALES_QUERY = `
  query bfDaySales($q: String!, $after: String) {
    orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id name createdAt cancelledAt test sourceName
        app { name }
        totalPriceSet { shopMoney { amount } }
        currentTotalPriceSet { shopMoney { amount } }
        totalTipReceivedSet { shopMoney { amount } }
        customAttributes { key value }
        customer { id orders(first: 1, sortKey: CREATED_AT) { nodes { id } } }
        lineItems(first: 60) {
          nodes {
            quantity currentQuantity isGiftCard sku title vendor
            product { productType }
            variant { legacyResourceId sku }
            originalTotalSet { shopMoney { amount } }
            discountAllocations { allocatedAmountSet { shopMoney { amount } } }
          }
        }
      }
    }
  }
`;

// Margin the way Zeid's sale sheet works it out: prices include 16% sales
// tax, cost does not. margin = price / 1.16 - cost; margin % = margin / (price / 1.16).
const SALES_TAX = 1.16;

/**
 * Unit cost per SKU from Odoo (bf_cost_odoo_products.standard_price, the same
 * costs Zeid's sheet uses), with Zeid's sale list by variant ID as a backup.
 */
async function loadCosts(): Promise<{
  bySku: Map<string, number>;
  byVariant: Map<string, number>;
}> {
  const bySku = new Map<string, number>();
  const byVariant = new Map<string, number>();
  const pages = async (table: string, cols: string, each: (r: Record<string, unknown>) => void) => {
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await db
        .from(table)
        .select(cols)
        .range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      for (const r of (data ?? []) as Record<string, unknown>[]) each(r);
      if ((data ?? []).length < 1000) break;
    }
  };
  await pages("bf_cost_odoo_products", "sku, standard_price", (r) => {
    const c = Number(r.standard_price);
    const sku = String(r.sku ?? "").trim();
    if (sku && c > 0) bySku.set(sku, c);
  });
  await pages("bf_sale_list", "variant_id, cost", (r) => {
    const c = Number(r.cost);
    if (r.variant_id != null && c > 0) byVariant.set(String(r.variant_id), c);
  });
  return { bySku, byVariant };
}

type ItemSold = { title: string; category: string; qty: number; sales: number };

/** Sum items by a key, biggest quantity first. */
function rollUp(list: ItemSold[], key: (i: ItemSold) => string, limit: number) {
  const m = new Map<string, { name: string; category: string; qty: number; sales: number }>();
  for (const i of list) {
    const k = key(i);
    const x = m.get(k) ?? { name: k, category: i.category, qty: 0, sales: 0 };
    x.qty += i.qty;
    x.sales += i.sales;
    m.set(k, x);
  }
  return [...m.values()]
    .filter((x) => x.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.sales - a.sales)
    .slice(0, limit)
    .map((x) => ({ ...x, qty: r3(x.qty), sales: r3(x.sales) }));
}

type Bucket = {
  orders: number;
  total: number;
  /** Margin in JOD on the items with a known cost (Zeid's formula). */
  margin: number;
  /** Those items' sales without the 16% tax (margin % = margin / this). */
  costedNet: number;
  /** Sales of items with no known cost (left out of the margin), gift cards apart. */
  uncosted: number;
  /** Gift card sales (no product cost: left out of the margin). */
  giftCards: number;
  /** Free gifts given with these orders (Fyxx Friday 2026 final list): count and cost. */
  giftOrders: number;
  giftCost: number;
  /** Orders placed by a signed-in Fyxx Rewards member on the Friday site. */
  memberOrders: number;
  memberTotal: number;
  /** Orders that were the customer's first ever order (a new customer). */
  newCustomers: number;
  /** Orders with no customer attached (common in store), so new/returning is unknown. */
  noCustomer: number;
};
const bucket = (): Bucket => ({
  newCustomers: 0,
  noCustomer: 0,
  orders: 0,
  total: 0,
  margin: 0,
  costedNet: 0,
  uncosted: 0,
  giftCards: 0,
  giftOrders: 0,
  giftCost: 0,
  memberOrders: 0,
  memberTotal: 0,
});
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// ── Odoo POS (read only): the shop's till since the move from Shopify POS ──
// Same Odoo access as Pulse (ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY),
// search_read / read_group only. Never writes to Odoo.
const ODOO_URL = (Deno.env.get("ODOO_URL") ?? "").replace(/\/+$/, "");
const ODOO_DB = (Deno.env.get("ODOO_DB") ?? "").trim();
const ODOO_USER = (Deno.env.get("ODOO_USERNAME") ?? "").trim();
const ODOO_KEY = (Deno.env.get("ODOO_API_KEY") ?? "").trim();
// Odoo POS replaced Shopify POS for the shop; from this date in-store sales come from Odoo.
const ODOO_POS_FROM = "2026-01-01T00:00:00Z";

async function odooRpc(service: string, method: string, args: unknown[]) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: 1,
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`Odoo: ${j.error.data?.message ?? j.error.message}`.slice(0, 300));
  return j.result;
}

/** Hour of the day in Amman (UTC+3 all year) for a UTC time. */
const ammanHourOf = (t: number) => new Date(t + 3 * 3_600_000).getUTCHours();
type Hour = { orders: number; total: number };
const emptyHours = (): Hour[] => Array.from({ length: 24 }, () => ({ orders: 0, total: 0 }));

/** Odoo datetime string ("YYYY-MM-DD HH:MM:SS", UTC) from an ISO time. */
const odooTime = (iso: string) => new Date(iso).toISOString().slice(0, 19).replace("T", " ");

/**
 * Paid Odoo POS orders in the range, as one Bucket: sales (incl. tax), margin
 * (line subtotal without tax minus Odoo cost by SKU, the same costs as online),
 * new customers (customer with no earlier POS order) and orders with no customer.
 */
async function odooPos(since: string, until: string, bySku: Map<string, number> | null) {
  if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_KEY) throw new Error("Odoo not configured");
  const uid = await odooRpc("common", "authenticate", [ODOO_DB, ODOO_USER, ODOO_KEY, {}]);
  if (!uid) throw new Error("Odoo sign-in failed");
  const call = (model: string, method: string, args: unknown[], kw: Record<string, unknown> = {}) =>
    odooRpc("object", "execute_kw", [ODOO_DB, uid, ODOO_KEY, model, method, args, kw]);
  // Dine-In vs Retail is decided by the product's POS category, not by the till
  // (the tills aren't used as intended). bf_settings.pos_dine_in_categories lists
  // the Dine-In POS categories; a category also covers its sub-categories
  // ("TGR Food Menu" covers "TGR Food Menu / Deli"). Everything else is Retail.
  const { data: cfg } = await db
    .from("bf_settings")
    .select("value")
    .eq("key", "pos_dine_in_categories")
    .maybeSingle();
  const dineCats = (Array.isArray(cfg?.value) ? cfg.value : []).map((x: unknown) =>
    String(x).trim().toLowerCase(),
  );
  const isDineCat = (name: string) => {
    const n = name.trim().toLowerCase();
    return dineCats.some((c: string) => n === c || n.startsWith(`${c} / `));
  };
  const domain = [
    ["date_order", ">=", odooTime(since)],
    ["date_order", "<", odooTime(until)],
    ["state", "in", ["paid", "done", "invoiced"]],
  ];
  // deno-lint-ignore no-explicit-any
  const orders: any[] = await call("pos.order", "search_read", [domain], {
    fields: ["id", "amount_total", "partner_id", "config_id", "date_order"],
    limit: 5000,
  });
  const retail = bucket();
  const dineIn = bucket();
  const hours = emptyHours();
  const tills: Record<string, { orders: number; total: number }> = {};
  if (!orders.length) return { retail, dineIn, tills, hours, items: [] as ItemSold[], tips: 0 };
  for (const o of orders) {
    const t = Array.isArray(o.config_id) ? String(o.config_id[1]) : "unknown";
    tills[t] ??= { orders: 0, total: 0 };
    tills[t].orders += 1;
    tills[t].total = r3(tills[t].total + (Number(o.amount_total) || 0));
    const ts = Date.parse(String(o.date_order).replace(" ", "T") + "Z");
    if (Number.isFinite(ts)) {
      const h = hours[ammanHourOf(ts)];
      h.orders += 1;
      h.total = r3(h.total + (Number(o.amount_total) || 0));
    }
  }
  // deno-lint-ignore no-explicit-any
  const lines: any[] = await call(
    "pos.order.line",
    "search_read",
    [[["order_id", "in", orders.map((o) => o.id)]]],
    {
      fields: ["order_id", "product_id", "qty", "price_subtotal", "price_subtotal_incl"],
      limit: 50000,
    },
  );
  const productIds = [...new Set(lines.filter((l) => l.product_id).map((l) => l.product_id[0]))];
  const prod = new Map<
    number,
    { sku: string | null; dine: boolean; name: string; category: string }
  >();
  // deno-lint-ignore no-explicit-any
  const prods: any[] = [];
  for (let i = 0; i < productIds.length; i += 500) {
    prods.push(
      ...(await call("product.product", "read", [productIds.slice(i, i + 500)], {
        fields: ["default_code", "pos_categ_ids", "display_name", "categ_id"],
        context: { active_test: false },
      })),
    );
  }
  const catIds = [...new Set(prods.flatMap((p) => p.pos_categ_ids ?? []))];
  // deno-lint-ignore no-explicit-any
  const cats: any[] = catIds.length
    ? await call("pos.category", "read", [catIds], { fields: ["display_name"] })
    : [];
  const catName = new Map<number, string>(cats.map((c) => [c.id, String(c.display_name)]));
  for (const p of prods) {
    const names = (p.pos_categ_ids ?? []).map((i: number) => catName.get(i) ?? "");
    const categ = Array.isArray(p.categ_id) ? String(p.categ_id[1]) : "";
    prod.set(p.id, {
      sku: p.default_code ? String(p.default_code).trim() : null,
      dine: names.some((nm: string) => isDineCat(nm)),
      name: String(p.display_name ?? ""),
      category: categ.split("/").pop()?.trim() || "Other",
    });
  }
  const items: ItemSold[] = [];
  let tipsTotal = 0;
  // Line by line: sales and margin go to Dine-In or Retail by category.
  const value = new Map<number, { dine: number; retail: number }>();
  for (const l of lines) {
    const info = l.product_id ? prod.get(l.product_id[0]) : undefined;
    const gross = Number(l.price_subtotal_incl) || 0;
    // Tips are not sales (as in Shopify's reports): left out, counted apart.
    if (info && /^tips?$/i.test(info.name.trim())) {
      tipsTotal += gross;
      continue;
    }
    const b = info?.dine ? dineIn : retail;
    const net = Number(l.price_subtotal) || 0;
    b.total += gross;
    // Items sold (Retail only): for the category and best-seller lists.
    if (!info?.dine && info) {
      items.push({
        title: info.name,
        category: info.category,
        qty: Number(l.qty) || 0,
        sales: gross,
      });
    }
    const oid = Array.isArray(l.order_id) ? l.order_id[0] : l.order_id;
    const v = value.get(oid) ?? { dine: 0, retail: 0 };
    if (info?.dine) v.dine += gross;
    else v.retail += gross;
    value.set(oid, v);
    const cost = info?.sku ? bySku?.get(info.sku) : undefined;
    if (cost === undefined) {
      b.uncosted += gross;
      continue;
    }
    b.costedNet += net;
    b.margin += net - cost * (Number(l.qty) || 0);
  }
  // Each order is counted once, in the side that holds most of its value.
  const bucketOf = new Map<number, Bucket>();
  for (const o of orders) {
    const v = value.get(o.id) ?? { dine: 0, retail: 0 };
    const b = v.dine > v.retail ? dineIn : retail;
    bucketOf.set(o.id, b);
    b.orders += 1;
    if (!o.partner_id) b.noCustomer += 1;
  }
  // New customers: partners in these orders with no POS order before `since`.
  const partners = [...new Set(orders.filter((o) => o.partner_id).map((o) => o.partner_id[0]))];
  if (partners.length) {
    // deno-lint-ignore no-explicit-any
    const before: any[] = await call(
      "pos.order",
      "read_group",
      [
        [
          ["partner_id", "in", partners],
          ["date_order", "<", odooTime(since)],
        ],
        ["partner_id"],
        ["partner_id"],
      ],
      { lazy: false },
    );
    const seen = new Set(
      before.map((g) => (Array.isArray(g.partner_id) ? g.partner_id[0] : g.partner_id)),
    );
    for (const o of orders)
      if (o.partner_id && !seen.has(o.partner_id[0])) bucketOf.get(o.id)!.newCustomers += 1;
  }
  return { retail, dineIn, tills, hours, items, tips: r3(tipsTotal) };
}

/** An Odoo POS sale copied into Shopify by the "Odoo Connector" app. */
function isOdooConnector(o: { app?: { name?: string } | null }) {
  return (o.app?.name ?? "").toLowerCase().includes("odoo connector");
}

/** Which channel an order belongs to, from the Shopify app that created it. */
/** Placed on the Fyxx Friday site (friday.myfyxx.com): it checks out through the "Lovable" app. */
function isFridaySite(o: { app?: { name?: string } | null; customAttributes?: unknown }) {
  const app = (o.app?.name ?? "").toLowerCase();
  // deno-lint-ignore no-explicit-any
  const attrs = (Array.isArray(o.customAttributes) ? o.customAttributes : []) as any[];
  return app === "lovable" || attrs.some((a) => a?.key === "_bf_session");
}

function channelOf(o: {
  sourceName?: string | null;
  app?: { name?: string } | null;
  customAttributes?: unknown;
}) {
  const app = (o.app?.name ?? "").toLowerCase();
  const src = (o.sourceName ?? "").toLowerCase();
  // In store: Shopify POS (2025), Odoo POS (from 2026; its sales reach Shopify through
  // the "Odoo Connector" app).
  if (src === "pos" || app.includes("point of sale") || app.includes("odoo connector"))
    return "inStore";
  // The Fyxx Friday site counts as website (it was landing in "other").
  if (src === "web" || app === "online store" || isFridaySite(o)) return "website";
  if (app.includes("mobile app") || app.includes("appmaker")) return "app";
  if (src === "shopify_draft_order" || app.includes("draft") || app.includes("shopify mobile"))
    return "staff";
  return "other";
}

/**
 * All orders in the range (every channel), for the sales forecast on /admin.
 * Channels: website, app (Digital = both), inStore (Point of Sale), staff
 * (draft orders and orders made in the Shopify phone app), other.
 */
async function daySales(since: string, until: string) {
  const q = `created_at:>='${since}' AND created_at:<'${until}'`;
  const sum = bucket();
  const channels: Record<string, Bucket> = {
    website: bucket(),
    app: bucket(),
    inStore: bucket(),
    staff: bucket(),
    other: bucket(),
    // Odoo POS "Dine-In" till (from 2026).
    dineIn: bucket(),
  };
  // Part of "website": orders on the Fyxx Friday site only.
  const fridaySite = bucket();
  // Costs: if they can't be read, sales still work (margin shows as unknown).
  let costs: Awaited<ReturnType<typeof loadCosts>> | null = null;
  try {
    costs = await loadCosts();
  } catch (e) {
    console.error("[bf-admin] costs", String((e as Error).message).slice(0, 200));
  }
  const add = (b: Bucket, x: Bucket) => {
    for (const k of Object.keys(b) as Array<keyof Bucket>) b[k] += x[k];
  };
  // Free gifts given (final list, bf_ff26_foc): cost per Shopify order name.
  const giftCostOf = new Map<string, number>();
  try {
    const { data: gifts } = await db.from("bf_ff26_foc").select("order_name, sku, qty");
    for (const g of gifts ?? []) {
      const c = (costs?.bySku.get(String(g.sku).trim()) ?? 0) * (Number(g.qty) || 1);
      giftCostOf.set(g.order_name, (giftCostOf.get(g.order_name) ?? 0) + c);
    }
  } catch (e) {
    console.error("[bf-admin] gifts", String((e as Error).message).slice(0, 200));
  }
  // Shopify POS (2025 and before): Dine-In lines by vendor (bf_settings
  // shopify_dine_in_vendors, e.g. "Fyxx | The Green Room") or a corkage line.
  const { data: dv } = await db
    .from("bf_settings")
    .select("value")
    .eq("key", "shopify_dine_in_vendors")
    .maybeSingle();
  const dineVendors = (Array.isArray(dv?.value) ? dv.value : []).map((x: unknown) =>
    String(x).trim().toLowerCase(),
  );
  // deno-lint-ignore no-explicit-any
  const isDineLine = (li: any) =>
    dineVendors.includes(
      String(li.vendor ?? "")
        .trim()
        .toLowerCase(),
    ) || /corkage/i.test(String(li.title ?? ""));
  const items: ItemSold[] = [];
  // In-store from Odoo POS itself for days after the move to Odoo; if Odoo
  // can't be read, fall back to the Odoo Connector's copies in Shopify.
  let odoo: { retail: Bucket; dineIn: Bucket } | null = null;
  // Orders and sales per Amman hour, every channel (the forecast's hourly chart).
  const byHour = emptyHours();
  // Shopify orders cancelled (left out of sales) and orders changed after
  // they were placed (edits, refunds): change = current total minus placed total.
  const cancelled = { orders: 0, total: 0 };
  const edited = { orders: 0, change: 0 };
  let tips = 0;
  let odooTills: Record<string, { orders: number; total: number }> = {};
  let odooError: string | null = null;
  if (since >= ODOO_POS_FROM) {
    try {
      const r = await odooPos(since, until, costs?.bySku ?? null);
      odoo = { retail: r.retail, dineIn: r.dineIn };
      items.push(...r.items);
      tips = r3(tips + r.tips);
      r.hours.forEach((h, i) => {
        byHour[i].orders += h.orders;
        byHour[i].total = r3(byHour[i].total + h.total);
      });
      odooTills = r.tills;
    } catch (e) {
      odooError = String((e as Error).message).slice(0, 200);
      console.error("[bf-admin] odoo", odooError);
    }
  }
  const useOdoo = odoo !== null;
  if (odoo) {
    add(channels.inStore, odoo.retail);
    add(channels.dineIn, odoo.dineIn);
    add(sum, odoo.retail);
    add(sum, odoo.dineIn);
  }
  let after: string | null = null;
  for (let p = 0; p < MAX_PAGES * 5; p++) {
    // deno-lint-ignore no-explicit-any
    const d: any = await gql(DAY_SALES_QUERY, { q, after });
    for (const o of d.orders.nodes) {
      if (o.test) continue;
      if (o.cancelledAt) {
        // Left out of sales; shown on the dashboard as cancellations.
        cancelled.orders += 1;
        cancelled.total = r3(cancelled.total + (Number(o.totalPriceSet.shopMoney.amount) || 0));
        continue;
      }
      const one = bucket();
      one.orders = 1;
      // Current total: after order edits and refunds (what Shopify reports now).
      const placed = Number(o.totalPriceSet.shopMoney.amount) || 0;
      const current = Number(o.currentTotalPriceSet?.shopMoney?.amount ?? placed) || 0;
      // Tips are left out of sales, as in Shopify's own sales reports.
      const tip = Number(o.totalTipReceivedSet?.shopMoney?.amount) || 0;
      tips = r3(tips + tip);
      one.total = current - tip;
      if (Math.abs(placed - current) >= 0.001) {
        edited.orders += 1;
        edited.change = r3(edited.change + (current - placed));
      }
      // deno-lint-ignore no-explicit-any
      const member = (o.customAttributes ?? []).some(
        (a: any) => a.key === "_ff_member" && a.value === "1",
      );
      if (member) {
        one.memberOrders = 1;
        one.memberTotal = one.total;
      }
      // New customer: this order is the first order on their Shopify customer.
      if (!o.customer) one.noCustomer = 1;
      else if (o.customer.orders?.nodes?.[0]?.id === o.id) one.newCustomers = 1;
      // Free gifts given with this order: their cost comes off the margin.
      const giftCost = giftCostOf.get(o.name);
      if (giftCost !== undefined) {
        one.giftOrders = 1;
        one.giftCost = giftCost;
        one.margin -= giftCost;
      }
      // Shop orders are split into Retail and Dine-In lines (Shopify POS years).
      const pos = channelOf(o) === "inStore";
      const dinePart = bucket();
      let dinePaid = 0;
      let retailPaid = 0;
      const orderItems: ItemSold[] = [];
      for (const li of o.lineItems?.nodes ?? []) {
        const gross = Number(li.originalTotalSet?.shopMoney?.amount) || 0;
        const off = (li.discountAllocations ?? []).reduce(
          // deno-lint-ignore no-explicit-any
          (t: number, a: any) => t + (Number(a.allocatedAmountSet?.shopMoney?.amount) || 0),
          0,
        );
        // After every discount (incl. free gifts), for the quantity still on the
        // order after edits and refunds.
        const qty = Number(li.quantity) || 0;
        const cur = li.currentQuantity == null ? qty : Number(li.currentQuantity) || 0;
        const share = qty > 0 ? cur / qty : 1;
        const paid = Math.max(0, gross - off) * share;
        if (li.isGiftCard) {
          one.giftCards += paid;
          continue;
        }
        // A "Tip" line (Shopify POS) is a tip, not a sale.
        if (/^tips?$/i.test(String(li.title ?? "").trim())) {
          one.total -= paid;
          tips = r3(tips + paid);
          continue;
        }
        const dine = pos && isDineLine(li);
        if (dine) dinePaid += paid;
        else {
          retailPaid += paid;
          orderItems.push({
            title: String(li.title ?? ""),
            category: String(li.product?.productType ?? "").trim() || "Other",
            qty: cur,
            sales: paid,
          });
        }
        // Margin of Dine-In lines is kept apart, then moved to the Dine-In row.
        const tgt = dine ? dinePart : one;
        const sku = String(li.sku ?? li.variant?.sku ?? "").trim();
        const cost =
          (sku ? costs?.bySku.get(sku) : undefined) ??
          costs?.byVariant.get(String(li.variant?.legacyResourceId ?? ""));
        if (cost === undefined) {
          tgt.uncosted += paid;
          continue;
        }
        const net = paid / SALES_TAX;
        tgt.costedNet += net;
        tgt.margin += net - cost * cur;
      }
      // With Odoo POS read directly, the copies the Odoo Connector puts in
      // Shopify are left out (they would count the same till sales twice).
      if (useOdoo && isOdooConnector(o)) continue;
      items.push(...orderItems);
      const orderTotal = one.total;
      if (pos && dinePaid > 0) {
        // Sales split by line value; the order counts where most of its value is.
        const share = dinePaid / (dinePaid + retailPaid || 1);
        dinePart.total = one.total * share;
        one.total -= dinePart.total;
        if (dinePaid > retailPaid) {
          for (const k of ["orders", "newCustomers", "noCustomer", "memberOrders"] as const) {
            dinePart[k] = one[k];
            one[k] = 0;
          }
        }
        add(channels.dineIn, dinePart);
        add(sum, dinePart);
      }
      add(channels[channelOf(o)], one);
      if (isFridaySite(o)) add(fridaySite, one);
      add(sum, one);
      const hr = byHour[ammanHourOf(Date.parse(o.createdAt))];
      hr.orders += 1;
      hr.total = r3(hr.total + orderTotal);
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  const online = bucket();
  for (const k of ["website", "app", "staff", "other"]) add(online, channels[k]);
  const round = (b: Bucket) => {
    for (const k of Object.keys(b) as Array<keyof Bucket>) b[k] = r3(b[k]);
    return b;
  };
  for (const k of Object.keys(channels)) round(channels[k]);
  round(fridaySite);
  return {
    status: "ok",
    costsLoaded: costs !== null,
    inStoreSource: useOdoo ? "odoo_pos" : "shopify",
    odooTills,
    byHour,
    items: {
      byCategory: rollUp(items, (i) => i.category, 30),
      top: rollUp(items, (i) => i.title, 15),
    },
    cancelled,
    edited,
    tips,
    odooError,
    ...round(sum),
    online: round(online),
    inStore: channels.inStore,
    channels: { ...channels, fridaySite },
  };
}

// ── "Your usual": Klaviyo (read only) ──
const KLAVIYO_API = "https://a.klaviyo.com/api";
const ORDERED_PRODUCT = "SuKssc"; // Shopify "Ordered Product" metric

function klaviyoKey(): string | null {
  return Deno.env.get("KLAVIYO_PRIVATE_KEY") || Deno.env.get("KLAVIYO_API_KEY") || null;
}

async function klaviyoGet(path: string, key: string) {
  const r = await fetch(`${KLAVIYO_API}${path}`, {
    headers: {
      authorization: `Klaviyo-API-Key ${key}`,
      revision: "2025-01-15",
      accept: "application/vnd.api+json",
    },
  });
  if (!r.ok) throw new Error(`Klaviyo ${r.status}`);
  return await r.json();
}

/** Product IDs this shopper ordered most (then most recently), from Klaviyo. */
async function usualProducts(kx: string) {
  const key = klaviyoKey();
  if (!key) return { status: "not_configured" };
  const prof = await klaviyoGet(
    `/profiles?filter=${encodeURIComponent(`equals(_kx,"${kx}")`)}&fields[profile]=id`,
    key,
  );
  const id = prof?.data?.[0]?.id;
  if (!id) return { status: "ok", products: [] };
  const filter = `equals(metric_id,"${ORDERED_PRODUCT}"),equals(profile_id,"${id}")`;
  const ev = await klaviyoGet(
    `/events?filter=${encodeURIComponent(filter)}&fields[event]=datetime,event_properties&sort=-datetime&page[size]=200`,
    key,
  );
  const score = new Map<string, { n: number; last: number }>();
  for (const e of ev?.data ?? []) {
    const pid = e?.attributes?.event_properties?.ProductID;
    if (pid === undefined || pid === null) continue;
    const k = String(pid);
    const t = Date.parse(e.attributes.datetime) || 0;
    const s = score.get(k) ?? { n: 0, last: 0 };
    s.n += 1;
    s.last = Math.max(s.last, t);
    score.set(k, s);
  }
  const products = [...score.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)
    .slice(0, 40)
    .map(([k]) => k);
  return { status: "ok", products };
}

// ── Meta Ads (read only) ──
const META_API = "https://graph.facebook.com/v23.0";
const META_AD_ACCOUNT = "act_4226871230742646"; // "Fyxx Ads"
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

// deno-lint-ignore no-explicit-any
function pickAction(list: any[] | undefined): number {
  if (!Array.isArray(list)) return 0;
  for (const t of PURCHASE_TYPES) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

async function metaResults(sinceDay: string, untilDay: string) {
  const token = Deno.env.get("BLACK_FRIDAY_META_TOKEN");
  if (!token) return { status: "not_configured" };
  const acct = await fetch(
    `${META_API}/${META_AD_ACCOUNT}?fields=currency,name&access_token=${encodeURIComponent(token)}`,
  );
  const acctJson = await acct.json();
  if (acctJson.error)
    return { status: "error", message: String(acctJson.error.message).slice(0, 300) };
  const params = new URLSearchParams({
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
    time_range: JSON.stringify({ since: sinceDay, until: untilDay }),
    limit: "200",
    access_token: token,
  });
  // deno-lint-ignore no-explicit-any
  const campaigns: any[] = [];
  let url: string | null = `${META_API}/${META_AD_ACCOUNT}/insights?${params}`;
  for (let i = 0; url && i < 10; i++) {
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) return { status: "error", message: String(j.error.message).slice(0, 300) };
    for (const c of j.data ?? []) {
      campaigns.push({
        id: c.campaign_id,
        name: c.campaign_name,
        spend: Number(c.spend) || 0,
        impressions: Number(c.impressions) || 0,
        clicks: Number(c.clicks) || 0,
        purchases: pickAction(c.actions),
        purchase_value: pickAction(c.action_values),
      });
    }
    url = j.paging?.next ?? null;
  }
  return {
    status: "ok",
    currency: acctJson.currency ?? "USD",
    account: acctJson.name ?? "",
    campaigns,
  };
}

// ── AI summary through Lovable's AI gateway ──
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const AI_SYSTEM = `You are the marketing analyst for Fyxx, a wine, spirits and cigars shop in Amman, Jordan (prices in JOD).
You receive the final numbers of the "Fyxx Friday" Black Friday 2026 campaign as JSON.
Write a short report for the owner, who is not technical, in plain English:
1. "Headline": 2-3 sentences: total sales in the campaign period vs the period before, and how much revenue marketing generated.
2. "What worked": 3-5 bullets, each with the number that proves it.
3. "What didn't": 2-4 bullets, each with the number.
4. "Do next time": 3-5 concrete, practical recommendations.
Rules: use ONLY the numbers in the JSON, never invent or estimate numbers. If a section of data is missing or marked not available, say so in one short line instead of guessing. Money in JOD with no decimals (e.g. 12,340 JOD). Keep it under 350 words. Use markdown headings and bullets.`;

async function aiSummary(facts: unknown) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { status: "not_configured" };
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: AI_SYSTEM },
        { role: "user", content: JSON.stringify(facts).slice(0, 60_000) },
      ],
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok)
    return {
      status: "error",
      message: `AI gateway ${res.status}: ${JSON.stringify(j).slice(0, 200)}`,
    };
  const text = j.choices?.[0]?.message?.content;
  if (!text) return { status: "error", message: "AI gave no text" };
  return { status: "ok", text: String(text), model: AI_MODEL };
}

const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isIso = (v: unknown) =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const key = await getEdgeKey();
  if (!key || !(await sameString(String(body.key ?? ""), key)))
    return json({ error: "Not allowed" }, 403);

  if (body.action === "check_password") {
    const pw = Deno.env.get("BLACK_FRIDAY_ADMIN_PASSWORD") ?? "";
    if (pw.length < 8) return json({ configured: false, ok: false });
    const ok = await sameString(String(body.password ?? "").slice(0, 200), pw);
    if (!ok) await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ configured: true, ok });
  }

  if (body.action === "orders") {
    if (!isIso(body.since) || !isIso(body.until)) return json({ error: "Bad range" }, 400);
    if (!Deno.env.get("SHOPIFY_CLIENT_ID") || !Deno.env.get("SHOPIFY_CLIENT_SECRET")) {
      return json({ status: "not_configured" });
    }
    try {
      const since = new Date(body.since).toISOString();
      const until = new Date(body.until).toISOString();
      const { orders, afterVisit } = await siteOrders(since, until);
      return json({ status: "ok", orders, afterVisit });
    } catch (e) {
      console.error("[bf-admin]", String((e as Error).message));
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  if (body.action === "day_sales") {
    if (!isIso(body.since) || !isIso(body.until)) return json({ error: "Bad range" }, 400);
    if (!Deno.env.get("SHOPIFY_CLIENT_ID") || !Deno.env.get("SHOPIFY_CLIENT_SECRET")) {
      return json({ status: "not_configured" });
    }
    try {
      return json(
        await daySales(new Date(body.since).toISOString(), new Date(body.until).toISOString()),
      );
    } catch (e) {
      console.error("[bf-admin]", String((e as Error).message));
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  // Read-only check: Odoo POS paid sales in a range by till and product category
  // (Odoo product category and POS category), sales without tax and quantity.
  if (body.action === "odoo_pos_categories") {
    if (!isIso(body.since) || !isIso(body.until)) return json({ error: "Bad range" }, 400);
    try {
      const uid = await odooRpc("common", "authenticate", [ODOO_DB, ODOO_USER, ODOO_KEY, {}]);
      const call = (
        model: string,
        method: string,
        args: unknown[],
        kw: Record<string, unknown> = {},
      ) => odooRpc("object", "execute_kw", [ODOO_DB, uid, ODOO_KEY, model, method, args, kw]);
      // deno-lint-ignore no-explicit-any
      const orders: any[] = await call(
        "pos.order",
        "search_read",
        [
          [
            ["date_order", ">=", odooTime(body.since)],
            ["date_order", "<", odooTime(body.until)],
            ["state", "in", ["paid", "done", "invoiced"]],
          ],
        ],
        { fields: ["id", "config_id"], limit: 5000 },
      );
      const till = new Map(
        orders.map((o) => [o.id, Array.isArray(o.config_id) ? o.config_id[1] : "?"]),
      );
      // deno-lint-ignore no-explicit-any
      const lines: any[] = orders.length
        ? await call("pos.order.line", "search_read", [[["order_id", "in", [...till.keys()]]]], {
            fields: ["order_id", "product_id", "qty", "price_subtotal", "price_subtotal_incl"],
            limit: 50000,
          })
        : [];
      const pids = [...new Set(lines.filter((l) => l.product_id).map((l) => l.product_id[0]))];
      // deno-lint-ignore no-explicit-any
      const prods: any[] = pids.length
        ? await call("product.product", "read", [pids], {
            fields: ["categ_id", "pos_categ_ids"],
            context: { active_test: false },
          })
        : [];
      const posCatIds = [...new Set(prods.flatMap((p) => p.pos_categ_ids ?? []))];
      // deno-lint-ignore no-explicit-any
      const posCats: any[] = posCatIds.length
        ? await call("pos.category", "read", [posCatIds], { fields: ["display_name"] })
        : [];
      const posName = new Map(posCats.map((c) => [c.id, c.display_name]));
      const info = new Map(
        prods.map((p) => [
          p.id,
          {
            categ: Array.isArray(p.categ_id) ? p.categ_id[1] : "?",
            pos:
              (p.pos_categ_ids ?? []).map((i: number) => posName.get(i) ?? i).join(" + ") ||
              "(none)",
          },
        ]),
      );
      const out: Record<string, { lines: number; qty: number; net: number; gross: number }> = {};
      for (const l of lines) {
        const i = l.product_id ? info.get(l.product_id[0]) : undefined;
        const k = `${till.get(l.order_id[0])} || ${i?.pos ?? "?"} || ${i?.categ ?? "?"}`;
        out[k] ??= { lines: 0, qty: 0, net: 0, gross: 0 };
        out[k].lines += 1;
        out[k].qty += Number(l.qty) || 0;
        out[k].net = r3(out[k].net + (Number(l.price_subtotal) || 0));
        out[k].gross = r3(out[k].gross + (Number(l.price_subtotal_incl) || 0));
      }
      return json({ status: "ok", groups: out });
    } catch (e) {
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  // Read-only check: Odoo POS orders in a range by till and state (counts and totals).
  if (body.action === "odoo_pos_states") {
    if (!isIso(body.since) || !isIso(body.until)) return json({ error: "Bad range" }, 400);
    try {
      const uid = await odooRpc("common", "authenticate", [ODOO_DB, ODOO_USER, ODOO_KEY, {}]);
      const groups = await odooRpc("object", "execute_kw", [
        ODOO_DB,
        uid,
        ODOO_KEY,
        "pos.order",
        "read_group",
        [
          [
            ["date_order", ">=", odooTime(body.since)],
            ["date_order", "<", odooTime(body.until)],
          ],
          ["amount_total:sum"],
          ["config_id", "state"],
        ],
        { lazy: false },
      ]);
      return json({ status: "ok", groups });
    } catch (e) {
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  if (body.action === "probe") {
    return json({
      meta_token: !!Deno.env.get("BLACK_FRIDAY_META_TOKEN"),
      lovable_ai: !!Deno.env.get("LOVABLE_API_KEY"),
      admin_password: (Deno.env.get("BLACK_FRIDAY_ADMIN_PASSWORD") ?? "").length >= 8,
      shopify: !!Deno.env.get("SHOPIFY_CLIENT_ID") && !!Deno.env.get("SHOPIFY_CLIENT_SECRET"),
      klaviyo_private: !!Deno.env.get("KLAVIYO_PRIVATE_KEY"),
      klaviyo_api: !!Deno.env.get("KLAVIYO_API_KEY"),
      // Names only (never values) of any Klaviyo secret in this project.
      klaviyo_names: Object.keys(Deno.env.toObject()).filter((n) => /KLAVIYO/i.test(n)),
    });
  }

  if (body.action === "usual") {
    const kx = String(body.kx ?? "");
    if (!/^[A-Za-z0-9_\-.=]{6,200}$/.test(kx)) return json({ error: "Bad kx" }, 400);
    try {
      return json(await usualProducts(kx));
    } catch (e) {
      console.error("[bf-admin]", String((e as Error).message));
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  if (body.action === "meta") {
    if (!isDay(body.since) || !isDay(body.until)) return json({ error: "Bad range" }, 400);
    try {
      return json(await metaResults(body.since, body.until));
    } catch (e) {
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  if (body.action === "ai_summary") {
    try {
      return json(await aiSummary(body.facts ?? {}));
    } catch (e) {
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  return json({ error: "Unknown action" }, 400);
});
