import { awayLine, DEFAULT_TEXT, useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { FreeBottlesBar } from "./FreeBottlesBar";

/** Home page (under the hero) and the cart: headline, "away from" line and the bar. */
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
  return (
    <div
      className={cn(
        inCart
          ? "rounded-xl border border-ff-burgundy/15 bg-ff-warm-cream px-3 pt-3"
          : "bg-ff-warm-cream",
        className,
      )}
    >
      <div className={cn(!inCart && "mx-auto max-w-[640px] px-5 pt-4 md:px-10")}>
        <p className="ff-headline text-center text-sm tracking-wide text-ff-red uppercase md:text-base">
          {cfg.text.headline || DEFAULT_TEXT.headline}
        </p>
        <p className="mt-0.5 text-center text-xs text-ff-black md:text-sm">
          {awayLine(total, cfg)}
        </p>
        <FreeBottlesBar cfg={cfg} total={total} />
      </div>
    </div>
  );
}
