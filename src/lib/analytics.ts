// Client-side analytics helpers (GA4 + Meta Pixel).
//
// Ported from the Fyxx Cup 2026 and Valentine's 2026 campaign sites. Every GA
// event is tagged with `promo_name: "fyxx-friday-2026-11-27"` so Fyxx Friday data
// is easy to filter in the shared GA4 property (Christmas, Valentine's and Fyxx
// Cup report to the same Measurement ID). The trackers are loaded deferred in
// __root.tsx; these helpers no-op safely before then (calls queue on the stubs).
//
// Visits, product views, add-to-carts and checkouts are ALSO saved to Supabase
// (bf_events) with the visitor's first-touch source, for the /admin dashboards.

import type { TrackedEventName } from "@/lib/campaign-config";
import { primaryImage, type ShopifyProductNode } from "@/lib/shopify";
import { recordEvent } from "@/lib/track.functions";
import { getFirstReferrer, getFirstTouchUtm } from "@/lib/utm-attribution";
import { cartToken } from "@/lib/cart-token";
import { useCartStore } from "@/stores/cartStore";

export const CAMPAIGN_NAME = "black_friday_2026";
/** Label on every GA4 event. Not campaign_name: that would override the real
 *  UTM campaign in GA4 reports. */
export const GA_PROMO_NAME = "fyxx-friday-2026-11-27";

type EventParams = Record<string, unknown>;

type TrackerWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  klaviyo?: {
    push?: (args: unknown[]) => void;
    isIdentified?: () => Promise<boolean>;
  };
  _klOnsite?: unknown[][];
};

function tw(): TrackerWindow | null {
  return typeof window === "undefined" ? null : (window as TrackerWindow);
}

/** Fire a GA4 event, always tagged with the campaign for easy filtering. */
export function trackEvent(name: string, params: EventParams = {}): void {
  tw()?.gtag?.("event", name, { promo_name: GA_PROMO_NAME, ...params });
}

/** Fire a standard Meta Pixel event (AddToCart, InitiateCheckout, ...).
 *  NEVER "Purchase": the Shopify Facebook & Instagram app fires it on
 *  checkout with the same pixel, so firing it here would double count. */
export function trackPixel(name: string, params: EventParams = {}): void {
  if (name === "Purchase") return;
  tw()?.fbq?.("track", name, params);
}

/** Send an event to Klaviyo (klaviyo.js). Klaviyo loads a few seconds after
 *  the page, so until then events wait in its _klOnsite queue, which
 *  klaviyo.js reads when it loads. Klaviyo only keeps events for shoppers it
 *  already knows (came from a Klaviyo email, or signed up on a Klaviyo form). */
function trackKlaviyo(name: string, props: EventParams): void {
  const w = tw();
  if (!w || trackingOff()) return;
  try {
    if (typeof w.klaviyo?.push === "function") w.klaviyo.push(["track", name, props]);
    else (w._klOnsite = w._klOnsite || []).push(["track", name, props]);
  } catch {
    // never break the add to cart over analytics
  }
}

/** Meta PageView for a client-side page change (the first is in the base code). */
export function trackPixelPageView(): void {
  tw()?.fbq?.("track", "PageView");
}

/** Meta wants the plain Shopify variant ID: gid://shopify/ProductVariant/123 -> "123". */
export function shopifyVariantId(id: string): string {
  return id.split("/").pop() ?? id;
}

/** Pixel currency is always JOD; values as numbers rounded to fils. */
const PIXEL_CURRENCY = "JOD";
const money = (v: number) => Math.round(v * 1000) / 1000;

// ── Supabase event log (for /admin) ──────────────────────────────────

const SESSION_KEY = "fyxx:bf_session";
const VISIT_KEY = "fyxx:bf_visit_logged";

/** A random ID for this browser tab session; ties events + the order together. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

const VISITOR_KEY = "fyxx:bf_visitor";
const VISITOR_COOKIE = "fyxx_vid";
const VISITOR_RE = /^[A-Za-z0-9-]{8,64}$/;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Anonymous visitor ID: one random number per browser, kept for 400 days, so
 * /admin can tell visits from visitors and see who comes back. Nothing
 * personal is in it. Kept in localStorage and in a first-party cookie
 * (fyxx_vid, on .myfyxx.com) so clearing one of them doesn't lose it.
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const fromCookie = new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`).exec(
      document.cookie,
    )?.[1];
    let id = fromCookie && VISITOR_RE.test(fromCookie) ? fromCookie : null;
    if (!id) {
      const stored = window.localStorage.getItem(VISITOR_KEY);
      id = stored && VISITOR_RE.test(stored) ? stored : newId();
    }
    window.localStorage.setItem(VISITOR_KEY, id);
    if (!fromCookie || fromCookie !== id || !window.sessionStorage.getItem(`${VISITOR_KEY}:c`)) {
      // Refresh the cookie once per tab session (keeps the 400 days rolling).
      const host = window.location.hostname;
      const domain =
        host === "myfyxx.com" || host.endsWith(".myfyxx.com") ? "; domain=.myfyxx.com" : "";
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${VISITOR_COOKIE}=${id}${domain}; path=/; max-age=${400 * 86400}; samesite=lax${secure}`;
      window.sessionStorage.setItem(`${VISITOR_KEY}:c`, "1");
    }
    return id;
  } catch {
    return "";
  }
}

/** True when /admin switched tracking off for this visitor (set in __root). */
export function trackingOff(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { __bfTrackingOff?: boolean }).__bfTrackingOff === true
  );
}

/** Save one event to Supabase. Fire-and-forget: never blocks or throws. */
function logEvent(
  event: TrackedEventName,
  extra: {
    value?: number;
    currency?: string;
    itemCount?: number;
    product?: TrackedItem;
    items?: TrackedItem[];
    /** outbound: "website" | "app" and which link was clicked. */
    destination?: string;
    linkLabel?: string;
  } = {},
) {
  if (typeof window === "undefined" || trackingOff()) return;
  const sessionId = getSessionId();
  if (sessionId.length < 8) return;
  // First touch, without fbclid (same fields as always).
  const { fbclid: _fbclid, ...utm } = getFirstTouchUtm() ?? {};
  recordEvent({
    data: {
      event,
      sessionId,
      visitorId: getVisitorId() || undefined,
      path: window.location.pathname,
      ...utm,
      referrer: getFirstReferrer(),
      fromApp: utm.utm_source === "fyxx_app",
      value: extra.value !== undefined && Number.isFinite(extra.value) ? extra.value : undefined,
      currency: extra.currency,
      itemCount: extra.itemCount,
      // Which product (view / add to cart) or which lines (checkout), for the report.
      variantId: extra.product ? shopifyVariantId(extra.product.id) : undefined,
      productTitle: extra.product?.name ?? extra.linkLabel,
      destination: extra.destination,
      productHandle: extra.product?.handle,
      items: extra.items?.map((i) => ({
        variant_id: shopifyVariantId(i.id),
        title: i.name.slice(0, 200),
        qty: i.quantity,
        price: i.price,
      })),
    },
  }).catch(() => {});
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
  const { fbclid: _fbclid, ...firstTouch } = getFirstTouchUtm() ?? {};
  trackEvent("campaign_view", { ...firstTouch });
  // Count one "visit" per browser session in Supabase.
  // Tracking off for this page load: don't mark the visit as logged, so a
  // reload after tracking is switched back on still counts it.
  if (trackingOff()) return;
  try {
    if (window.sessionStorage.getItem(VISIT_KEY)) return;
    window.sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    // no storage: still log, may double count
  }
  logEvent("visit");
}

// ── Shop events (GA4 ecommerce + Meta Pixel) ──────────────────────────

export type TrackedItem = {
  id: string; // Shopify variant ID
  name: string;
  handle?: string; // Shopify product handle
  variant?: string;
  price: number;
  currency: string;
  quantity: number;
};

function gaItem(i: TrackedItem) {
  return {
    // Plain variant number, as Meta and Shopify's own GA4 data use.
    item_id: shopifyVariantId(i.id),
    item_name: i.name,
    item_variant: i.variant,
    price: i.price,
    quantity: i.quantity,
  };
}

/** A product page was opened. */
let lastView: { id: string; at: number } | null = null;
export function trackViewItem(item: TrackedItem): void {
  // Ignore a repeat for the same product within 2s (React can re-run effects).
  const now = Date.now();
  if (lastView && lastView.id === item.id && now - lastView.at < 2000) return;
  lastView = { id: item.id, at: now };
  trackEvent("view_item", {
    currency: item.currency,
    value: item.price,
    items: [gaItem(item)],
  });
  trackPixel("ViewContent", {
    content_ids: [shopifyVariantId(item.id)],
    content_name: item.name,
    content_type: "product",
    value: money(item.price),
    currency: PIXEL_CURRENCY,
  });
  logEvent("view_item", {
    value: item.price,
    currency: item.currency,
    itemCount: 1,
    product: item,
  });
}

/** An item was added to the cart. */
export function trackAddToCart(item: TrackedItem): void {
  const value = item.price * item.quantity;
  trackEvent("add_to_cart", { currency: item.currency, value, items: [gaItem(item)] });
  trackPixel("AddToCart", {
    content_ids: [shopifyVariantId(item.id)],
    content_name: item.name,
    content_type: "product",
    value: money(value),
    currency: PIXEL_CURRENCY,
  });
  logEvent("add_to_cart", {
    value,
    currency: item.currency,
    itemCount: item.quantity,
    product: item,
  });
  trackKlaviyoAddedToCart(item);
}

/** Tell Klaviyo who this visitor is (they typed their email in a site form),
 *  so their Added to Cart events from now on are kept on their profile.
 *  Queued like events, so it runs before any event sent after it. */
export function identifyKlaviyo(email: string): void {
  const w = tw();
  if (!w) return;
  try {
    const cmd = ["identify", { email }];
    if (typeof w.klaviyo?.push === "function") w.klaviyo.push(cmd);
    else (w._klOnsite = w._klOnsite || []).push(cmd);
  } catch {
    // never break the form over analytics
  }
}

/** Right after identify: send the current cart again as "Added to Cart", so
 *  items added before the visitor gave their email reach Klaviyo too. */
export function resendKlaviyoCart(): void {
  const items = useCartStore.getState().items;
  const last = items[items.length - 1];
  if (!last) return;
  trackKlaviyoAddedToCart({
    id: last.variantId,
    name: last.product.node.title,
    handle: last.product.node.handle,
    variant: last.variantTitle,
    price: Number(last.price.amount) || 0,
    currency: last.price.currencyCode,
    quantity: last.quantity,
  });
}

/** Klaviyo "Added to Cart" in Klaviyo's recommended format, with the whole
 *  cart, so a Klaviyo flow can email the shopper what they left behind.
 *  Call AFTER the cart store was updated, so the new item is included. */
function trackKlaviyoAddedToCart(item: TrackedItem): void {
  if (typeof window === "undefined") return;
  const origin = window.location.origin;
  const url = (handle?: string) => (handle ? `${origin}/product/${handle}` : origin);
  const cart = useCartStore.getState();
  const lines = cart.items.map((i) => {
    const price = Number(i.price.amount) || 0;
    return {
      ProductID: shopifyVariantId(i.product.node.id),
      VariantID: shopifyVariantId(i.variantId),
      ProductName: i.product.node.title,
      VariantName: i.variantTitle || undefined,
      Quantity: i.quantity,
      ItemPrice: money(price),
      RowTotal: money(price * i.quantity),
      ProductURL: url(i.product.node.handle),
      ImageURL: primaryImage(i.product.node)?.url,
      ProductCategories: i.product.node.productType ? [i.product.node.productType] : [],
    };
  });
  const added = cart.items.find((i) => i.variantId === item.id);
  trackKlaviyo("Added to Cart", {
    $value: money(lines.reduce((sum, l) => sum + l.RowTotal, 0)),
    AddedItemProductName: item.name,
    AddedItemProductID: added ? shopifyVariantId(added.product.node.id) : undefined,
    AddedItemVariantID: shopifyVariantId(item.id),
    AddedItemVariantName: item.variant || undefined,
    AddedItemPrice: money(item.price),
    AddedItemQuantity: item.quantity,
    AddedItemURL: url(item.handle),
    AddedItemImageURL: added ? primaryImage(added.product.node)?.url : undefined,
    AddedItemCategories: added?.product.node.productType ? [added.product.node.productType] : [],
    ItemNames: lines.map((l) => l.ProductName),
    Items: lines,
    // From the Storefront API cart response (never built by hand).
    CheckoutURL: cart.checkoutUrl ?? undefined,
    // For the email's restore link: friday.myfyxx.com/?cart=<CartID> (URL-safe).
    CartID: cartToken(cart.cartId),
    Currency: PIXEL_CURRENCY,
    campaign_name: CAMPAIGN_NAME,
  });
}

/** The shopper clicked Checkout. */
export function trackBeginCheckout(items: TrackedItem[]): Promise<void> {
  const first = items[0];
  if (!first) return Promise.resolve();
  const currency = first.currency;
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Checkout opens in this tab: resolve once GA4 has sent begin_checkout (or
  // after ~1 s at most), so the page doesn't leave before the hit goes out.
  const sent = new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    setTimeout(finish, 1200);
    const gtag = tw()?.gtag;
    if (!gtag) return finish();
    gtag("event", "begin_checkout", {
      promo_name: GA_PROMO_NAME,
      currency,
      value,
      items: items.map(gaItem),
      transport_type: "beacon",
      event_callback: finish,
      event_timeout: 1000,
    });
  });
  trackPixel("InitiateCheckout", {
    content_ids: items.map((i) => shopifyVariantId(i.id)),
    content_type: "product",
    num_items: items.reduce((n, i) => n + i.quantity, 0),
    value: money(value),
    currency: PIXEL_CURRENCY,
  });
  logEvent("begin_checkout", {
    value,
    currency,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    items,
  });
  return sent;
}

/** A click that leaves the Friday site (to myfyxx.com or the app). */
export function trackOutbound(destination: "website" | "app", label: string, url: string): void {
  trackEvent("outbound_click", { destination, link_text: label, link_url: url.slice(0, 300) });
  logEvent("outbound", { destination, linkLabel: label });
}

// ── Fyxx Rewards 2x points (tier points) ──────────────────────────────
// Where the shopper opened the tiers or tapped a button. Stored in the
// bf_events `destination` column (reused: it is free text, and the outbound
// report reads it only for the "outbound" event).
export type TierPointsWhere = "home" | "product" | "cart";

/** The shopper opened the Fyxx Rewards tiers (home, product or cart). */
export function trackTierPointsOpen(where: TierPointsWhere): void {
  trackEvent("tier_points_open", { where });
  logEvent("tier_points_open", { destination: where });
}

/** The shopper tapped "Join Fyxx Rewards". */
export function trackTierPointsJoinTap(where: TierPointsWhere): void {
  trackEvent("tier_points_join_tap", { where });
  logEvent("tier_points_join_tap", { destination: where });
}

/** The shopper tapped "Log in to collect your points" / "Log in". */
export function trackTierPointsLoginTap(where: TierPointsWhere): void {
  trackEvent("tier_points_login_tap", { where });
  logEvent("tier_points_login_tap", { destination: where });
}

/**
 * Klaviyo "Viewed Product" on a product page, in the same format as Klaviyo's
 * Shopify integration, so segments can use what people looked at. Sent only
 * when klaviyo.js knows the visitor (Klaviyo drops anonymous events anyway).
 */
export function trackKlaviyoViewedProduct(
  product: ShopifyProductNode,
  variant: {
    id: string;
    title: string;
    price: { amount: string };
    compareAtPrice?: { amount: string } | null;
  },
): void {
  const w = tw();
  if (!w || trackingOff()) return;
  const price = Number(variant.price.amount) || 0;
  const cmp = variant.compareAtPrice ? Number(variant.compareAtPrice.amount) || 0 : 0;
  const url = `${window.location.origin}/product/${product.handle}`;
  const image = primaryImage(product)?.url;
  const categories = product.productType ? [product.productType] : [];
  const props = {
    Name: product.title,
    ProductID: shopifyVariantId(product.id),
    VariantID: shopifyVariantId(variant.id),
    VariantName: variant.title && variant.title !== "Default Title" ? variant.title : undefined,
    Categories: categories,
    ImageURL: image,
    URL: url,
    Brand: product.vendor || undefined,
    Price: money(price),
    CompareAtPrice: cmp > price ? money(cmp) : undefined,
  };
  const viewed = {
    Title: product.title,
    ItemId: shopifyVariantId(product.id),
    Categories: categories,
    ImageUrl: image,
    Url: url,
    Metadata: { Brand: props.Brand, Price: props.Price, CompareAtPrice: props.CompareAtPrice },
  };
  const send = () => {
    trackKlaviyo("Viewed Product", props);
    try {
      if (typeof w.klaviyo?.push === "function") w.klaviyo.push(["trackViewedItem", viewed]);
    } catch {
      // analytics never breaks the page
    }
  };
  const k = w.klaviyo;
  if (typeof k?.isIdentified === "function") {
    k.isIdentified()
      .then((known) => {
        if (known) send();
      })
      .catch(() => {});
  } else {
    send(); // klaviyo.js not loaded yet: queued, and kept only for a known visitor
  }
}
