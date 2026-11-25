import { cn } from "@/lib/utils";

/**
 * Andrea's starburst (from Naim's Figma file "Fyxx - Black Friday 2026",
 * traced from the exported star on 25 Nov). Used for the free bottle levels.
 * `light`: cream, for the red blocks; otherwise red, for cream backgrounds.
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
        d="M22.71 16.6L17.44 16.14L19.51 22.72L13.99 18.2L12.74 20.69L11.38 17.5L5.02 21.92L6.5 15.48L0.5 11.2L6.49 10.71L4.07 7.41L8.57 7.94L7.34 1.28L11.9 6.55L14.23 2.63L15.4 6.57L19.54 3.5L18.13 9.29L23.5 10.5L18.15 13.3Z"
        className={cn("transition-colors duration-300", filled ? on : off)}
        strokeWidth={1.6}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
