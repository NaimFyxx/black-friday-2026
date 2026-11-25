import { cn } from "@/lib/utils";

/**
 * PLACEHOLDER star for the free bottle rewards. Swap the path for Andrea's star
 * from the Fyxx Friday design files once we have the SVG. Outlined until
 * reached, then filled red.
 */
export function RewardStar({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("block", className)}>
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
        className={cn(
          "transition-colors duration-300",
          filled ? "fill-ff-red stroke-ff-red" : "fill-ff-cream stroke-ff-burgundy/40",
        )}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
