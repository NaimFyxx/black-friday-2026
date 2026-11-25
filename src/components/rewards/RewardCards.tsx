import { DEFAULT_TEXT, type FreeBottlesConfig, type RewardLevel } from "@/lib/free-bottles";
import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { RewardStar } from "./RewardStar";

/** The bottle photo, or a star until the bottle is revealed. */
function RewardImage({ r, className }: { r: RewardLevel; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ff-warm-cream",
        className,
      )}
    >
      {r.slot.image ? (
        <img
          src={r.slot.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain p-2 mix-blend-multiply"
        />
      ) : (
        <RewardStar filled={r.reached} className="h-1/2 w-1/2 opacity-80" />
      )}
    </div>
  );
}

/** `small`: the phone tiles (short words, smaller pill). */
function Status({ r, small = false }: { r: RewardLevel; small?: boolean }) {
  const pill = small ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[11px]";
  if (r.current)
    return (
      <span className={cn("ff-subline inline-flex rounded-full bg-ff-red text-ff-cream", pill)}>
        {small ? "Yours now" : "Your bottle now"}
      </span>
    );
  if (r.reached)
    return (
      <span
        className={cn(
          "ff-subline inline-flex text-ff-black/50",
          small ? "text-[9px]" : "text-[11px]",
        )}
      >
        Upgraded
      </span>
    );
  return (
    <span
      className={cn(
        "ff-num inline-flex rounded-full border border-ff-black/30 whitespace-nowrap text-ff-black",
        pill,
      )}
    >
      {small ? formatJod(r.amount) : `Unlock at ${formatJod(r.amount)}`}
    </span>
  );
}

/** One reward card. `row`: image left, text right (cart); otherwise image on top (home, product page). */
export function RewardCard({
  r,
  cfg,
  row = false,
}: {
  r: RewardLevel;
  cfg: FreeBottlesConfig;
  row?: boolean;
}) {
  const name = r.slot.name || cfg.text.soon || DEFAULT_TEXT.soon;
  return (
    <div
      className={cn(
        "snap-start rounded-2xl bg-ff-cream p-3 text-ff-black",
        r.current && "ring-2 ring-ff-burgundy",
        r.reached && !r.current && "opacity-60",
        // Phones: small square tiles like Huda Beauty's; full cards from md up.
        row ? "flex w-60 shrink-0 gap-3" : "w-[92px] shrink-0 p-2 md:w-48 md:p-3",
      )}
    >
      <RewardImage r={r} className={row ? "h-16 w-14" : "aspect-square w-full md:aspect-[4/3]"} />
      <div className={cn("min-w-0", !row && "mt-1.5 md:mt-2")}>
        <p className="ff-subline text-[9px] tracking-[0.15em] text-ff-red uppercase md:text-[10px]">
          {r.label}
        </p>
        <p
          className={cn(
            "ff-subline mt-0.5 line-clamp-2 text-sm leading-snug",
            !r.slot.name && "text-ff-black/50 italic",
            !row && "hidden md:block",
          )}
        >
          {name}
        </p>
        {r.slot.text && (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-xs text-ff-black/70",
              !row && "hidden md:block",
            )}
          >
            {r.slot.text}
          </p>
        )}
        {!row && (
          <div className="mt-1 md:hidden">
            <Status r={r} small />
          </div>
        )}
        {!row && (
          <div className="mt-2 hidden md:block">
            <Status r={r} />
          </div>
        )}
        {row && (
          <div className="mt-2">
            <Status r={r} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The reward cards side by side, swipeable on phones. */
export function RewardCarousel({
  levels,
  cfg,
  row = false,
  className,
}: {
  levels: RewardLevel[];
  cfg: FreeBottlesConfig;
  row?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex snap-x gap-2 overflow-x-auto md:gap-3 overscroll-x-contain pb-1 [scrollbar-width:none]",
        className,
      )}
    >
      {levels.map((r) => (
        <RewardCard key={r.level} r={r} cfg={cfg} row={row} />
      ))}
    </div>
  );
}
