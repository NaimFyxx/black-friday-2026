import { memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { trackAddToCart } from "@/lib/analytics";
import { discountBadge, sizedImage, toCartProduct, type CatalogItem } from "@/lib/catalog";
import { formatJod } from "@/lib/shopify";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cartStore";

/**
 * One product in the Fyxx Friday grid (or the Top deals strip when `compact`).
 * During the sale: badge ("-15%" under the threshold, "Save JOD 12.000" above)
 * plus the crossed-out Shopify compare-at price and the new price. Before the
 * sale the data has no compare-at, so only the normal price shows.
 */
export const CatalogCard = memo(function CatalogCard({
  item,
  threshold,
  compact = false,
  eager = false,
}: {
  item: CatalogItem;
  threshold: number;
  compact?: boolean;
  eager?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const [pending, setPending] = useState(false);
  const badge = discountBadge(item, threshold);
  const hasCompare = item.compare_at_price !== null && item.compare_at_price > item.price;
  const variantTitle =
    item.variant_title && item.variant_title !== "Default Title" ? item.variant_title : "";

  const handleAdd = async () => {
    setPending(true);
    try {
      const money = (n: number) => ({ amount: n.toFixed(3), currencyCode: "JOD" });
      await addItem({
        product: toCartProduct(item),
        variantId: item.variant_id,
        variantTitle,
        price: money(item.price),
        compareAtPrice: hasCompare ? money(item.compare_at_price!) : null,
        quantity: 1,
        selectedOptions: [],
      });
      trackAddToCart({
        id: item.variant_id,
        name: item.title,
        handle: item.handle,
        variant: item.variant_title ?? "",
        price: item.price,
        currency: "JOD",
        quantity: 1,
      });
      toast.success("Added to cart", { description: item.title });
    } finally {
      setPending(false);
    }
  };

  return (
    <article
      className={cn("flex flex-col", compact && "w-40 shrink-0 snap-start md:w-48")}
      // Off-screen cards skip layout and paint: keeps long grids smooth on phones.
      style={
        compact ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 420px" }
      }
    >
      <Link
        to="/product/$handle"
        params={{ handle: item.handle }}
        className="block focus-visible:outline-none"
      >
        <div className="relative aspect-4/5 overflow-hidden rounded-lg border border-ff-black/15 bg-ff-cream">
          {item.image_url ? (
            <img
              src={sizedImage(item.image_url, 400)}
              srcSet={`${sizedImage(item.image_url, 300)} 300w, ${sizedImage(item.image_url, 500)} 500w, ${sizedImage(item.image_url, 700)} 700w`}
              sizes={compact ? "200px" : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
              alt={item.title}
              width={400}
              height={500}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover mix-blend-multiply"
            />
          ) : (
            <div className="ff-small flex h-full items-center justify-center text-xs text-ff-black uppercase">
              No photo
            </div>
          )}
          {badge && (
            <span className="ff-num absolute top-2 left-2 rounded-full bg-ff-red px-2.5 py-1 text-[11px] text-ff-cream">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="ff-small text-[10px] tracking-[0.16em] text-ff-red uppercase">
            {item.sub_category ?? item.main_category}
          </p>
          <h3
            className={cn(
              "ff-subline mt-1 line-clamp-2 leading-tight text-ff-black",
              compact ? "text-sm" : "text-base md:text-lg",
            )}
          >
            {item.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span
              className={cn(
                "ff-num",
                hasCompare ? "text-ff-red" : "text-ff-black",
                compact ? "text-sm" : "text-base",
              )}
            >
              {formatJod(item.price)}
            </span>
            {hasCompare && (
              <s className="ff-small text-xs text-ff-black/60 tabular-nums">
                {formatJod(item.compare_at_price!)}
              </s>
            )}
          </p>
        </div>
      </Link>
      {!compact && (
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending}
          className="ff-subline mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 bg-ff-red text-sm text-ff-cream transition-colors hover:bg-ff-burgundy disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Add to cart
            </>
          )}
        </button>
      )}
    </article>
  );
});
