import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEFAULT_TEXT, progress, type FreeBottlesConfig, type Milestone } from "@/lib/free-bottles";
import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { RewardStar } from "./RewardStar";

/**
 * The free bottles progress bar: free delivery as a small dot (when set), then the stars
 * (the free bottle rewards). Full size: tap a star to see what you get.
 * Compact (the after-add popup): no tapping, no labels. Display only.
 */
export function FreeBottlesBar({
  cfg,
  total,
  compact = false,
  fromTotal,
}: {
  cfg: FreeBottlesConfig;
  total: number;
  compact?: boolean;
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
      <div className="relative h-1.5 rounded-full bg-ff-black/20">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-ff-cream transition-[width] duration-500 ease-out"
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
}: {
  m: Milestone;
  cfg: FreeBottlesConfig;
  total: number;
  compact: boolean;
  pop: boolean;
  next?: boolean;
}) {
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
      light
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
      ) : (
        <span
          className={cn(
            "ff-num pointer-events-none absolute top-full text-[9px] leading-none whitespace-nowrap",
            // The next goal stands out; the rest stay quiet.
            next ? "font-semibold text-ff-cream" : "text-ff-black/70",
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

function RewardDetails({ m, cfg, total }: { m: Milestone; cfg: FreeBottlesConfig; total: number }) {
  const slot = m.index > 0 ? cfg.slots[m.index - 1] : undefined;
  const hasSlot = !!(slot?.name || slot?.image || slot?.text);
  const left = Math.round((m.amount - total) * 1000) / 1000;
  return (
    <div className="text-sm">
      <p className="ff-subline text-ff-red">{m.label}</p>
      <p className="mt-0.5 text-xs text-ff-black/70">
        {m.reached ? "Unlocked" : `Spend ${formatJod(m.amount)}. ${formatJod(left)} to go.`}
      </p>
      {m.index > 0 &&
        (hasSlot ? (
          <div className="mt-2 flex gap-3">
            {slot?.image && (
              <img
                src={slot.image}
                alt=""
                className="h-16 w-12 shrink-0 rounded-sm bg-ff-warm-cream object-contain"
              />
            )}
            <div className="min-w-0">
              {slot?.name && <p className="ff-subline leading-snug">{slot.name}</p>}
              {slot?.text && <p className="mt-0.5 text-xs text-ff-black/70">{slot.text}</p>}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ff-burgundy italic">
            {cfg.text.soon || DEFAULT_TEXT.soon}
          </p>
        ))}
    </div>
  );
}
