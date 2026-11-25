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

function Status({ r }: { r: RewardLevel }) {
  if (r.current)
    return (
      <span className="ff-subline inline-flex rounded-full bg-ff-red px-3 py-1 text-[11px] text-ff-cream">
        Your bottle now
      </span>
    );
  if (r.reached)
    return (
      <span className="ff-subline inline-flex text-[11px] text-ff-black/50">
        Upgraded
      </span>
    );
  return (
    <span className="ff-num inline-flex rounded-full border border-ff-black/30 px-3 py-1 text-[11px] text-ff-black">
      Unlock at {formatJod(r.amount)}
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
        row ? "flex w-60 shrink-0 gap-3" : "w-36 shrink-0 md:w-48",
      )}
    >
      <RewardImage r={r} className={row ? "h-16 w-14" : "aspect-[4/3] w-full"} />
      <div className={cn("min-w-0", !row && "mt-2")}>
        <p className="ff-subline text-[10px] tracking-[0.15em] text-ff-red uppercase">{r.label}</p>
        <p
          className={cn(
            "ff-subline mt-0.5 line-clamp-2 text-sm leading-snug",
            !r.slot.name && "text-ff-black/50 italic",
          )}
        >
          {name}
        </p>
        {r.slot.text && (
          <p className="mt-0.5 line-clamp-2 text-xs text-ff-black/70">{r.slot.text}</p>
        )}
        <div className="mt-2">
          <Status r={r} />
        </div>
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
        "flex snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none]",
        className,
      )}
    >
      {levels.map((r) => (
        <RewardCard key={r.level} r={r} cfg={cfg} row={row} />
      ))}
    </div>
  );
}
