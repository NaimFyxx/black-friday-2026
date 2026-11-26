// ff-rewards-auth - Fyxx Friday passwordless login (email code), ported from
// Fyxx Cup 2026. Actions: lookup (Shopify customer check), send (email a 6-digit
// code), verify (check code -> mint a Supabase session + ensure Shopify customer).
// Holds all secrets in Project Pulse: service role, Shopify client-credentials,
// Resend. The web app only calls this and then sets the session client-side.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const SHOP = Deno.env.get("SHOPIFY_STORE");
const API_VERSION = "2026-10";
const FROM = "Fyxx <info@myfyxx.com>";
const PARTICIPANT_TAG = "black-friday-2026";
// Storefront API (public token) used to set the cart buyer identity server-side
// so the customer's address never reaches the browser.
const STOREFRONT_URL = `https://${SHOP}/api/${API_VERSION}/graphql.json`;
const STOREFRONT_TOKEN = "6bdaffcdd3b82d66838dff6365ead6cd";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS = 3;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

const norm = (e: string) => (e ?? "").trim().toLowerCase();
function genCode(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1_000_000).padStart(6, "0");
}
async function hashCode(email: string, code: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SERVICE_ROLE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${email}:${code}`));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function tse(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---- Shopify (client-credentials, same pattern as the other Pulse functions) ----
// Cache the app token but refresh it every few minutes, so a scope change on the
// app (e.g. adding write_customers) is picked up without a redeploy.
let shopToken = "";
let shopTokenAt = 0;
const TOKEN_TTL_MS = 5 * 60 * 1000;
async function shopTokenGet(): Promise<string> {
  if (shopToken && Date.now() - shopTokenAt < TOKEN_TTL_MS) return shopToken;
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("SHOPIFY_CLIENT_ID"),
      client_secret: Deno.env.get("SHOPIFY_CLIENT_SECRET"),
      grant_type: "client_credentials",
    }),
  });
  const j = await r.json();
  shopToken = j.access_token ?? "";
  shopTokenAt = Date.now();
  return shopToken;
}
async function shopGql(query: string, variables: Record<string, unknown> = {}) {
  const token = await shopTokenGet();
  const r = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  return j;
}
async function shopRest(path: string, init: RequestInit = {}) {
  const token = await shopTokenGet();
  return fetch(`https://${SHOP}/admin/api/${API_VERSION}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token, ...(init.headers ?? {}) },
  });
}
async function sfGql(query: string, variables: Record<string, unknown>) {
  const r = await fetch(STOREFRONT_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  return await r.json();
}
function gidNum(gid: string): number | null {
  const m = /\/(\d+)$/.exec(gid ?? "");
  return m ? Number(m[1]) : null;
}
// Shopify's Customer.state enum comes back UPPERCASE ("ENABLED" / "DISABLED" /
// "INVITED" / "DECLINED"). "Enabled" means a full, activated account (a
// non-guest in LoyaltyLion, so it earns points). Compare case-insensitively:
// a lowercase "enabled" check silently reports every member as not activated.
function isEnabled(state: string | null | undefined): boolean {
  return (state ?? "").toUpperCase() === "ENABLED";
}
type Cust = { id: number | null; firstName: string | null; lastName: string | null; state: string | null };
async function findCustomer(email: string): Promise<Cust | null> {
  const j = await shopGql(
    `query($q:String!){ customers(first:1, query:$q){ edges{ node{ id firstName lastName state } } } }`,
    { q: `email:${email}` },
  );
  const node = j?.data?.customers?.edges?.[0]?.node;
  if (!node) return null;
  return { id: gidNum(node.id), firstName: node.firstName ?? null, lastName: node.lastName ?? null, state: node.state ?? null };
}
async function createCustomer(email: string, firstName: string, lastName: string, acceptsMarketing: boolean): Promise<Cust | null> {
  const input: Record<string, unknown> = { email, tags: [PARTICIPANT_TAG] };
  if (firstName) input.firstName = firstName;
  if (lastName) input.lastName = lastName;
  if (acceptsMarketing) input.emailMarketingConsent = { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" };
  const j = await shopGql(
    `mutation($input:CustomerInput!){ customerCreate(input:$input){ customer{ id firstName lastName state } userErrors{ field message } } }`,
    { input },
  );
  const errs = j?.data?.customerCreate?.userErrors ?? j?.errors;
  const node = j?.data?.customerCreate?.customer;
  if (!node) {
    console.error("[ff-auth] customerCreate failed", JSON.stringify(errs ?? j).slice(0, 400));
    return null;
  }
  return { id: gidNum(node.id), firstName: node.firstName ?? null, lastName: node.lastName ?? null, state: node.state ?? null };
}
async function sendInvite(customerId: number): Promise<boolean> {
  try {
    const res = await shopRest(`/customers/${customerId}/send_invite.json`, { method: "POST", body: JSON.stringify({ customer_invite: {} }) });
    return res.ok;
  } catch {
    return false;
  }
}
// Normalize a typed phone to E.164 (store is Jordan): "07..." -> "+9627...",
// "00..." -> "+...", a bare international number -> "+...".
function normPhone(p: string): string {
  let s = (p ?? "").replace(/[\s()\-.]/g, "");
  if (!s) return "";
  if (s.startsWith("00")) s = "+" + s.slice(2);
  else if (s.startsWith("0")) s = "+962" + s.slice(1);
  else if (!s.startsWith("+") && /^\d+$/.test(s)) s = "+" + s;
  return s;
}
// Best-effort: set the phone on a customer. Never blocks sign-up (a bad or
// duplicate phone is a soft failure).
async function setPhone(customerId: number, phone: string): Promise<boolean> {
  const e164 = normPhone(phone);
  if (!e164) return false;
  try {
    const j = await shopGql(
      `mutation($input:CustomerInput!){ customerUpdate(input:$input){ userErrors{ message } } }`,
      { input: { id: `gid://shopify/Customer/${customerId}`, phone: e164 } },
    );
    return !(j?.data?.customerUpdate?.userErrors?.length || j?.errors);
  } catch {
    return false;
  }
}

// ---- Resend ----
function otpHtml(code: string): string {
  return `<div style="background-color:#ffffff;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <p style="font-size:14px;color:#555;margin:0 0 12px;">Your Fyxx Rewards sign-in code</p>
  <p style="font-size:36px;font-weight:bold;letter-spacing:6px;color:#000;margin:0 0 24px;">${code}</p>
  <p style="font-size:14px;color:#555;margin:0;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
</div>`;
}
async function sendMail(to: string, code: string): Promise<{ ok: boolean; detail?: string }> {
  const key = Deno.env.get("RESEND_API_KEY") ?? Deno.env.get("FYXX_RESEND_KEY");
  if (!key) return { ok: false, detail: "no_resend_key" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: FROM, to, subject: "Your Fyxx Rewards code", html: otpHtml(code) }),
  });
  if (!r.ok) return { ok: false, detail: (await r.text()).slice(0, 200) };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const email = norm(body.email ?? "");

    if (action === "_scopes") {
      const token = await shopTokenGet();
      const r = await fetch(`https://${SHOP}/admin/oauth/access_scopes.json`, { headers: { "X-Shopify-Access-Token": token } });
      const j = await r.json().catch(() => ({}));
      return json({ hasToken: !!token, scopes: (j.access_scopes ?? []).map((s: { handle?: string }) => s.handle) });
    }

    // Pre-fill checkout for a signed-in member: verify THEIR Supabase token,
    // read THEIR email + default address from Shopify (Admin), and set it on the
    // cart via the Storefront API. The address never reaches the browser.
    if (action === "prefill_checkout") {
      const authz = req.headers.get("authorization") ?? "";
      const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
      const { data: ures } = await db.auth.getUser(token);
      const userEmail = (ures?.user?.email ?? "").toLowerCase();
      if (!userEmail) return json({ ok: false, reason: "unauthorized" }, 401);
      const cartId = String(body.cartId ?? "");
      if (!cartId.startsWith("gid://shopify/Cart/")) return json({ ok: false, reason: "bad_cart" }, 400);
      const cj = await shopGql(
        `query($q:String!){ customers(first:1, query:$q){ edges{ node{ phone defaultAddress{ firstName lastName address1 address2 city province zip country phone } } } } }`,
        { q: `email:${userEmail}` },
      );
      const n = cj?.data?.customers?.edges?.[0]?.node;
      const a = n?.defaultAddress;
      const bi: Record<string, unknown> = { email: userEmail };
      const phone = n?.phone ?? a?.phone;
      if (phone) bi.phone = phone;
      if (a && (a.address1 || a.city)) {
        const da: Record<string, unknown> = {};
        const fields: Record<string, unknown> = {
          firstName: a.firstName, lastName: a.lastName, address1: a.address1, address2: a.address2,
          city: a.city, province: a.province, country: a.country, zip: a.zip, phone: a.phone ?? phone,
        };
        for (const k of Object.keys(fields)) if (fields[k]) da[k] = fields[k];
        bi.deliveryAddressPreferences = [{ deliveryAddress: da }];
      }
      const M = `mutation($cartId:ID!,$bi:CartBuyerIdentityInput!){ cartBuyerIdentityUpdate(cartId:$cartId, buyerIdentity:$bi){ userErrors{ message } } }`;
      const sf = await sfGql(M, { cartId, bi });
      const errs = sf?.data?.cartBuyerIdentityUpdate?.userErrors ?? sf?.errors;
      if (errs?.length) {
        console.error("[ff-auth] prefill buyerIdentity", JSON.stringify(errs).slice(0, 300));
        await sfGql(M, { cartId, bi: { email: userEmail } }).catch(() => {});
        return json({ ok: true, partial: true });
      }
      return json({ ok: true, hadAddress: !!bi.deliveryAddressPreferences });
    }

    if (!email || !email.includes("@")) return json({ error: "bad_email" }, 400);

    if (action === "lookup") {
      const c = await findCustomer(email).catch((e) => { console.error("[ff-auth] lookup", String(e)); return null; });
      return json({ exists: !!c, firstName: c?.firstName ?? null, lastName: c?.lastName ?? null, activated: isEnabled(c?.state) });
    }

    // Re-send the Shopify account-activation invite (the "set a password" email),
    // for a signed-in member who has not activated yet.
    if (action === "resend_invite") {
      const c = await findCustomer(email).catch(() => null);
      if (!c?.id) return json({ ok: false, reason: "not_found" }, 404);
      if (isEnabled(c.state)) return json({ ok: true, alreadyActivated: true });
      const ok = await sendInvite(c.id);
      return json({ ok });
    }

    if (action === "send") {
      const windowStart = new Date(Date.now() - SEND_WINDOW_MS).toISOString();
      const { count } = await db.from("email_otps").select("id", { count: "exact", head: true }).eq("email", email).gt("created_at", windowStart);
      if ((count ?? 0) >= MAX_SENDS) return json({ error: "rate_limited" }, 429);
      await db.from("email_otps").update({ consumed_at: new Date().toISOString() }).eq("email", email).is("consumed_at", null);
      const code = genCode();
      const code_hash = await hashCode(email, code);
      const expires_at = new Date(Date.now() + CODE_TTL_MS).toISOString();
      const { error: insErr } = await db.from("email_otps").insert({ email, code_hash, expires_at });
      if (insErr) { console.error("[ff-auth] insert", insErr.message); return json({ error: "send_failed" }, 500); }
      const sent = await sendMail(email, code);
      if (!sent.ok) { console.error("[ff-auth] mail", sent.detail); return json({ error: "send_failed", detail: sent.detail }, 502); }
      return json({ ok: true });
    }

    if (action === "verify") {
      const code = String(body.code ?? "");
      if (!/^\d{6}$/.test(code)) return json({ error: "invalid" }, 400);
      const { data: row } = await db.from("email_otps").select("id, code_hash, expires_at, attempts").eq("email", email).is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!row) return json({ error: "invalid_or_expired" }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "invalid_or_expired" }, 400);
      if (row.attempts >= MAX_ATTEMPTS) return json({ error: "too_many_attempts" }, 429);
      const candidate = await hashCode(email, code);
      if (!tse(candidate, row.code_hash)) {
        await db.from("email_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
        return json({ error: "invalid_or_expired" }, 400);
      }
      await db.from("email_otps").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

      // Look up the Shopify customer once: used both for the returning-member
      // name (so the UI can greet them) and to decide whether to create one.
      const existing = await findCustomer(email).catch(() => null);

      // New users give their name in the sheet; returning members get it from
      // their Shopify customer, so a returning member is always greeted by name.
      const firstName = String(body.firstName ?? "").trim().slice(0, 50) || (existing?.firstName ?? "");
      const lastName = String(body.lastName ?? "").trim().slice(0, 50) || (existing?.lastName ?? "");
      const phone = String(body.phone ?? "").trim().slice(0, 32);
      const acceptsMarketing = body.acceptsMarketing === true;
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const meta: Record<string, unknown> = {};
      if (fullName) { meta.full_name = fullName; meta.name = fullName; }
      if (firstName) meta.first_name = firstName;
      if (lastName) meta.last_name = lastName;
      if (acceptsMarketing) meta.accepts_marketing = true;

      const createdRes = await db.auth.admin.createUser({ email, email_confirm: true, ...(Object.keys(meta).length ? { user_metadata: meta } : {}) }).catch(() => null);
      const isNew = !!createdRes?.data?.user;

      const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: "magiclink", email });
      if (linkErr || !link?.properties?.hashed_token) { console.error("[ff-auth] generateLink", linkErr?.message); return json({ error: "session_error" }, 500); }

      // Existing auth user (createUser was a no-op): backfill the name onto their
      // profile if it is missing, so the greeting works. Runs before the client
      // sets the session, so the minted session reflects it.
      try {
        const u = link.user as { id?: string; user_metadata?: Record<string, unknown> } | undefined;
        const cur = (u?.user_metadata ?? {}) as Record<string, unknown>;
        const hasName = (typeof cur.first_name === "string" && cur.first_name.trim()) ||
          (typeof cur.full_name === "string" && cur.full_name.trim());
        if (!isNew && u?.id && !hasName && Object.keys(meta).length) {
          await db.auth.admin.updateUserById(u.id, { user_metadata: { ...cur, ...meta } });
        }
      } catch (e) { console.error("[ff-auth] name backfill", String(e)); }

      let shopify: { created: boolean; invited: boolean } = { created: false, invited: false };
      try {
        if (!existing) {
          const c = await createCustomer(email, firstName, lastName, acceptsMarketing);
          if (c?.id) {
            if (phone) await setPhone(c.id, phone);
            const invited = await sendInvite(c.id);
            shopify = { created: true, invited };
          }
        }
      } catch (e) { console.error("[ff-auth] shopify ensure", String(e)); }

      // Activated = their Shopify account is "enabled" (password set). New
      // customers start disabled until they use the activation invite.
      const activated = isEnabled(existing?.state);

      let type = "magiclink";
      try { type = new URL(link.properties.action_link).searchParams.get("type") ?? "magiclink"; } catch { /* keep */ }
      return json({ ok: true, token_hash: link.properties.hashed_token, type, isNew, shopify, activated });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    shopToken = "";
    return json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, 500);
  }
});
