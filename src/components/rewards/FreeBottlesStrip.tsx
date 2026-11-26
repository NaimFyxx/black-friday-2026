import { DEFAULT_TEXT, rewardLevels, useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { AwayLine } from "./AwayLine";
import { FreeBottlesBar } from "./FreeBottlesBar";
import { LevelChips } from "./LevelChips";
import { UnlockedReward } from "./UnlockedReward";

/**
 * Free gift progress inside the burgundy hero (not its own section): headline,
 * the "away" line, the bar, the current level and the levels row. Never shows
 * what the gifts are. Renders nothing when the bar is switched off.
 */
export function HeroFreeBottles({ className }: { className?: string }) {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  if (!cfg) return null;
  return (
    <div className={cn("mx-auto w-full max-w-xl text-center text-ff-cream", className)}>
      <p className="ff-headline text-sm leading-tight text-ff-red uppercase md:text-2xl">
        {cfg.text.headline || DEFAULT_TEXT.headline}
      </p>
      <AwayLine
        cfg={cfg}
        total={total}
        className="mt-1 text-[11px] text-ff-cream md:text-sm"
        strongClassName="text-ff-red"
      />
      <FreeBottlesBar cfg={cfg} total={total} tone="burgundy" />
      <UnlockedReward cfg={cfg} total={total} tone="burgundy" className="mx-auto mb-2 w-fit" />
      <LevelChips levels={rewardLevels(total, cfg)} tone="burgundy" />
    </div>
  );
}

/** The cart: the same progress at the top of the cart, on Andrea's red block. */
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
