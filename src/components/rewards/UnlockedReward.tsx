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
        "flex items-center gap-2.5 rounded-xl bg-ff-cream px-3 py-2 text-left",
        className,
      )}
    >
      {r.slot.image ? (
        <img src={r.slot.image} alt="" className="h-10 w-8 shrink-0 object-contain" />
      ) : (
        <RewardStar filled className="ff-star-pop h-5 w-5 shrink-0" />
      )}
      <p className="min-w-0 text-xs leading-snug">
        <span className="ff-subline text-ff-red">Unlocked: {r.label}</span>
        {r.slot.name && <span className="block text-ff-black">{r.slot.name}</span>}
      </p>
    </div>
  );
}
