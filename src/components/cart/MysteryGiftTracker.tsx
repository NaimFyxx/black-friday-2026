import { Gift } from "lucide-react";

import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { giftProgress, GIFT_THRESHOLDS as THRESHOLDS, shopMore } from "@/lib/mystery-gift";
import { useCartUi } from "@/stores/cartUiStore";

/**
 * Spend tracker in the cart: mystery gifts from The Green Room at 50, 100, 150
 * and 200 JOD. Updates with the cart total on every add or remove. Visual only
 * for now: thresholds are set here, no coupon is made or applied.
 */
export function MysteryGiftTracker({ subtotal }: { subtotal: number }) {
  const setOpen = useCartUi((s) => s.setOpen);
  const { max, next, unlocked, left, pct } = giftProgress(subtotal);

  const line =
    next === undefined
      ? "You unlocked our top mystery gift from The Green Room. Enjoy."
      : unlocked === 0
        ? `You are ${formatJod(left)} away from your first mystery gift from The Green Room.`
        : `You unlocked a mystery gift from The Green Room. You are ${formatJod(left)} away from an even better one.`;

  return (
    <div className="shrink-0 rounded-xl border border-ff-black/10 bg-ff-cream px-4 pt-3 pb-4">
      <p className="flex items-start gap-2 text-sm leading-snug text-ff-black" aria-live="polite">
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-ff-red" />
        <span>{line}</span>
      </p>
      <div className="relative mt-4 mb-5 mr-2">
        <div className="h-2 overflow-hidden rounded-full bg-ff-black/10">
          <div
            className="h-full rounded-full bg-ff-red transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {THRESHOLDS.map((t) => {
          const reached = subtotal >= t;
          return (
            <div
              key={t}
              className="absolute top-1 -translate-x-1/2"
              style={{ left: `${(t / max) * 100}%` }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-4 w-4 -translate-y-1/2 rounded-full border-2 transition-colors",
                  reached ? "border-ff-red bg-ff-red" : "border-ff-black/25 bg-ff-cream",
                )}
              />
              <span
                className={cn(
                  "absolute top-2 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap tabular-nums",
                  reached ? "text-ff-red" : "text-ff-black/55",
                )}
              >
                {t} JOD
              </span>
            </div>
          );
        })}
      </div>
      {next !== undefined && (
        <button
          type="button"
          onClick={() => shopMore(setOpen)}
          className="ff-subline mt-1 inline-flex h-9 w-full items-center justify-center rounded-full border border-ff-red text-sm text-ff-red transition-colors hover:bg-ff-red hover:text-ff-cream"
        >
          Add more items
        </button>
      )}
    </div>
  );
}
