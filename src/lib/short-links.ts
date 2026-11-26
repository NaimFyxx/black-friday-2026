// Short links (friday.myfyxx.com/<slug>): shared, framework-free helpers used
// by the admin page, the server functions and the /:slug route. No server-only
// imports here, so this module is safe in the browser bundle.

export const SHORT_LINK_ORIGIN = "https://friday.myfyxx.com";

// Destinations may only stay on friday.myfyxx.com (a path) or point to the main
// store. Nothing else, so a short link can never bounce people to another site.
export const ALLOWED_ABSOLUTE_HOSTS = ["myfyxx.com", "www.myfyxx.com", "friday.myfyxx.com"];

export const DEFAULT_UTM_MEDIUM = "social";
export const DEFAULT_UTM_CAMPAIGN = "fyxx-friday-2026-11-27";

export type ShortLinkRow = {
  id: number;
  slug: string;
  destination_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
};

export type Utms = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
};

// ── Slugs ─────────────────────────────────────────────────────────────

/** Lowercase letters, numbers and dashes only (matches the DB check). */
export const SLUG_RE = /^[a-z0-9-]+$/;

/** Words that clash with real routes or would be confusing as a link. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "login",
  "logout",
  "api",
  "assets",
  "static",
  "public",
  "app",
  "index",
  "product",
  "products",
  "pairings",
  "cart",
  "checkout",
  "account",
  "favicon",
  "robots",
  "sitemap",
  "null",
  "undefined",
]);

/** Tidy a typed slug: trim, lowercase, drop any surrounding slashes. */
export function normalizeSlug(raw: string): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

/** Null when the slug is fine, otherwise a short reason to show the admin. */
export function slugError(slug: string): string | null {
  if (!slug) return "Add a short word for the link.";
  if (slug.length > 64) return "That slug is too long.";
  if (!SLUG_RE.test(slug)) return "Use lowercase letters, numbers and dashes only.";
  if (RESERVED_SLUGS.has(slug)) return "That word is reserved. Please pick another.";
  return null;
}

export function isValidSlug(slug: string): boolean {
  return slugError(slug) === null;
}

/** The full short URL to share, e.g. https://friday.myfyxx.com/wa */
export function shortLinkUrl(slug: string): string {
  return `${SHORT_LINK_ORIGIN}/${slug}`;
}

// ── Destinations ──────────────────────────────────────────────────────

/** Validate a destination: a path on friday.myfyxx.com, or a full https link
 *  on myfyxx.com / www.myfyxx.com. Returns a cleaned value or a reason. */
export function validateDestination(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const d = (raw ?? "").trim();
  if (!d) return { ok: false, error: "Add a destination." };
  if (d.length > 2048) return { ok: false, error: "That destination is too long." };

  // A path on the Friday site.
  if (d.startsWith("/")) {
    if (d.startsWith("//")) return { ok: false, error: "A path cannot start with two slashes." };
    if (/\s/.test(d)) return { ok: false, error: "A path cannot contain spaces." };
    try {
      new URL(d, SHORT_LINK_ORIGIN);
    } catch {
      return { ok: false, error: "That path is not valid." };
    }
    return { ok: true, value: d };
  }

  // A full link, allowed only on the main store.
  let u: URL;
  try {
    u = new URL(d);
  } catch {
    return { ok: false, error: "Enter a path starting with / or a full https:// link." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Full links must start with https://." };
  if (!ALLOWED_ABSOLUTE_HOSTS.includes(u.hostname.toLowerCase())) {
    return {
      ok: false,
      error: "Full links may only point to myfyxx.com or friday.myfyxx.com.",
    };
  }
  return { ok: true, value: u.toString() };
}

/** Build the final URL a short link sends people to: destination with the UTMs
 *  added. A path stays relative (so it never leaves friday.myfyxx.com); a full
 *  store link stays absolute. Returns null when the destination is not allowed. */
export function buildShortLinkTarget(destination: string, utms: Utms): string | null {
  const checked = validateDestination(destination);
  if (!checked.ok) return null;
  const dest = checked.value;
  const isPath = dest.startsWith("/");
  const url = new URL(dest, SHORT_LINK_ORIGIN);
  for (const [k, v] of Object.entries(utms)) {
    if (v && String(v).trim()) url.searchParams.set(k, String(v).trim());
  }
  return isPath ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}
