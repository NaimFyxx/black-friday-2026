import { currentReward, type FreeBottlesConfig } from "@/lib/free-bottles";
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
}: {
  cfg: FreeBottlesConfig;
  total: number;
  className?: string;
}) {
  const r = currentReward(total, cfg);
  if (!r) return null;
  return (
    <div
      key={r.level}
      className={cn(
        "flex items-center gap-2.5 rounded-full bg-ff-burgundy px-3 py-1.5 text-left text-ff-cream",
        className,
      )}
    >
      {r.slot.image ? (
        <img src={r.slot.image} alt="" className="h-10 w-8 shrink-0 object-contain" />
      ) : (
        <RewardStar light filled className="ff-star-pop h-4 w-4 shrink-0" />
      )}
      <p className="min-w-0 text-xs leading-snug">
        <span className="ff-subline tracking-wide uppercase">Your free bottle: {r.label}</span>
        {r.slot.name && <span className="block text-ff-warm-cream">{r.slot.name}</span>}
      </p>
    </div>
  );
}
