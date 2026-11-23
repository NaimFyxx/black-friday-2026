import { Gift } from "lucide-react";

import { giftLine, giftProgress, shopMore } from "@/lib/mystery-gift";
import { useCartUi } from "@/stores/cartUiStore";

/**
 * Spend tracker in the cart: one bar that fills toward the next mystery gift
 * from The Green Room (it upgrades every 50 JOD, no upper limit) and one line
 * saying how far away it is. Updates on every add or remove. Visual only: no
 * coupon is made or applied.
 */
export function MysteryGiftTracker({ subtotal }: { subtotal: number }) {
  const setOpen = useCartUi((s) => s.setOpen);
  const { pct } = giftProgress(subtotal);

  return (
    <div className="shrink-0 rounded-xl border border-ff-black/10 bg-ff-cream px-3 py-2.5">
      <p
        className="flex items-start gap-2 text-[13px] leading-snug text-ff-black"
        aria-live="polite"
      >
        <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ff-red" />
        <span>{giftLine(subtotal)}</span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ff-black/10"
        role="progressbar"
        aria-label="Progress to your next mystery gift"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full rounded-full bg-ff-red transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => shopMore(setOpen)}
        className="ff-subline mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-full border border-ff-red text-sm text-ff-red transition-colors hover:bg-ff-red hover:text-ff-cream"
      >
        Add more items
      </button>
    </div>
  );
}
