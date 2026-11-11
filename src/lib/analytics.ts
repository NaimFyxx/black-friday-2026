// Client-side analytics helpers (GA4 + Meta Pixel).
//
// Ported from the Fyxx Cup 2026 and Valentine's 2026 campaign sites. Every GA
// event is tagged with `campaign_name: "black_friday_2026"` so Black Friday data
// is easy to filter in the shared GA4 property (Christmas, Valentine's and Fyxx
// Cup report to the same Measurement ID). The trackers are loaded deferred in
// __root.tsx; these helpers no-op safely before then (calls queue on the stubs).

import { getStoredUtm } from "@/lib/utm-attribution";

export const CAMPAIGN_NAME = "black_friday_2026";

type EventParams = Record<string, unknown>;

type TrackerWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

function tw(): TrackerWindow | null {
  return typeof window === "undefined" ? null : (window as TrackerWindow);
}

/** Fire a GA4 event, always tagged with the campaign for easy filtering. */
export function trackEvent(name: string, params: EventParams = {}): void {
  tw()?.gtag?.("event", name, { campaign_name: CAMPAIGN_NAME, ...params });
}

/** Fire a standard Meta Pixel event (AddToCart, InitiateCheckout, ...). */
export function trackPixel(name: string, params: EventParams = {}): void {
  tw()?.fbq?.("track", name, params);
}

// ── Generic campaign helpers (from Fyxx Cup + Valentine's) ────────────

/** Call-to-action click. `ctaType` identifies the button, e.g. "browse_cellar". */
export function trackCtaClick(ctaType: string, params: EventParams = {}): void {
  trackEvent("cta_click", { cta_type: ctaType, ...params });
}

/** Navigation link clicks (header, footer, category chips, ...). */
export function trackNavClick(navItem: string, label: string, params: EventParams = {}): void {
  trackEvent("campaign_nav_click", { nav_item: navItem, nav_label: label, ...params });
}

/** Promotional banner / card taps. */
export function trackPromoClick(
  promoName: string,
  promoType: string,
  destinationUrl?: string,
): void {
  trackEvent("campaign_promo_click", {
    promo_name: promoName,
    promo_type: promoType,
    destination_url: destinationUrl,
  });
}

/** Form submissions (email capture, raffle entry, ...). */
export function trackFormSubmit(formName: string, extras: EventParams = {}): void {
  trackEvent("campaign_form_submit", { form_name: formName, ...extras });
}

/** Share button interactions. */
export function trackShare(method: string, contentName: string): void {
  trackEvent("campaign_share", { method, content_name: contentName });
}

/** Fire once per page load to tag the session, with the first-touch source. */
export function trackCampaignView(): void {
  trackEvent("campaign_view", { ...(getStoredUtm() ?? {}) });
}

// ── Shop events (GA4 ecommerce + Meta Pixel) ──────────────────────────

export type TrackedItem = {
  id: string; // Shopify variant ID
  name: string;
  variant?: string;
  price: number;
  currency: string;
  quantity: number;
};

function gaItem(i: TrackedItem) {
  return {
    item_id: i.id,
    item_name: i.name,
    item_variant: i.variant,
    price: i.price,
    quantity: i.quantity,
  };
}

/** A product page was opened. */
export function trackViewItem(item: TrackedItem): void {
  trackEvent("view_item", {
    currency: item.currency,
    value: item.price,
    items: [gaItem(item)],
  });
  trackPixel("ViewContent", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price,
    currency: item.currency,
  });
}

/** An item was added to the cart. */
export function trackAddToCart(item: TrackedItem): void {
  const value = item.price * item.quantity;
  trackEvent("add_to_cart", { currency: item.currency, value, items: [gaItem(item)] });
  trackPixel("AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value,
    currency: item.currency,
  });
}

/** The shopper clicked Checkout. */
export function trackBeginCheckout(items: TrackedItem[]): void {
  const first = items[0];
  if (!first) return;
  const currency = first.currency;
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  trackEvent("begin_checkout", { currency, value, items: items.map(gaItem) });
  trackPixel("InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    num_items: items.reduce((n, i) => n + i.quantity, 0),
    value,
    currency,
  });
}
