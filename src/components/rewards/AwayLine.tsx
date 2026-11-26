import { awayParts, type FreeBottlesConfig } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";

/** "You're JOD 18.500 away from free bottle level 2", amount and reward in red. */
export function AwayLine({
  cfg,
  total,
  className,
  strongClassName = "text-ff-cream",
}: {
  cfg: FreeBottlesConfig;
  total: number;
  className?: string;
  /** Colour of the amount and the reward ("text-ff-red" in the burgundy hero). */
  strongClassName?: string;
}) {
  return (
    <p className={cn("text-ff-black", className)}>
      {awayParts(total, cfg).map((p, i) =>
        p.strong ? (
          <span key={i} className={cn("ff-num font-semibold", strongClassName)}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
