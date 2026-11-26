import { useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { AwayLine } from "./AwayLine";
import { FreeBottlesBar } from "./FreeBottlesBar";
import { UnlockedReward } from "./UnlockedReward";

/** Product pages, under Add to cart: the "away" line, the bar and the current level. */
export function FreeBottlesBox({ className }: { className?: string }) {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  if (!cfg) return null;
  return (
    <div className={cn("rounded-2xl bg-ff-red px-4 pt-3 pb-3 text-ff-black", className)}>
      <AwayLine cfg={cfg} total={total} className="text-sm" />
      <FreeBottlesBar cfg={cfg} total={total} />
      <UnlockedReward cfg={cfg} total={total} className="mt-1 w-fit" />
    </div>
  );
}
