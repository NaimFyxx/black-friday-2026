import { cn } from "@/lib/utils";

/**
 * PLACEHOLDER star for the free bottle levels. Swap the path for Andrea's
 * starburst (Post-06 / Story-02) once we have the SVG. `light`: cream, for the
 * red blocks; otherwise red, for cream backgrounds.
 */
export function RewardStar({
  filled,
  light = false,
  className,
}: {
  filled: boolean;
  light?: boolean;
  className?: string;
}) {
  const on = light ? "fill-ff-cream stroke-ff-cream" : "fill-ff-red stroke-ff-red";
  const off = light ? "fill-transparent stroke-ff-cream/70" : "fill-ff-cream stroke-ff-burgundy/40";
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("block", className)}>
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
        className={cn("transition-colors duration-300", filled ? on : off)}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
