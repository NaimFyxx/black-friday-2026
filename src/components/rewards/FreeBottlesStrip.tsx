import { DEFAULT_TEXT, rewardLevels, useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { AwayLine } from "./AwayLine";
import { FreeBottlesBar } from "./FreeBottlesBar";
import { RewardCarousel } from "./RewardCards";
import { RewardStar } from "./RewardStar";
import { UnlockedReward } from "./UnlockedReward";

/**
 * Free bottles section in Andrea's style (red block like Post-02 / the red
 * feed post: big cream capitals, black body text, cream highlights).
 * Home page (under the hero): headline, "away" line, bar, what you unlocked
 * and the five reward cards. Cart (`inCart`): the same, tighter.
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
      <div className={cn("rounded-2xl bg-ff-red px-3 pt-3 pb-3 text-ff-black", className)}>
        <AwayLine
          cfg={cfg}
          total={total}
          className="ff-headline text-center text-[13px] leading-snug uppercase"
        />
        <FreeBottlesBar cfg={cfg} total={total} />
        <UnlockedReward cfg={cfg} total={total} className="mx-auto mt-1 mb-2 w-fit" />
        <RewardCarousel levels={levels} cfg={cfg} row />
      </div>
    );
  }

  return (
    <section className={cn("relative overflow-hidden bg-ff-red text-ff-black", className)}>
      {/* A few stars around the headline (placeholder until Andrea's starburst). */}
      <RewardStar light filled className="absolute top-6 left-[6%] h-5 w-5 rotate-12 opacity-80" />
      <RewardStar
        light
        filled
        className="absolute top-16 right-[8%] h-4 w-4 -rotate-12 opacity-70"
      />
      <div className="mx-auto max-w-[1100px] px-5 pt-9 pb-9 md:px-10 md:pt-12">
        <p className="ff-subline text-center text-xs tracking-[0.25em] text-ff-cream uppercase md:text-sm">
          Fyxx Friday
        </p>
        <h2 className="ff-headline mt-2 text-center text-[34px] leading-[0.95] text-ff-cream uppercase md:text-6xl">
          {cfg.text.headline || DEFAULT_TEXT.headline}
        </h2>
        <AwayLine cfg={cfg} total={total} className="mt-4 text-center text-sm md:text-lg" />
        <div className="mx-auto mt-2 max-w-xl">
          <FreeBottlesBar cfg={cfg} total={total} />
          <UnlockedReward cfg={cfg} total={total} className="mx-auto mt-1 w-fit" />
        </div>
        <RewardCarousel
          levels={levels}
          cfg={cfg}
          className="-mx-5 mt-6 px-5 md:mx-0 md:justify-center md:px-0"
        />
      </div>
    </section>
  );
}
