import { DEFAULT_TEXT, rewardLevels, useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { AwayLine } from "./AwayLine";
import { FreeBottlesBar } from "./FreeBottlesBar";
import { RewardCarousel } from "./RewardCards";
import { RewardStar } from "./RewardStar";
import { UnlockedReward } from "./UnlockedReward";

/**
 * Free bottles section. Home page (under the hero): big headline, the "away"
 * line, the bar, what you unlocked and the five reward cards. Cart
 * (`inCart`): the same, tighter, at the top of the cart.
 */
export function FreeBottlesStrip({
  className,
  inCart = false,
}: {
  className?: string;
  inCart?: boolean;
}) {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  if (!cfg) return null;
  const levels = rewardLevels(total, cfg);

  if (inCart) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-ff-burgundy/15 bg-ff-warm-cream px-3 pt-3 pb-3",
          className,
        )}
      >
        <AwayLine
          cfg={cfg}
          total={total}
          className="ff-headline text-center text-[13px] leading-snug uppercase"
        />
        <FreeBottlesBar cfg={cfg} total={total} />
        <UnlockedReward cfg={cfg} total={total} className="mt-1 mb-2" />
        <RewardCarousel levels={levels} cfg={cfg} row />
      </div>
    );
  }

  return (
    <section className={cn("relative overflow-hidden bg-ff-warm-cream", className)}>
      {/* A few small stars around the headline (placeholder for Andrea's star). */}
      <RewardStar filled className="absolute top-6 left-[6%] h-5 w-5 rotate-12 opacity-70" />
      <RewardStar filled className="absolute top-16 right-[8%] h-4 w-4 -rotate-12 opacity-60" />
      <div className="mx-auto max-w-[1100px] px-5 pt-8 pb-8 md:px-10 md:pt-10">
        <h2 className="ff-headline text-center text-3xl leading-none text-ff-red uppercase md:text-5xl">
          {cfg.text.headline || DEFAULT_TEXT.headline}
        </h2>
        <AwayLine cfg={cfg} total={total} className="mt-3 text-center text-sm md:text-lg" />
        <div className="mx-auto mt-2 max-w-xl">
          <FreeBottlesBar cfg={cfg} total={total} />
          <UnlockedReward cfg={cfg} total={total} className="mx-auto mt-1 w-fit" />
        </div>
        <RewardCarousel
          levels={levels}
          cfg={cfg}
          className="-mx-5 mt-5 px-5 md:mx-0 md:justify-center md:px-0"
        />
      </div>
    </section>
  );
}
