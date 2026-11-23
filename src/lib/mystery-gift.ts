// Mystery gifts from The Green Room: a gift unlocks every GIFT_STEP JOD of cart
// total, with no upper limit. Shared by the cart tracker, the floating cart bar
// and the "unlocked" message. Visual only: no coupon is made or applied.

/** A new mystery gift every this many JOD. */
export const GIFT_STEP = 50;
/** Markers shown on the bar at a time (4 x 50 = a 200 JOD stretch). */
export const GIFT_MARKERS = 4;

/** Where the cart total stands: gifts unlocked, the next marker and the bar. */
export function giftProgress(subtotal: number) {
  const total = Math.max(0, subtotal);
  const unlocked = Math.floor(total / GIFT_STEP + 1e-9);
  const next = (unlocked + 1) * GIFT_STEP;
  const left = Math.round((next - total) * 1000) / 1000;
  // The bar slides with the cart: it starts at the last gift unlocked and
  // shows the next markers after it (at 167.5: 150, 200, 250, 300), so it
  // never ends on a fixed number.
  const span = GIFT_STEP * GIFT_MARKERS;
  const base = Math.max(0, (unlocked - 1) * GIFT_STEP);
  const markers = Array.from({ length: GIFT_MARKERS }, (_, i) => base + (i + 1) * GIFT_STEP);
  const pct = Math.min(100, Math.max(0, ((total - base) / span) * 100));
  return { unlocked, next, left, markers, base, span, pct };
}

/** Close the cart and go back to the products. */
export function shopMore(close: (open: boolean) => void) {
  close(false);
  window.setTimeout(() => {
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 250);
}
