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
    <div
      className={cn(
        "mx-auto w-full max-w-xl text-center text-ff-cream",
        // Phones: a soft panel, small type. From md: open, bigger.
        "rounded-2xl bg-ff-cream/[0.06] px-3 pt-2 pb-2 ring-1 ring-ff-cream/10",
        "md:rounded-none md:bg-transparent md:p-0 md:ring-0",
        className,
      )}
    >
      <p className="ff-subline text-[10px] tracking-[0.18em] text-ff-cream/75 uppercase md:ff-headline md:text-2xl md:tracking-normal md:text-ff-red">
        {cfg.text.headline || DEFAULT_TEXT.headline}
      </p>
      <AwayLine
        cfg={cfg}
        total={total}
        className="mt-0.5 text-[12px] leading-snug text-ff-cream md:mt-1 md:text-sm"
        strongClassName="text-ff-red"
      />
      <FreeBottlesBar cfg={cfg} total={total} tone="burgundy" dense />
      <UnlockedReward cfg={cfg} total={total} tone="burgundy" className="mx-auto w-fit md:mb-2" />
      <LevelChips levels={rewardLevels(total, cfg)} tone="burgundy" className="hidden md:flex" />
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
