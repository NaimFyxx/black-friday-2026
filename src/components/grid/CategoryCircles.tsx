import { sizedImage, type Chip } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Category circles (like the Fyxx shop): a photo in a round frame with the
 * name underneath. Photos come from bf_settings.category_mapping[].image_handle.
 * `layout="row"` scrolls sideways (page); `layout="grid"` wraps (filter panel).
 */
export function CategoryCircles({
  mains,
  active,
  sale,
  allUpto,
  layout,
  onPick,
}: {
  mains: Array<Chip & { image?: string | null }>;
  active: string | undefined;
  sale: boolean;
  allUpto?: number | null;
  layout: "row" | "grid";
  onPick: (main: string | undefined) => void;
}) {
  const items = mains.filter((m) => m.count > 0 || m.name === active);
  return (
    <div
      role="group"
      aria-label="Category"
      className={cn(
        layout === "row"
          ? "-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 pt-1 pb-1 [scrollbar-width:none] md:-mx-10 md:scroll-px-10 md:gap-5 md:px-10"
          : "grid w-full grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 md:grid-cols-7",
      )}
    >
      <Circle
        label="All"
        image="/brand/fyxx-friday-bottles-360.webp"
        contain
        active={!active}
        upto={sale ? allUpto : null}
        row={layout === "row"}
        onClick={() => onPick(undefined)}
      />
      {items.map((m) => (
        <Circle
          key={m.name}
          label={m.name}
          image={m.image ? sizedImage(m.image, 200) : undefined}
          active={active === m.name}
          upto={sale ? m.upto : null}
          row={layout === "row"}
          onClick={() => onPick(m.name)}
        />
      ))}
    </div>
  );
}

function Circle({
  label,
  image,
  contain,
  active,
  upto,
  row,
  onClick,
}: {
  label: string;
  image: string | undefined;
  contain?: boolean;
  active: boolean;
  upto?: number | null | undefined;
  row: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center text-center",
        row && "w-[76px] shrink-0 snap-start md:w-24",
      )}
    >
      <span
        className={cn(
          "m-0.5 flex aspect-square w-16 items-center justify-center overflow-hidden rounded-full bg-ff-warm-cream ring-2 transition-shadow md:w-20",
          active ? "ring-ff-red" : "ring-transparent group-hover:ring-ff-red/40",
        )}
      >
        {image ? (
          <img
            src={image}
            alt=""
            width={200}
            height={200}
            loading="lazy"
            decoding="async"
            className={cn(
              "h-[82%] w-[82%] mix-blend-multiply",
              contain ? "object-contain" : "object-contain",
            )}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "mt-1.5 line-clamp-2 text-xs leading-tight md:text-sm",
          active ? "ff-headline text-ff-red" : "ff-subline text-ff-black",
        )}
      >
        {label}
      </span>
      {upto ? (
        <span className="ff-num text-[10px] leading-3 text-ff-red">up to {upto}%</span>
      ) : null}
    </button>
  );
}
