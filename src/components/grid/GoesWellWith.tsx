import { useQuery } from "@tanstack/react-query";

import { CatalogCard } from "@/components/grid/CatalogCard";
import { fetchCatalogPage } from "@/lib/catalog";
import type { Preview } from "@/lib/preview";
import type { TeaserInfo } from "@/lib/teaser";

/**
 * Product pages for wine and spirits: up to 4 in-stock accessories from the
 * sale (bf_settings.goes_well_with picks which type for which product type).
 */
export function GoesWellWith({
  productType,
  productId,
  teaser,
  preview,
  sim,
}: {
  productType: string;
  productId: string;
  teaser: TeaserInfo | undefined;
  preview: Preview | null;
  sim: boolean;
}) {
  const rule = teaser?.goes_well_with?.find((r) => r.product_types.includes(productType));
  const sale = teaser?.state === "sale";
  const { data } = useQuery({
    queryKey: ["bf-goes-well", rule?.main, rule?.sub, preview ?? "", sim ? "sim" : ""],
    queryFn: () =>
      fetchCatalogPage(
        { main: rule!.main, sub: rule!.sub, sort: sale ? "discount" : undefined },
        0,
        preview,
        sim,
        8,
      ),
    enabled: !!rule && teaser?.state !== "ended",
    staleTime: 60_000,
  });
  const items = (data?.items ?? [])
    .filter((i) => i.available !== false && i.product_id !== productId)
    .slice(0, 4);
  if (!rule || items.length === 0) return null;
  return (
    <section className="mt-14 md:mt-20" aria-labelledby="goes-well-with">
      <h2 id="goes-well-with" className="ff-headline text-2xl md:text-3xl">
        {rule.title ?? "Goes well with"}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {items.map((item) => (
          <CatalogCard
            key={item.product_id}
            item={item}
            threshold={0}
            lowStockMax={sale ? (teaser?.low_stock_max ?? 5) : null}
            preSaleLabel={
              teaser?.state === "preview" ? (teaser.copy.sale_label_preview ?? null) : null
            }
          />
        ))}
      </div>
    </section>
  );
}
