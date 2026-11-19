import type { CatalogItem } from "@/lib/catalog";

import { CatalogCard } from "./CatalogCard";

/** Sale only: a swipeable row of the biggest discounts (at least one per category when possible). */
export function TopDeals({ items, threshold }: { items: CatalogItem[]; threshold: number }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="top-deals" className="mt-6">
      <h2 id="top-deals" className="ff-headline text-xl text-ff-red uppercase md:text-2xl">
        Top deals
      </h2>
      <div className="-mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 md:scroll-px-10 gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] md:-mx-10 md:px-10">
        {items.map((item, i) => (
          <CatalogCard
            key={item.product_id}
            item={item}
            threshold={threshold}
            compact
            eager={i < 3}
          />
        ))}
      </div>
    </section>
  );
}
