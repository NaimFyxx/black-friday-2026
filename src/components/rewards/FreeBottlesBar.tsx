import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { progress, type FreeBottlesConfig, type Milestone } from "@/lib/free-bottles";
import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { RewardStar } from "./RewardStar";

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
}: {
  cfg: FreeBottlesConfig;
  total: number;
  compact?: boolean;
  /** "red": on Andrea's red blocks (cart, product page). "burgundy": in the hero. */
  tone?: "red" | "burgundy";
  /** Stars unlocked between this total and `total` pop on first show. */
  fromTotal?: number;
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
    <div className={cn("relative px-3", compact ? "pt-1 pb-1" : "pt-6 pb-5")}>
      <div
        className={cn(
          "relative h-1.5 rounded-full",
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
          />
        ))}
      </div>
    </div>
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
}: {
  m: Milestone;
  cfg: FreeBottlesConfig;
  total: number;
  compact: boolean;
  pop: boolean;
  next?: boolean;
  tone: "red" | "burgundy";
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
    <RewardStar
      light={!dark}
      dark={dark}
      filled={m.reached}
      className={cn(compact ? "h-4 w-4" : "h-6 w-6", pop && "ff-star-pop")}
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
            className="flex h-8 w-8 items-center justify-center"
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
            "ff-num pointer-events-none absolute top-full text-[9px] leading-none whitespace-nowrap",
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
