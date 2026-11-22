import type { CatalogFilters } from "@/lib/catalog";
import type { QuickLink } from "@/lib/teaser";
import { cn } from "@/lib/utils";

/**
 * Shortcut chips at the top of the shop on Friday (bf_settings.quick_links):
 * Wine, Spirits, Cigars, Accessories, Under 20 JOD, Up to 50% off... A link
 * with "mains" works like a header section (?group=<label>), one with "band"
 * is a price band. Tapping the active one again clears it.
 */
export function QuickLinks({
  links,
  sale,
  filters,
  onPick,
}: {
  links: QuickLink[];
  sale: boolean;
  filters: CatalogFilters;
  onPick: (patch: Partial<CatalogFilters>) => void;
}) {
  const shown = links.filter((l) => sale || !l.sale_only);
  if (shown.length === 0) return null;
  const clear = { group: undefined, main: undefined, sub: undefined, band: undefined };
  return (
    <nav aria-label="Quick links" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2 md:w-auto md:flex-wrap md:justify-center">
        {shown.map((l) => {
          const active = l.mains
            ? filters.group === l.label
            : l.band !== undefined && filters.band === l.band && !filters.group;
          return (
            <li key={l.label}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onPick(
                    active
                      ? clear
                      : l.mains
                        ? { ...clear, group: l.label }
                        : { ...clear, band: l.band },
                  )
                }
                className={cn(
                  "ff-subline h-9 rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-ff-red bg-ff-red text-ff-cream"
                    : l.sale_only
                      ? "border-ff-red text-ff-red hover:bg-ff-red hover:text-ff-cream"
                      : "border-ff-black/30 text-ff-black hover:border-ff-red",
                )}
              >
                {l.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
