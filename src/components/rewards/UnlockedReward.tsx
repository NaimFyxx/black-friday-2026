import { currentReward, DEFAULT_TEXT, type FreeBottlesConfig } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { RewardStar } from "./RewardStar";

/**
 * Under the bar: what the shopper has unlocked so far ("Unlocked: Free bottle
 * level 2, <bottle name>"). Changes every time they reach a new star.
 */
export function UnlockedReward({
  cfg,
  total,
  className,
  tone = "red",
}: {
  cfg: FreeBottlesConfig;
  total: number;
  className?: string;
  tone?: "red" | "burgundy";
}) {
  const r = currentReward(total, cfg);
  if (!r) return null;
  // Level only: what the gift is stays a surprise.
  return (
    <div
      key={r.level}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-left",
        tone === "burgundy" ? "bg-ff-cream/10 text-ff-cream" : "bg-ff-burgundy text-ff-cream",
        className,
      )}
    >
      <RewardStar
        light={tone !== "burgundy"}
        dark={tone === "burgundy"}
        filled
        className="ff-star-pop h-4 w-4 shrink-0"
      />
      <p className="ff-subline min-w-0 text-[10px] leading-snug tracking-wide uppercase md:text-xs">
        {(cfg.text.current || DEFAULT_TEXT.current).replace("{level}", r.label)}
      </p>
    </div>
  );
}
