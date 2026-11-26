// Fyxx Rewards passwordless login (email code). Thin browser client for the
// `ff-rewards-auth` edge function in Project Pulse, which does the Shopify
// customer check, emails the 6-digit code, verifies it and mints the session.
// The code / Shopify Admin token / Resend key never touch the browser.
//
// Flow: lookupEmail -> sendCode -> verifyCode (which also sets the Supabase
// session via supabase.auth.verifyOtp). Ported from Fyxx Cup 2026.

import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/ff-rewards-auth`;
const KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

async function callFn(payload: Record<string, unknown>): Promise<{
  status: number;
  data: Record<string, unknown>;
}> {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

export interface EmailLookup {
  exists: boolean;
  firstName: string | null;
  lastName: string | null;
  /** Shopify account is "enabled" (password set) -> a full rewards member. */
  activated: boolean;
}

/** Does this email already have a Fyxx account? Source of truth is Shopify. */
export async function lookupEmail(email: string): Promise<EmailLookup> {
  try {
    const { data } = await callFn({ action: "lookup", email });
    return {
      exists: !!data["exists"],
      firstName: (data["firstName"] as string | null) ?? null,
      lastName: (data["lastName"] as string | null) ?? null,
      activated: data["activated"] === true,
    };
  } catch {
    // Never block sign-in on the check: fall back to the "create" path.
    return { exists: false, firstName: null, lastName: null, activated: false };
  }
}

/** Email a fresh 6-digit code to this address. */
export async function sendCode(email: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { status, data } = await callFn({ action: "send", email });
    if (status === 200 && data["ok"] === true) return { ok: true };
    return { ok: false, reason: (data["error"] as string) ?? "send_failed" };
  } catch {
    return { ok: false, reason: "send_failed" };
  }
}

export interface VerifyInput {
  email: string;
  code: string;
  /** New users only (collected by the sheet). */
  firstName?: string;
  lastName?: string;
  phone?: string;
  acceptsMarketing?: boolean;
}

/**
 * Verify the code; on success this ALSO establishes the Supabase session in the
 * browser (no second email is sent). Returns whether the account was new and
 * whether their Shopify account is already activated.
 */
export async function verifyCode(
  input: VerifyInput,
): Promise<{ ok: boolean; isNew?: boolean; activated?: boolean; reason?: string }> {
  let status: number;
  let data: Record<string, unknown>;
  try {
    ({ status, data } = await callFn({ action: "verify", ...input }));
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
  if (status !== 200 || data["ok"] !== true) {
    return { ok: false, reason: (data["error"] as string) ?? "invalid_or_expired" };
  }
  // Set the session from the one-time token the function minted.
  const { error } = await supabase.auth.verifyOtp({
    token_hash: data["token_hash"] as string,
    type: data["type"] as "magiclink",
  } as Parameters<typeof supabase.auth.verifyOtp>[0]);
  if (error) return { ok: false, reason: "session_error" };
  return { ok: true, isNew: !!data["isNew"], activated: data["activated"] === true };
}

/** Re-send the Shopify "set a password" activation email. */
export async function resendInvite(email: string): Promise<{ ok: boolean }> {
  try {
    const { status, data } = await callFn({ action: "resend_invite", email });
    return { ok: status === 200 && data["ok"] === true };
  } catch {
    return { ok: false };
  }
}

/**
 * Server-side: put the signed-in member's email + phone + default address on the
 * cart so Shopify checkout pre-fills their details. Authenticated with the
 * member's own Supabase token, and the address is read + applied server-side, so
 * it never reaches the browser. Returns true on success.
 */
export async function prefillCheckout(cartId: string): Promise<boolean> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token || !cartId) return false;
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "prefill_checkout", cartId }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.status === 200 && data["ok"] === true;
  } catch {
    return false;
  }
}
