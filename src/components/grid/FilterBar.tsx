import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";

import { CategoryCircles } from "@/components/grid/CategoryCircles";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  bandLabel,
  facetsQueryOptions,
  mainInGroup,
  SORT_LABELS,
  type CatalogFacets,
  type CatalogFilters,
  type SortKey,
} from "@/lib/catalog";
import { usePreview, useSim } from "@/lib/preview";
import { teaserQueryOptions } from "@/lib/teaser";
import { cn } from "@/lib/utils";

/**
 * Sticky filters under the header, kept simple for shoppers (the category
 * circles sit just above it on the page, see CategoryCircles):
 * 1. One "Filter & sort" button (opens a panel from the bottom with category
 *    circles, type, price, discount and sort) and the number of products.
 * 2. The filters in use, as small tags with an x to remove each one.
 * Nothing links to Shopify collections.
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
  // Discount filter and "Biggest discount" sort only with the sale-time extras on.
  const { data: teaser } = useQuery(teaserQueryOptions(usePreview()));
  const sale = facets.state === "sale" && teaser?.sale_extras === true;
  const [open, setOpen] = useState(false);
  const band = facets.bands.find((b) => b.index === filters.band);
  const tags: Array<{ label: string; clear: Partial<CatalogFilters> }> = [];
  if (filters.q) tags.push({ label: `“${filters.q}”`, clear: { q: undefined } });
  if (filters.group)
    tags.push({
      label: filters.group,
      clear: { group: undefined, main: undefined, sub: undefined },
    });
  if (filters.main) tags.push({ label: filters.main, clear: { main: undefined, sub: undefined } });
  if (filters.sub) tags.push({ label: filters.sub, clear: { sub: undefined } });
  if (band) tags.push({ label: bandLabel(band), clear: { band: undefined } });
  if (sale && filters.disc)
    tags.push({ label: `${filters.disc}% off or more`, clear: { disc: undefined } });
  const active = tags.filter((t) => !("q" in t.clear)).length;

  // Where the bar ends on screen, for the sticky price headings in the grid.
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const set = () => {
      const top = parseFloat(getComputedStyle(el).top) || 0;
      document.documentElement.style.setProperty(
        "--ff-filter-bottom",
        `${Math.round(top + el.offsetHeight)}px`,
      );
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  return (
    <div
      ref={bar}
      className="sticky top-[100px] z-30 -mx-5 border-b border-ff-black/15 bg-ff-cream px-5 md:top-[88px] md:-mx-10 md:px-10"
    >
      {/* 1. Filter button + count */}
      <div className="flex items-center justify-between gap-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ff-subline inline-flex h-9 items-center gap-2 rounded-full border border-ff-black bg-ff-cream px-4 text-sm text-ff-black"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter &amp; sort
          {active > 0 && (
            <span className="ff-num flex h-5 min-w-5 items-center justify-center rounded-full bg-ff-red px-1 text-[11px] text-ff-cream">
              {active}
            </span>
          )}
        </button>
        <span className="ff-small text-xs text-ff-black/70 tabular-nums">
          {facets.total} {facets.total === 1 ? "product" : "products"}
        </span>
      </div>

      {/* 2. Filters in use */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {tags.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => onChange(t.clear)}
              aria-label={`Remove ${t.label}`}
              className="ff-small inline-flex h-7 items-center gap-1 rounded-full bg-ff-burgundy pr-2 pl-3 text-xs text-ff-cream"
            >
              {t.label}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
          {tags.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  q: undefined,
                  group: undefined,
                  main: undefined,
                  sub: undefined,
                  band: undefined,
                  disc: undefined,
                })
              }
              className="ff-small text-xs text-ff-black underline underline-offset-2"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <FilterSheet
        open={open}
        onOpenChange={setOpen}
        sale={sale}
        filters={filters}
        onApply={(f) => {
          onChange(f);
          setOpen(false);
        }}
      />
    </div>
  );
}

/** The bottom panel. Choices are only applied when the shopper taps "Show N products". */
function FilterSheet({
  open,
  onOpenChange,
  sale,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: boolean;
  filters: CatalogFilters;
  onApply: (f: Partial<CatalogFilters>) => void;
}) {
  const [draft, setDraft] = useState<CatalogFilters>(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = usePreview();
  const sim = useSim();
  const { data: f } = useQuery({ ...facetsQueryOptions(draft, preview, sim), enabled: open });
  const set = (patch: Partial<CatalogFilters>) => setDraft((d) => ({ ...d, ...patch }));

  const sortOptions: SortKey[] = sale
    ? ["featured", "discount", "price_asc", "price_desc"]
    : ["featured", "price_asc", "price_desc", "newest"];
  const sort = draft.sort && sortOptions.includes(draft.sort) ? draft.sort : sortOptions[0];
  const total = f?.total ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88vh] flex-col gap-0 rounded-t-2xl border-ff-black/15 bg-ff-cream p-0 md:mx-auto md:max-w-2xl"
      >
        <div className="border-b border-ff-black/15 px-5 py-4">
          <SheetTitle className="ff-headline text-xl text-ff-black">Filter &amp; sort</SheetTitle>
          <SheetDescription className="sr-only">
            Choose category, type, price, discount and order
          </SheetDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Section title="Category">
            {f && (
              <CategoryCircles
                mains={
                  draft.group
                    ? f.mains.filter((m) =>
                        mainInGroup(f.groups.find((g) => g.name === draft.group)?.mains, m.name),
                      )
                    : f.mains
                }
                active={draft.main}
                sale={sale}
                allUpto={f.headline_upto}
                layout="grid"
                onPick={(main) => set({ main, sub: undefined })}
              />
            )}
          </Section>

          {draft.main && f && f.subs.length > 0 && (
            <Section title="Type">
              <Option active={!draft.sub} onClick={() => set({ sub: undefined })}>
                All {draft.main}
              </Option>
              {f.subs.map((s) => (
                <Option
                  key={s.name}
                  active={draft.sub === s.name}
                  count={s.count}
                  onClick={() => set({ sub: s.name })}
                >
                  {s.name}
                </Option>
              ))}
            </Section>
          )}

          <Section title="Price">
            <Option active={draft.band === undefined} onClick={() => set({ band: undefined })}>
              Any price
            </Option>
            {/* Only price ranges that have products (or the one already picked). */}
            {f?.bands
              .filter((b) => b.count > 0 || draft.band === b.index)
              .map((b) => (
                <Option
                  key={b.index}
                  active={draft.band === b.index}
                  count={b.count}
                  onClick={() => set({ band: b.index })}
                >
                  {bandLabel(b)}
                </Option>
              ))}
          </Section>

          {sale && f && f.discounts.some((d) => d.count > 0 || draft.disc === d.min) && (
            <Section title="Discount">
              <Option active={!draft.disc} onClick={() => set({ disc: undefined })}>
                Any discount
              </Option>
              {f.discounts
                .filter((d) => d.count > 0 || draft.disc === d.min)
                .map((d) => (
                  <Option
                    key={d.min}
                    active={draft.disc === d.min}
                    count={d.count}
                    onClick={() => set({ disc: d.min })}
                  >
                    {d.min}% off or more
                  </Option>
                ))}
            </Section>
          )}

          <Section title="Sort by">
            {sortOptions.map((k) => (
              <Option key={k} active={sort === k} onClick={() => set({ sort: k })}>
                {SORT_LABELS[k]}
              </Option>
            ))}
          </Section>
        </div>

        <div
          className="flex items-center gap-3 border-t border-ff-black/15 px-5 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => setDraft({ q: draft.q, main: draft.main })}
            className="ff-subline h-12 px-2 text-sm text-ff-black underline underline-offset-2"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!f || total === 0}
            onClick={() =>
              onApply({
                group: draft.group,
                main: draft.main,
                sub: draft.sub,
                band: draft.band,
                disc: draft.disc,
                sort: draft.sort,
              })
            }
            className="ff-subline h-12 flex-1 rounded-full bg-ff-red text-base text-ff-cream disabled:opacity-50"
          >
            {!f
              ? "Loading"
              : total === 0
                ? "No products match"
                : `Show ${total} ${total === 1 ? "product" : "products"}`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="ff-headline mb-2.5 text-sm text-ff-black uppercase">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Option({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "ff-subline inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
        active
          ? "border-ff-red bg-ff-red text-ff-cream"
          : "border-ff-black/30 bg-ff-cream text-ff-black",
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn("tabular-nums text-xs", active ? "text-ff-cream/80" : "text-ff-black/50")}
        >
          {count}
        </span>
      )}
    </button>
  );
}
