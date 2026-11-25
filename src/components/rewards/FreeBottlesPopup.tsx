import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  awayLine,
  currentReward,
  DEFAULT_TEXT,
  progress,
  useFreeBottles,
  useRewardTotal,
  type FreeBottlesConfig,
} from "@/lib/free-bottles";
import { FreeBottlesBar } from "./FreeBottlesBar";

/**
 * After every add to cart: a small message at the top of the screen (never
 * over the Add to cart button) with the updated bar and the next goal. Closes
 * by itself after a few seconds. Mounted once in __root.
 */
export function FreeBottlesPopup() {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!cfg) {
      last.current = null;
      return;
    }
    const before = last.current;
    last.current = total;
    // First look after the page loads, or the cart went down: no message.
    if (before === null || total <= before + 1e-9) return;
    // Let "Added to cart" show first, then replace it.
    const t = window.setTimeout(() => {
      toast.dismiss();
      toast.custom(() => <PopupCard cfg={cfg} total={total} from={before} />, {
        id: "free-bottles",
        duration: 4500,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [cfg, total]);

  return null;
}

function PopupCard({ cfg, total, from }: { cfg: FreeBottlesConfig; total: number; from: number }) {
  const upgraded =
    progress(total, cfg).bottles > progress(from, cfg).bottles ? currentReward(total, cfg) : null;
  return (
    <div className="w-[min(92vw,380px)] rounded-2xl bg-ff-red px-4 pt-3 pb-2 text-ff-black shadow-xl">
      <p className="ff-headline text-xs tracking-wide text-ff-cream uppercase">
        {cfg.text.headline || DEFAULT_TEXT.headline}
      </p>
      {upgraded && (
        // Reached a new star with this add: say what they upgraded to.
        <p className="ff-subline mt-1 text-sm leading-snug text-ff-cream">
          {upgraded.level === 1
            ? "Free bottle unlocked"
            : `Free bottle upgraded to ${upgraded.label}`}
          {upgraded.slot.name ? `: ${upgraded.slot.name}` : ""}
        </p>
      )}
      <p className="mt-0.5 text-sm leading-snug">{awayLine(total, cfg)}</p>
      <div className="mt-2">
        <FreeBottlesBar cfg={cfg} total={total} compact fromTotal={from} />
      </div>
    </div>
  );
}
