// Friendly names for where a visit or order came from (utm_source / utm_medium).
// Display only: the tracking values themselves are never changed.
//
// Every /admin page uses describeSource (or describeSourceText for the
// "source / medium / campaign" strings in the campaign report), so the same
// raw value reads the same everywhere. Unknown values are shown as they are,
// never hidden.

export type SourceKind = "paid" | "free" | "unknown";

export type SourceLabel = {
  /** e.g. "Instagram ads" */
  name: string;
  kind: SourceKind;
  /** The raw tracking value, e.g. "ig / paid-social" (empty when there was none). */
  raw: string;
};

/** Exact source + medium pairs (lower case). */
const PAIRS: Record<string, { name: string; kind: SourceKind }> = {
  "ig|paid-social": { name: "Instagram ads", kind: "paid" },
  "instagram|paid-social": { name: "Instagram ads", kind: "paid" },
  "fb|paid-social": { name: "Facebook ads", kind: "paid" },
  "facebook|paid-social": { name: "Facebook ads", kind: "paid" },
  "meta|paid-social": { name: "Facebook and Instagram ads", kind: "paid" },
  "klaviyo|email": { name: "Email (Klaviyo)", kind: "free" },
  "klaviyo|sms": { name: "SMS (Klaviyo)", kind: "free" },
  "fyxx-app|app-banner": { name: "Fyxx app banner", kind: "free" },
  "fyxx_app|app": { name: "Fyxx app link", kind: "free" },
  "instagram|story": { name: "Instagram story (our page)", kind: "free" },
  "instagram|social": { name: "Instagram post or bio (our page)", kind: "free" },
  "facebook|social": { name: "Facebook post (our page)", kind: "free" },
  "calendar|reminder": { name: "Calendar reminder (our link)", kind: "free" },
  "google|organic": { name: "Google search", kind: "free" },
  "google|cpc": { name: "Google ads", kind: "paid" },
};

/** Source alone, when the medium is new to us. */
const SOURCES: Record<string, string> = {
  ig: "Instagram",
  instagram: "Instagram",
  fb: "Facebook",
  facebook: "Facebook",
  meta: "Facebook and Instagram",
  klaviyo: "Klaviyo",
  "fyxx-app": "Fyxx app",
  fyxx_app: "Fyxx app",
  google: "Google",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

const PAID_MEDIUMS = new Set([
  "paid-social",
  "paid_social",
  "paidsocial",
  "paid",
  "cpc",
  "ppc",
  "cpm",
  "display",
  "ads",
]);
const FREE_MEDIUMS = new Set([
  "email",
  "sms",
  "social",
  "story",
  "organic",
  "app",
  "app-banner",
  "reminder",
  "push",
  "bio",
]);

/** Values that mean "nothing recorded" (ours and Google Analytics'). */
const EMPTY = new Set(["", "(none)", "(direct)", "(not set)", "none", "null"]);

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase();
  return EMPTY.has(s) ? null : s;
}

/** "l.instagram.com" -> "instagram.com" */
function siteName(host: string): string {
  return host.replace(/^(www|l|lm|m|mobile)\./, "");
}

function rawText(source: string | null | undefined, medium: string | null | undefined): string {
  return [source, medium].filter((x) => x && x.trim()).join(" / ");
}

/**
 * Friendly name and Paid / Free / Unknown for one source + medium.
 * With no source, our tracking puts the referring site (or "direct") in
 * medium, so "From instagram.com" is shown when a site is known.
 */
export function describeSource(
  source: string | null | undefined,
  medium: string | null | undefined,
): SourceLabel {
  const raw = rawText(source, medium);
  const s = clean(source);
  const m = clean(medium);

  if (!s) {
    // A referring site recorded in place of the medium, e.g. "instagram.com".
    if (m && m !== "direct" && m.includes(".")) {
      return { name: `From ${siteName(m)}`, kind: "unknown", raw };
    }
    return { name: "Direct or unknown", kind: "unknown", raw };
  }

  // Google Analytics style "l.instagram.com / referral".
  if (s.includes(".") && (!m || m === "referral")) {
    return { name: `From ${siteName(s)}`, kind: "unknown", raw };
  }

  const pair = PAIRS[`${s}|${m ?? ""}`];
  if (pair) return { ...pair, raw };

  const kind: SourceKind = m
    ? PAID_MEDIUMS.has(m)
      ? "paid"
      : FREE_MEDIUMS.has(m)
        ? "free"
        : "unknown"
    : "unknown";
  const known = SOURCES[s];
  if (known) {
    const suffix = kind === "paid" ? " ads" : m ? ` (${m})` : "";
    return { name: `${known}${suffix}`, kind, raw };
  }
  // Unknown source: show the value itself, readable.
  return { name: m ? `${source?.trim()} (${m})` : (source?.trim() ?? ""), kind, raw };
}

/**
 * Same, for the joined strings in the campaign report:
 * "ig / paid-social / fyxx-friday-2026-11-27", "(direct / none) / instagram.com",
 * or Google Analytics' "google / organic".
 */
export function describeSourceText(text: string): SourceLabel {
  let t = text.trim();
  let source: string | null = null;
  if (t.startsWith("(direct / none)")) {
    t = t.slice("(direct / none)".length).replace(/^\s*\/\s*/, "");
  } else {
    const [first, ...rest] = t.split(" / ");
    source = first ?? null;
    t = rest.join(" / ");
  }
  const medium = t.split(" / ")[0] || null;
  const label = describeSource(source, medium);
  return { ...label, raw: text };
}

/** Campaign tag in plain words: both Fyxx Friday tags read "Fyxx Friday". */
export function describeCampaign(campaign: string | null | undefined): string {
  const c = (campaign ?? "").trim();
  if (!c || EMPTY.has(c.toLowerCase())) return "";
  return c.toLowerCase().includes("fyxx-friday") ? "Fyxx Friday" : c;
}

export const KIND_LABEL: Record<SourceKind, string> = {
  paid: "Paid",
  free: "Free",
  unknown: "Unknown",
};
