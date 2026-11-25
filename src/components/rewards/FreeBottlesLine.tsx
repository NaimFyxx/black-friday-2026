import { cardLine, useFreeBottles, useRewardTotal } from "@/lib/free-bottles";
import { cn } from "@/lib/utils";
import { RewardStar } from "./RewardStar";

/** One-line reminder on product cards and product pages: "Add JOD 12.000 more for 2 free bottles". */
export function FreeBottlesLine({ className }: { className?: string }) {
  const cfg = useFreeBottles();
  const total = useRewardTotal(cfg);
  if (!cfg) return null;
  return (
    <p
      className={cn("flex items-start gap-1 text-[11px] leading-tight text-ff-burgundy", className)}
    >
      <RewardStar filled className="mt-px h-3 w-3 shrink-0" />
      <span>{cardLine(total, cfg)}</span>
    </p>
  );
}
