// UTM source tracking, ported from Fyxx Cup 2026.
//
// On landing we capture the utm_* params (plus ?from=app) and keep them in
// localStorage. FIRST-TOUCH: once a record is stored we never overwrite it, so
// the first campaign that brought the visitor in is the one credited. The stored
// source is sent with the GA `campaign_view` event and carried onto the Shopify
// checkout link so orders can be traced back to the ad / email / post.

export const UTM_STORAGE_KEY = "fyxx:utm";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** Capture utm_* params from the current URL. Called once on app mount. */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(UTM_STORAGE_KEY)) return; // first-touch wins
    const params = new URLSearchParams(window.location.search);
    const utm: UtmParams = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v && v.trim()) utm[k] = v.trim().slice(0, 200);
    }
    // Visitors from the FYXX app arrive with ?from=app instead of UTMs.
    if (!utm.utm_source && params.get("from") === "app") {
      utm.utm_source = "fyxx_app";
      utm.utm_medium = utm.utm_medium ?? "app";
    }
    if (Object.keys(utm).length > 0) {
      window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    // storage/URL unavailable - attribution is a best-effort extra.
  }
}

export function getStoredUtm(): UtmParams | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as UtmParams) : null;
  } catch {
    return null;
  }
}

export function clearStoredUtm(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Add the stored first-touch UTMs to a URL (e.g. the Shopify checkout link). */
export function withStoredUtm(url: string): string {
  const utm = getStoredUtm();
  if (!utm) return url;
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(utm)) {
      if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}
