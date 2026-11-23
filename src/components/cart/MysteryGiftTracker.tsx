import { Gift } from "lucide-react";

import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { giftProgress, shopMore } from "@/lib/mystery-gift";
import { useCartUi } from "@/stores/cartUiStore";

/**
 * Spend tracker in the cart: a mystery gift from The Green Room every 50 JOD,
 * no upper limit (src/lib/mystery-gift.ts). Updates with the cart total on
 * every add or remove. Visual only: no coupon is made or applied.
 */
/** Share of the bar used by the markers (the rest is the fading tail). */
const TRACK = 0.86;

export function MysteryGiftTracker({ subtotal }: { subtotal: number }) {
  const setOpen = useCartUi((s) => s.setOpen);
  const { unlocked, left, pct, markers, base, span } = giftProgress(subtotal);

  const line =
    unlocked === 0
      ? `You are ${formatJod(left)} away from your first mystery gift from The Green Room.`
      : `You unlocked a mystery gift from The Green Room. You are ${formatJod(left)} away from an even better one.`;

  return (
    <div className="shrink-0 rounded-xl border border-ff-black/10 bg-ff-cream px-4 pt-3 pb-4">
      <p className="flex items-start gap-2 text-sm leading-snug text-ff-black" aria-live="polite">
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-ff-red" />
        <span>{line}</span>
      </p>
      {/* Markers use the first 86% of the bar; the rest fades out, so the
          bar reads as open-ended: there is always another gift after it. */}
      <div className="relative mt-4 mb-5">
        <div
          className="h-2 overflow-hidden rounded-l-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.1) 86%, rgba(0,0,0,0) 100%)",
          }}
        >
          <div
            className="h-full rounded-full bg-ff-red transition-[width] duration-500 ease-out"
            style={{ width: `${pct * TRACK}%` }}
          />
        </div>
        {markers.map((t) => {
          const reached = subtotal >= t;
          return (
            <div
              key={t}
              className="absolute top-1 -translate-x-1/2"
              style={{ left: `${((t - base) / span) * 100 * TRACK}%` }}
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
      <button
        type="button"
        onClick={() => shopMore(setOpen)}
        className="ff-subline mt-1 inline-flex h-9 w-full items-center justify-center rounded-full border border-ff-red text-sm text-ff-red transition-colors hover:bg-ff-red hover:text-ff-cream"
      >
        Add more items
      </button>
    </div>
  );
}
