// Server-only: talk to the `bf-admin` Supabase Edge Function.
//
// Why: this site runs on Lovable, which can't see secrets saved in the shared
// Supabase project (BLACK_FRIDAY_ADMIN_PASSWORD, Pulse's SHOPIFY_*). The edge
// function can, so the site asks it (source: supabase/functions/bf-admin).
// Both sides prove who they are with bf_settings.edge_key, which never leaves
// the servers.

type Loose = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

const cache = new Map<string, { value: string; at: number }>();
const CACHE_MS = 5 * 60_000;

/** A text value from bf_settings (cached), e.g. edge_key, admin_session_secret. */
export async function getBfSetting(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as unknown as Loose)
    .from("bf_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const value = typeof data?.value === "string" ? data.value : null;
  if (value) cache.set(key, { value, at: Date.now() });
  return value;
}

export async function callBfAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const base = process.env["SUPABASE_URL"];
  if (!base) throw new Error("SUPABASE_URL is not set");
  const key = await getBfSetting("edge_key");
  if (!key) throw new Error("bf_settings.edge_key is missing");
  const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/bf-admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, key }),
  });
  if (!res.ok) throw new Error(`bf-admin returned ${res.status}`);
  return (await res.json()) as T;
}
