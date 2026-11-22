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
        id name createdAt cancelledAt
        customAttributes { key value }
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { numberOfOrders }
      }
    }
  }
`;

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
            source: attr.get("_bf_visit_source") || null,
            medium: attr.get("_bf_visit_medium") || null,
            campaign: attr.get("_bf_visit_campaign") || null,
            firstVisit: attr.get("_bf_visit_first") || null,
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
        utm_source: attr.get("_utm_source") || null,
        // No UTM tags: the referring site (instagram.com, direct...) takes the
        // medium's place, the same rule the Sources page uses for visits.
        utm_medium: attr.get("_utm_source")
          ? attr.get("_utm_medium") || null
          : attr.get("_bf_referrer") || null,
        utm_campaign: attr.get("_utm_campaign") || null,
        utm_content: attr.get("_utm_content") || null,
        isFirstOrder: Number.isFinite(n) ? n <= 1 : null,
      });
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return { orders, afterVisit };
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

  if (body.action === "probe") {
    return json({
      meta_token: !!Deno.env.get("BLACK_FRIDAY_META_TOKEN"),
      lovable_ai: !!Deno.env.get("LOVABLE_API_KEY"),
      admin_password: (Deno.env.get("BLACK_FRIDAY_ADMIN_PASSWORD") ?? "").length >= 8,
      shopify: !!Deno.env.get("SHOPIFY_CLIENT_ID") && !!Deno.env.get("SHOPIFY_CLIENT_SECRET"),
    });
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
