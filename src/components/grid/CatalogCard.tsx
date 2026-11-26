import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePreview } from "@/lib/preview";
import { teaserQueryOptions } from "@/lib/teaser";
import { Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { trackAddToCart } from "@/lib/analytics";
import { discountBadge, sizedImage, toCartProduct, type CatalogItem } from "@/lib/catalog";
import {
  formatJod,
  getProductByHandle,
  type ShopifyProductNode,
  type ShopifyVariant,
} from "@/lib/shopify";
import { cn } from "@/lib/utils";

import { onlySaleVariants } from "@/lib/sale-variants.functions";

import { VariantPicker } from "./VariantPicker";
import { useCartStore } from "@/stores/cartStore";
import { FreeBottlesLine } from "@/components/rewards/FreeBottlesLine";

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
  preSaleLabel = null,
  lowStockMax = null,
}: {
  item: CatalogItem;
  threshold: number;
  compact?: boolean;
  eager?: boolean;
  /** Before Friday 10:00: text after a blurred "-XX%" on sale-list products ("off on Friday"). */
  preSaleLabel?: string | null;
  /** During the sale: show "Only X left" when this many or fewer are left. */
  lowStockMax?: number | null;
}) {
  const soldOut = item.available === false;
  const { data: teaser } = useQuery(teaserQueryOptions(usePreview()));
  const lastPiece = !soldOut && teaser?.last_piece === true && item.stock === 1;
  const lowStock =
    !soldOut && lowStockMax && item.stock != null && item.stock > 0 && item.stock <= lowStockMax
      ? item.stock
      : null;
  const addItem = useCartStore((s) => s.addItem);
  const [pending, setPending] = useState(false);
  const badge = discountBadge(item, threshold);
  const hasCompare = item.compare_at_price !== null && item.compare_at_price > item.price;
  const variantTitle =
    item.variant_title && item.variant_title !== "Default Title" ? item.variant_title : "";

  const [picker, setPicker] = useState<ShopifyProductNode | null>(null);

  // Put one variant in the cart (from the picker, or the only one there is).
  const addVariant = async (node: ShopifyProductNode, v: ShopifyVariant) => {
    await addItem({
      product: { node },
      variantId: v.id,
      variantTitle: v.title === "Default Title" ? "" : v.title,
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? null,
      quantity: 1,
      selectedOptions: v.selectedOptions.filter((o) => o.name !== "Title"),
    });
    trackAddToCart({
      id: v.id,
      name: node.title,
      handle: node.handle,
      variant: v.title,
      price: Number(v.price.amount),
      currency: v.price.currencyCode,
      quantity: 1,
    });
    toast.success("Added to cart", { description: node.title });
  };

  // More than one option (size, vintage, pack...): ask which one first.
  const handleAdd = async () => {
    setPending(true);
    try {
      // Only sizes on the Fyxx Friday sale list can be picked. If anything
      // fails, the catalog's own (in-sale) variant is added below.
      const node = await getProductByHandle(item.handle)
        .then((p) => (p ? onlySaleVariants(p) : null))
        .catch(() => null);
      const variants = node?.variants.edges.map((e) => e.node) ?? [];
      if (node && variants.length > 1) {
        setPicker(node);
        return;
      }
      if (node && variants[0]) {
        await addVariant(node, variants[0]);
        return;
      }
      // Shopify lookup failed: add the variant from the catalog index.
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
      className={cn("flex h-full flex-col", compact && "w-40 shrink-0 snap-start md:w-48")}
      // Off-screen cards skip layout and paint: keeps long grids smooth on phones.
      style={
        compact ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 420px" }
      }
    >
      <Link
        to="/product/$handle"
        params={{ handle: item.handle }}
        preload="intent"
        className="block flex-1 focus-visible:outline-none"
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
              className={cn(
                "h-full w-full object-cover mix-blend-multiply",
                soldOut && "opacity-40 grayscale",
              )}
            />
          ) : (
            <div className="ff-small flex h-full items-center justify-center text-xs text-ff-black uppercase">
              No photo
            </div>
          )}
          {preSaleLabel && item.in_sale && !badge && (
            <span className="ff-num absolute top-2 left-2 max-w-[calc(100%-1rem)] rounded-full bg-ff-red px-2.5 py-1 text-[11px] leading-tight text-ff-cream">
              {item.planned_percent && item.planned_percent > 0 ? (
                // The planned Friday % (bf_settings.show_planned_discount on).
                <>
                  -{item.planned_percent}% <span className="ff-subline">{preSaleLabel}</span>
                </>
              ) : (
                <>
                  {/* No planned % for this card: a blurred blank, not a number. */}-
                  <span
                    aria-hidden
                    className="mx-0.5 inline-block h-2.5 w-4 rounded-sm bg-ff-cream/80 align-middle blur-[2px]"
                  />
                  % <span className="ff-subline">{preSaleLabel}</span>
                </>
              )}
            </span>
          )}
          {badge && !soldOut && (
            <span className="ff-num absolute top-2 left-2 rounded-full bg-ff-red px-2.5 py-1 text-[11px] text-ff-cream">
              {badge}
            </span>
          )}
          {soldOut && (
            <span className="ff-subline absolute top-2 left-2 rounded-full bg-ff-black px-2.5 py-1 text-[11px] text-ff-cream">
              Sold out
            </span>
          )}
        </div>
        <div className="mt-3">
          {/* Fixed height (three title lines + the type line) keeps cards lined up. */}
          <div className={cn("mt-1", compact ? "h-[80px]" : "h-[80px] md:h-[96px]")}>
            <h3
              className={cn(
                "ff-subline line-clamp-3 text-ff-black",
                compact ? "text-sm/5" : "text-[15px]/5 md:text-lg/6",
              )}
            >
              {item.title}
            </h3>
            {item.product_type ? (
              <p className="ff-small truncate text-xs/5 text-ff-black/60">
                {/* Shopify's type is "Cigars"; one card is one cigar. Display only. */}
                {item.product_type === "Cigars" ? "Cigar" : item.product_type}
              </p>
            ) : null}
          </div>
          <p className="mt-1 flex min-h-6 flex-wrap items-baseline gap-x-2 leading-6">
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
          {!compact && !soldOut && <FreeBottlesLine className="mt-1" />}
          {lastPiece ? (
            <p className="ff-subline mt-0.5 text-xs text-ff-red">Last piece</p>
          ) : (
            lowStock !== null && (
              <p className="ff-subline mt-0.5 text-xs text-ff-red">Only {lowStock} left</p>
            )
          )}
        </div>
      </Link>
      {/* Sold out: no add button; an empty row keeps the cards lined up. */}
      {!compact && soldOut && <div aria-hidden className="mt-3 h-9" />}
      {!compact && !soldOut && (
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
      <VariantPicker
        product={picker}
        open={picker !== null}
        onOpenChange={(o) => {
          if (!o) setPicker(null);
        }}
        onAdd={(v) => addVariant(picker!, v)}
      />
    </article>
  );
});
