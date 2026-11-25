import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { rewardLevels, useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { AwayLine } from "./AwayLine";
import { FreeBottlesBar } from "./FreeBottlesBar";
import { RewardCarousel } from "./RewardCards";
import { UnlockedReward } from "./UnlockedReward";

/** Product pages, under Add to cart: the "away" line, the bar, what you unlocked and "See the free bottles". */
export function FreeBottlesBox({ className }: { className?: string }) {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  const [open, setOpen] = useState(false);
  if (!cfg) return null;
  return (
    <div className={cn("rounded-2xl bg-ff-warm-cream px-4 pt-3 pb-2", className)}>
      <AwayLine cfg={cfg} total={total} className="text-sm" />
      <FreeBottlesBar cfg={cfg} total={total} />
      <UnlockedReward cfg={cfg} total={total} className="mb-2" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ff-subline flex w-full items-center justify-center gap-1 border-t border-ff-burgundy/10 pt-2 pb-1 text-xs tracking-wide text-ff-red uppercase"
      >
        See the free bottles
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && <RewardCarousel levels={rewardLevels(total, cfg)} cfg={cfg} className="mt-2 pb-2" />}
    </div>
  );
}
