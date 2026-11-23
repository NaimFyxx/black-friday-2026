// Mystery gifts from The Green Room: spend markers and helpers shared by the
// cart tracker and the floating cart bar. Visual only: no coupon is made.

export const GIFT_THRESHOLDS = [50, 100, 150, 200]; // JOD

/** Where the cart total stands against the mystery gift markers. */
export function giftProgress(subtotal: number) {
  const max = GIFT_THRESHOLDS[GIFT_THRESHOLDS.length - 1] ?? 200;
  const next = GIFT_THRESHOLDS.find((t) => subtotal < t);
  const unlocked = GIFT_THRESHOLDS.filter((t) => subtotal >= t).length;
  const left = next !== undefined ? Math.round((next - subtotal) * 1000) / 1000 : 0;
  const pct = Math.min(100, (subtotal / max) * 100);
  return { max, next, unlocked, left, pct };
}

/** Close the cart and go back to the products. */
export function shopMore(close: (open: boolean) => void) {
  close(false);
  window.setTimeout(() => {
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 250);
}
