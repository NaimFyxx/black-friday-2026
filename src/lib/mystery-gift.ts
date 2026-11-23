// Mystery gifts from The Green Room: the gift upgrades every GIFT_STEP JOD of
// cart total, with no upper limit. Shared by the cart tracker, the floating
// cart bar and the "unlocked" message. Visual only: no coupon is made.

/** The mystery gift gets better every this many JOD. */
export const GIFT_STEP = 50;

/** Gifts unlocked so far, JOD left to the next one, and how full the bar is. */
export function giftProgress(subtotal: number) {
  const total = Math.max(0, subtotal);
  const unlocked = Math.floor(total / GIFT_STEP + 1e-9);
  const next = (unlocked + 1) * GIFT_STEP;
  const left = Math.round((next - total) * 1000) / 1000;
  // The bar fills toward the next gift and starts again after each one.
  const pct = Math.min(100, Math.max(0, ((total - unlocked * GIFT_STEP) / GIFT_STEP) * 100));
  return { unlocked, next, left, pct };
}

/** The one line shown with the bar (`short` for the floating cart bar). */
export function giftLine(subtotal: number, short = false): string {
  const { unlocked, left } = giftProgress(subtotal);
  const amount = `JOD ${left.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  if (short) {
    return unlocked === 0
      ? `${amount} to your first mystery gift`
      : `${amount} to upgrade your mystery gift`;
  }
  return unlocked === 0
    ? `${amount} away from your first mystery gift from The Green Room`
    : `${amount} away from upgrading your mystery gift from The Green Room`;
}

/** Close the cart and go back to the products. */
export function shopMore(close: (open: boolean) => void) {
  close(false);
  window.setTimeout(() => {
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 250);
}
