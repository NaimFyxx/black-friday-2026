// Black Friday 2026 campaign settings. One place to change dates and names.
// Client-safe: no secrets here.

/** Shown in the admin and used to tag every analytics event. */
export const CAMPAIGN_LABEL = "Black Friday 2026";

/**
 * Campaign window (Amman time, UTC+3). The admin reports count visits and
 * orders from START up to (not including) END. Black Friday is Fri 27 Nov 2026;
 * the window covers the build-up week through Cyber Monday.
 * Change these if the campaign runs on different dates.
 */
export const CAMPAIGN_START = "2026-11-20T00:00:00+03:00";
export const CAMPAIGN_END = "2026-12-01T00:00:00+03:00";

/** Events the site records into Supabase (bf_events.event). */
export const TRACKED_EVENTS = ["visit", "view_item", "add_to_cart", "begin_checkout"] as const;
export type TrackedEventName = (typeof TRACKED_EVENTS)[number];

/** Cart attribute keys put on every Shopify cart (and so on every order). The
 *  leading underscore hides them from the shopper at checkout. */
export const CART_ATTR = {
  session: "_bf_session",
  source: "_utm_source",
  medium: "_utm_medium",
  campaign: "_utm_campaign",
  content: "_utm_content",
} as const;
