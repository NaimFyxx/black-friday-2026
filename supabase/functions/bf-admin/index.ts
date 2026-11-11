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
  let after: string | null = null;
  for (let p = 0; p < MAX_PAGES; p++) {
    // deno-lint-ignore no-explicit-any
    const d: any = await gql(ORDERS_QUERY, { q, after });
    for (const o of d.orders.nodes) {
      const attr = new Map<string, string>(
        // deno-lint-ignore no-explicit-any
        o.customAttributes.map((a: any) => [a.key, a.value ?? ""]),
      );
      if (!attr.has("_bf_session")) continue; // not placed through the Black Friday site
      const n = o.customer ? Number(o.customer.numberOfOrders) : NaN;
      orders.push({
        id: o.id,
        name: o.name,
        createdAt: o.createdAt,
        total: Number(o.totalPriceSet.shopMoney.amount) || 0,
        currency: o.totalPriceSet.shopMoney.currencyCode,
        cancelled: o.cancelledAt != null,
        utm_source: attr.get("_utm_source") || null,
        utm_medium: attr.get("_utm_medium") || null,
        utm_campaign: attr.get("_utm_campaign") || null,
        utm_content: attr.get("_utm_content") || null,
        isFirstOrder: Number.isFinite(n) ? n <= 1 : null,
      });
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return orders;
}

const isIso = (v: unknown) => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const key = await getEdgeKey();
  if (!key || !(await sameString(String(body.key ?? ""), key))) return json({ error: "Not allowed" }, 403);

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
      return json({ status: "ok", orders: await siteOrders(since, until) });
    } catch (e) {
      console.error("[bf-admin]", String((e as Error).message));
      return json({ status: "error", message: String((e as Error).message).slice(0, 300) });
    }
  }

  return json({ error: "Unknown action" }, 400);
});
