import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { progress, type FreeBottlesConfig, type Milestone } from "@/lib/free-bottles";
import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { STAR_PATH } from "./RewardStar";

/**
 * The free bottles progress bar: free delivery as a small dot (when set), then the stars
 * (the free bottle levels). Full size: tap a star for its level and amount
 * (never what the gift is).
 * Compact (the after-add popup): no tapping, no labels. Display only.
 */
export function FreeBottlesBar({
  cfg,
  total,
  compact = false,
  fromTotal,
  tone = "red",
  dense = false,
}: {
  cfg: FreeBottlesConfig;
  total: number;
  compact?: boolean;
  /** "red": on Andrea's red blocks (cart, product page). "burgundy": in the hero. */
  tone?: "red" | "burgundy";
  /** Stars unlocked between this total and `total` pop on first show. */
  fromTotal?: number;
  /** Slimmer on phones (smaller stars, less padding); full size from md up. */
  dense?: boolean;
}) {
  const p = progress(total, cfg);

  // Pop a star when it is newly reached while the bar is on screen.
  const before = useRef<number>(
    fromTotal !== undefined ? progress(fromTotal, cfg).bottles : p.bottles,
  );
  const [popFrom, setPopFrom] = useState<number | null>(null);
  useEffect(() => {
    if (p.bottles > before.current) setPopFrom(before.current);
    before.current = p.bottles;
  }, [p.bottles]);

  return (
    <div
      className={cn(
        "relative px-3",
        // Room under the line for the amounts, so they never touch what follows.
        compact ? "pt-1 pb-1" : dense ? "pt-3.5 pb-6 md:pt-6 md:pb-7" : "pt-6 pb-7",
      )}
    >
      <div
        className={cn(
          // A hairline; the stars sit on it with a clean gap around them.
          "relative h-0.5 rounded-full",
          tone === "burgundy" ? "bg-ff-cream/15" : "bg-ff-black/20",
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
            tone === "burgundy" ? "bg-ff-red" : "bg-ff-cream",
          )}
          style={{ width: `${p.fill}%` }}
        />
        {p.milestones.map((m) => (
          <Marker
            key={m.index}
            m={m}
            cfg={cfg}
            total={total}
            compact={compact}
            pop={popFrom !== null && m.index > popFrom && m.index <= p.bottles}
            next={p.next?.index === m.index}
            tone={tone}
            dense={dense}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Andrea's starburst as a milestone: always solid (no jagged outlines), one
 * size. Reached = solid accent, next = solid cream (burgundy on red), ahead = faint.
 */
function MilestoneStar({
  state,
  tone,
  className,
}: {
  state: "reached" | "next" | "ahead";
  tone: "red" | "burgundy";
  className?: string;
}) {
  const dark = tone === "burgundy";
  // Every star is one solid shape (no outlines), drawn over a base in the
  // background colour so the line never shows through a faint star.
  const base = dark ? "fill-ff-burgundy" : "fill-ff-red";
  const fill =
    state === "reached"
      ? dark
        ? "fill-ff-red"
        : "fill-ff-cream"
      : state === "next"
        ? dark
          ? "fill-ff-cream"
          : "fill-ff-burgundy"
        : dark
          ? "fill-ff-cream/25"
          : "fill-ff-black/25";
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("block", className)}>
      <path d={STAR_PATH} className={base} />
      <path d={STAR_PATH} className={cn("transition-colors duration-300", fill)} />
    </svg>
  );
}

function Marker({
  m,
  cfg,
  total,
  compact,
  pop,
  next = false,
  tone,
  dense = false,
}: {
  m: Milestone;
  cfg: FreeBottlesConfig;
  total: number;
  compact: boolean;
  pop: boolean;
  next?: boolean;
  tone: "red" | "burgundy";
  dense?: boolean;
}) {
  const dark = tone === "burgundy";
  const delivery = m.index === 0;
  const icon = delivery ? (
    <span
      className={cn(
        "flex items-center justify-center rounded-full border",
        compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
        m.reached ? "border-ff-cream bg-ff-cream text-ff-red" : "border-ff-cream/70 bg-ff-red",
      )}
    >
      {m.reached && !compact && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </span>
  ) : (
    <MilestoneStar
      state={m.reached ? "reached" : next ? "next" : "ahead"}
      tone={tone}
      className={cn(
        compact ? "h-4 w-4" : dense ? "h-5 w-5 md:h-6 md:w-6" : "h-6 w-6",
        pop && "ff-star-pop",
      )}
    />
  );

  const place = { left: `${m.pos}%` };
  if (compact) {
    return (
      <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={place}>
        {icon}
      </span>
    );
  }

  return (
    <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={place}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${m.label}, ${m.reached ? "unlocked" : `at ${formatJod(m.amount)}`}`}
            className={cn(
              "flex items-center justify-center",
              dense ? "h-7 w-7 md:h-8 md:w-8" : "h-8 w-8",
            )}
          >
            {icon}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          className="w-60 border-ff-burgundy/15 bg-ff-cream p-3 text-ff-black"
        >
          <RewardDetails m={m} cfg={cfg} total={total} />
        </PopoverContent>
      </Popover>
      {/* Small label: free delivery above its dot, amounts under the stars. */}
      {delivery ? (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 text-[9px] leading-none whitespace-nowrap text-ff-black">
          {m.label}
        </span>
      ) : m.reached ? null : (
        // Amounts only for levels still ahead (reached ones need no price tag).
        <span
          className={cn(
            "ff-num pointer-events-none absolute top-full leading-none whitespace-nowrap",
            dense ? "text-[8px] md:text-[9px]" : "text-[9px]",
            // The next goal stands out; the rest stay quiet.
            next
              ? cn("font-semibold", dark ? "text-ff-red" : "text-ff-cream")
              : dark
                ? "text-ff-cream/60"
                : "text-ff-black/70",
            // The last star sits at the right edge: keep its amount inside the box.
            m.pos >= 99 ? "right-1" : "left-1/2 -translate-x-1/2",
          )}
        >
          {/* Number only ("50.000"); the headline says it is JOD. */}
          {m.amount.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        </span>
      )}
    </span>
  );
}

function RewardDetails({ m, total }: { m: Milestone; cfg: FreeBottlesConfig; total: number }) {
  const left = Math.round((m.amount - total) * 1000) / 1000;
  return (
    <div className="text-sm">
      <p className="ff-subline text-ff-red">{m.label}</p>
      <p className="mt-0.5 text-xs text-ff-black/70">
        {m.reached ? "Unlocked" : `Spend ${formatJod(m.amount)}. ${formatJod(left)} to go.`}
      </p>
    </div>
  );
}
