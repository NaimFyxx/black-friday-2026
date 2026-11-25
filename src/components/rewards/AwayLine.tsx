import { awayParts, type FreeBottlesConfig } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";

/** "You're JOD 18.500 away from free bottle level 2", amount and reward in red. */
export function AwayLine({
  cfg,
  total,
  className,
}: {
  cfg: FreeBottlesConfig;
  total: number;
  className?: string;
}) {
  return (
    <p className={cn("text-ff-black", className)}>
      {awayParts(total, cfg).map((p, i) =>
        p.strong ? (
          <span key={i} className="ff-num font-semibold text-ff-red">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
