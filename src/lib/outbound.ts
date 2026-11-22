// "What goes out": visitors leaving the Friday site for myfyxx.com or the app.
//
// 1. Every click on a link to myfyxx.com (not this site) or to the app (the
//    onelink / App Store / Google Play links) is logged ("outbound" event in
//    bf_events + GA4 outbound_click). Links are NOT given UTM tags: both sites
//    share the GA4 property and Meta pixel with the same visitor cookie, so
//    tags would only replace the visitor's real source (e.g. an Instagram ad)
//    with "the Friday site" in GA4 and Shopify reports.
// 2. A first-party cookie `fyxx_friday` on .myfyxx.com (30 days) records that
//    this browser visited the Friday site and where it first came from. A small
//    snippet in the myfyxx.com Shopify theme (docs/shopify-theme-fyxx-friday.md)
//    copies it onto the cart there as hidden attributes (_bf_visit...), so
//    website orders after a Friday visit can be counted in /admin.

import { trackOutbound } from "@/lib/analytics";
import { getFirstReferrer, getFirstTouchUtm } from "@/lib/utm-attribution";

const APP_HOSTS = ["onelink.to", "apps.apple.com", "play.google.com"];

function destinationOf(url: URL): "website" | "app" | null {
  const host = url.hostname.toLowerCase();
  if (APP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return "app";
  if (host === "myfyxx.com" || host === "www.myfyxx.com") {
    // Checkout pages are part of buying on this site, not leaving it.
    if (url.pathname.startsWith("/checkouts") || url.pathname.startsWith("/cart")) return null;
    return "website";
  }
  return null;
}

/** Listen for clicks on outbound links (whole page, once). */
export function startOutboundTracking(): void {
  if (typeof window === "undefined") return;
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      const destination = destinationOf(url);
      if (!destination) return;
      const label = (a.dataset["outLabel"] || a.textContent || "").trim().slice(0, 80) || "link";
      trackOutbound(destination, label, url.toString());
    },
    true,
  );
}

const COOKIE = "fyxx_friday";

/** Remember this visit on .myfyxx.com for the main store (30 days). */
export function writeVisitCookie(sessionId: string): void {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  if (!(host === "myfyxx.com" || host.endsWith(".myfyxx.com"))) return; // local test copies
  if (/(?:^|;\s*)bf_preview=/.test(document.cookie)) return; // the team's own visits
  try {
    let first = new Date().toISOString();
    const old = /(?:^|;\s*)fyxx_friday=([^;]+)/.exec(document.cookie)?.[1];
    if (old) {
      const prev = JSON.parse(decodeURIComponent(old)) as { first?: string };
      if (prev.first) first = prev.first;
    }
    const utm = getFirstTouchUtm() ?? {};
    const value = {
      sid: sessionId.slice(0, 64),
      src: utm.utm_source ?? "",
      med: utm.utm_source ? (utm.utm_medium ?? "") : (getFirstReferrer() ?? ""),
      camp: utm.utm_campaign ?? "",
      first,
      last: new Date().toISOString(),
    };
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; domain=.myfyxx.com; path=/; max-age=${30 * 86400}; samesite=lax; secure`;
  } catch {
    // best-effort
  }
}
