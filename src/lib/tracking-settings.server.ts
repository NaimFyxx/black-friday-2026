// Server-only: should this request be tracked?
//
// Two switches, both controlled from /admin → Tracking:
//  1. Site-wide: bf_settings.tracking_enabled (true/false) in Supabase. Turns
//     GA4, Meta Pixel, Klaviyo, Clarity and the bf_events log on or off for
//     everyone. If the bf_settings table doesn't exist yet, tracking is ON.
//  2. This device: a `bf_no_track=1` cookie. Excludes one browser (yours,
//     Lori's) while everyone else is still tracked.

import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const NO_TRACK_COOKIE = "bf_no_track";
const SETTING_KEY = "tracking_enabled";
const CACHE_MS = 15_000;

let cache: { value: boolean; setup: "ok" | "missing"; at: number } | null = null;

type Loose = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

async function db(): Promise<Loose> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Loose;
}

function isMissing(err: { message: string; code?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    /does not exist|could not find/i.test(err.message)
  );
}

/** The site-wide switch (cached briefly so page loads stay fast). */
export async function getSiteTracking(
  fresh = false,
): Promise<{ enabled: boolean; setup: "ok" | "missing" | "error" }> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return { enabled: cache.value, setup: cache.setup };
  }
  try {
    const client = await db();
    const { data, error } = await client
      .from("bf_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    if (isMissing(error)) {
      cache = { value: true, setup: "missing", at: Date.now() };
      return { enabled: true, setup: "missing" };
    }
    if (error) throw new Error(error.message);
    // No row yet = on.
    const enabled = data ? data.value !== false : true;
    cache = { value: enabled, setup: "ok", at: Date.now() };
    return { enabled, setup: "ok" };
  } catch {
    // Can't read the setting (e.g. env not configured): fail open so a
    // database hiccup on Black Friday doesn't silently stop all tracking.
    return { enabled: true, setup: "error" };
  }
}

export async function setSiteTracking(enabled: boolean): Promise<void> {
  const client = await db();
  const { error } = await client
    .from("bf_settings")
    .upsert({ key: SETTING_KEY, value: enabled, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = { value: enabled, setup: "ok", at: Date.now() };
}

export function isDeviceExcluded(): boolean {
  try {
    return getCookie(NO_TRACK_COOKIE) === "1";
  } catch {
    return false;
  }
}

export function setDeviceExcluded(excluded: boolean): void {
  if (excluded) {
    setCookie(NO_TRACK_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  } else {
    deleteCookie(NO_TRACK_COOKIE, { path: "/" });
  }
}

/** Should this request be tracked at all? */
export async function shouldTrack(): Promise<boolean> {
  if (isDeviceExcluded()) return false;
  return (await getSiteTracking()).enabled;
}
