import type { RewardLevel } from "@/lib/free-bottles";
import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";

/**
 * The levels as a quiet row of pills, without showing what any gift is.
 * Passed levels are crossed out and faded (the gift was swapped for a better
 * one), the current level is filled, upcoming ones show their amount.
 * tone "burgundy": in the hero. "red": on the red blocks (cart, product page).
 */
export function LevelChips({
  levels,
  tone = "red",
  className,
}: {
  levels: RewardLevel[];
  tone?: "red" | "burgundy";
  className?: string;
}) {
  const dark = tone === "burgundy";
  return (
    <ol className={cn("flex flex-wrap justify-center gap-1.5", className)}>
      {levels.map((r) => (
        <li
          key={r.level}
          className={cn(
            "ff-subline rounded-full px-2.5 py-1 text-[10px] leading-none tracking-wide whitespace-nowrap uppercase md:text-[11px]",
            r.current
              ? dark
                ? "bg-ff-red text-ff-cream"
                : "bg-ff-burgundy text-ff-cream"
              : r.reached
                ? cn("line-through opacity-50", dark ? "text-ff-cream" : "text-ff-black")
                : cn(
                    "border",
                    dark
                      ? "border-ff-cream/25 text-ff-cream/75"
                      : "border-ff-black/25 text-ff-black",
                  ),
          )}
        >
          {r.label}
          {!r.reached && (
            <span className="ff-num ml-1 normal-case opacity-80">{formatJod(r.amount)}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
