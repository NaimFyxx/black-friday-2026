import { useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { AwayLine } from "./AwayLine";
import { FreeBottlesBar } from "./FreeBottlesBar";
import { UnlockedReward } from "./UnlockedReward";

/** The free gift progress on Andrea's red block: top of the cart and the home page hero. */
export function FreeBottlesStrip({ className }: { className?: string; inCart?: boolean }) {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  if (!cfg) return null;
  return (
    <div className={cn("rounded-2xl bg-ff-red px-3 pt-3 pb-3 text-ff-black", className)}>
      <AwayLine
        cfg={cfg}
        total={total}
        className="ff-headline text-center text-[13px] leading-snug uppercase"
      />
      <FreeBottlesBar cfg={cfg} total={total} />
      <UnlockedReward cfg={cfg} total={total} className="mx-auto mt-1 w-fit" />
    </div>
  );
}
