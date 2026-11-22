// UTM source tracking, ported from Fyxx Cup 2026.
//
// Two records in localStorage:
// - "fyxx:utm" is LAST TOUCH: every page load whose URL has utm_* params or
//   fbclid overwrites it. It goes onto the Shopify cart (attributes) and the
//   checkout link, so orders show the campaign and Meta ad that sold them.
// - "fyxx:utm_first" is FIRST TOUCH: written once, never overwritten. The
//   site's own event log (bf_events) and the GA campaign_view keep using it.

export const UTM_STORAGE_KEY = "fyxx:utm";
export const UTM_FIRST_KEY = "fyxx:utm_first";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;
export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function read(key: string): UtmParams | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as UtmParams) : null;
  } catch {
    return null;
  }
}

/** Capture utm_* params and fbclid from the current URL. Called on every page load. */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    // Visitors from before the split: their stored record was first touch.
    const existing = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (existing && !window.localStorage.getItem(UTM_FIRST_KEY)) {
      window.localStorage.setItem(UTM_FIRST_KEY, existing);
    }
    const params = new URLSearchParams(window.location.search);
    const utm: UtmParams = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v && v.trim()) utm[k] = v.trim().slice(0, 500);
    }
    // Visitors from the FYXX app arrive with ?from=app instead of UTMs.
    if (!utm.utm_source && params.get("from") === "app") {
      utm.utm_source = "fyxx_app";
      utm.utm_medium = utm.utm_medium ?? "app";
    }
    if (Object.keys(utm).length === 0) return;
    const json = JSON.stringify(utm);
    window.localStorage.setItem(UTM_STORAGE_KEY, json); // last touch wins
    if (!window.localStorage.getItem(UTM_FIRST_KEY)) {
      window.localStorage.setItem(UTM_FIRST_KEY, json); // first touch, once
    }
  } catch {
    // storage/URL unavailable - attribution is a best-effort extra.
  }
}

/** Last touch: the most recent campaign that brought the visitor in. */
export function getStoredUtm(): UtmParams | null {
  return read(UTM_STORAGE_KEY);
}

/** First touch: the first campaign that ever brought the visitor in. */
export function getFirstTouchUtm(): UtmParams | null {
  return read(UTM_FIRST_KEY) ?? read(UTM_STORAGE_KEY);
}

export function clearStoredUtm(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(UTM_STORAGE_KEY);
    window.localStorage.removeItem(UTM_FIRST_KEY);
  } catch {
    // ignore
  }
}

/** Add the last-touch UTMs and fbclid to a URL (the Shopify checkout link). */
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

// ── Referrer (for visitors without UTMs) ──────────────────────────────

export const REFERRER_FIRST_KEY = "fyxx:ref_first";

/**
 * First touch: the site this browser first arrived from (hostname, e.g.
 * "instagram.com", "l.facebook.com", "google.com") or "direct" (typed,
 * bookmark, WhatsApp and most apps send nothing). Written once, on the first
 * page load ever; the dashboard shows it for visits without utm_source.
 */
export function captureReferrer(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(REFERRER_FIRST_KEY)) return;
    let ref = "direct";
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname.replace(/^www\./, "")) ref = host;
    }
    window.localStorage.setItem(REFERRER_FIRST_KEY, ref.slice(0, 100));
  } catch {
    // no storage: nothing to remember
  }
}

export function getFirstReferrer(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(REFERRER_FIRST_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
