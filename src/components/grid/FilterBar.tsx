import type { ReactNode } from "react";

import {
  bandLabel,
  SORT_LABELS,
  type CatalogFacets,
  type CatalogFilters,
  type SortKey,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Sticky filters under the header.
 * Row 1: All / Wine / Spirits / Cigars. Row 2: sub categories of the picked one.
 * Row 3: price bands. Each chip shows its count, and during
 * the sale its "up to X%". Nothing links to Shopify collections.
 */
export function FilterBar({
  facets,
  filters,
  onChange,
}: {
  facets: CatalogFacets;
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
}) {
  const sale = facets.state === "sale";

  return (
    <div className="sticky top-16 z-30 -mx-5 border-b border-ff-black/15 bg-ff-cream/95 px-5 py-2 md:top-[88px] md:-mx-10 md:px-10">
      <Row label="Category">
        <ChipButton
          active={!filters.main}
          onClick={() => onChange({ main: undefined, sub: undefined })}
        >
          All <Count n={facets.all.count} />
        </ChipButton>
        {/* A category with nothing to show (e.g. no discounts yet) is hidden. */}
        {facets.mains
          .filter((m) => m.count > 0 || filters.main === m.name)
          .map((m) => (
            <ChipButton
              key={m.name}
              active={filters.main === m.name}
              onClick={() => onChange({ main: m.name, sub: undefined })}
            >
              {m.name} <Count n={m.count} />
              {sale && m.upto ? <UpTo n={m.upto} /> : null}
            </ChipButton>
          ))}
      </Row>

      {filters.main && facets.subs.length > 0 && (
        <Row label={`${filters.main} type`}>
          <ChipButton small active={!filters.sub} onClick={() => onChange({ sub: undefined })}>
            All {filters.main}
          </ChipButton>
          {facets.subs.map((s) => (
            <ChipButton
              key={s.name}
              small
              active={filters.sub === s.name}
              onClick={() => onChange({ sub: s.name })}
            >
              {s.name} <Count n={s.count} />
              {sale && s.upto ? <UpTo n={s.upto} /> : null}
            </ChipButton>
          ))}
        </Row>
      )}

      <Row label="Price">
        {facets.bands.map((b) => (
          <ChipButton
            key={b.index}
            small
            active={filters.band === b.index}
            onClick={() => onChange({ band: filters.band === b.index ? undefined : b.index })}
          >
            {bandLabel(b)} <Count n={b.count} />
          </ChipButton>
        ))}
      </Row>
    </div>
  );
}

/** Sort menu, shown on the line with the product count (so it never covers the chips). */
export function SortMenu({
  sale,
  value,
  onChange,
}: {
  sale: boolean;
  value: SortKey | undefined;
  onChange: (sort: SortKey) => void;
}) {
  const sortOptions: SortKey[] = sale
    ? ["discount", "price_asc", "price_desc"]
    : ["newest", "price_asc", "price_desc"];
  const sort = value && sortOptions.includes(value) ? value : sortOptions[0];
  return (
    <label className="flex shrink-0 items-center gap-1.5">
      <span className="ff-small text-xs text-ff-black/70">Sort</span>
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="ff-small h-8 rounded-full border border-ff-black/25 bg-ff-cream px-3 text-xs text-ff-black"
      >
        {sortOptions.map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "mt-1.5 flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] first:mt-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChipButton({
  active,
  small,
  onClick,
  children,
}: {
  active: boolean;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "ff-subline shrink-0 rounded-full border whitespace-nowrap transition-colors",
        small ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        active
          ? "border-ff-red bg-ff-red text-ff-cream"
          : "border-ff-red/60 bg-ff-cream text-ff-black hover:text-ff-red",
      )}
    >
      {children}
    </button>
  );
}

const Count = ({ n }: { n: number }) => <span className="tabular-nums opacity-70">({n})</span>;
const UpTo = ({ n }: { n: number }) => (
  <span className="ff-num ml-1 text-[0.85em]">up to {n}%</span>
);
