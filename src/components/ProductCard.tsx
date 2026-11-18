import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { trackAddToCart } from "@/lib/analytics";
import { firstVariant, formatPrice, primaryImage, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const node = product.node;
  const image = primaryImage(node);
  const variant = firstVariant(node);
  // Show the price of the variant this card actually adds, not the cheapest one.
  const shownPrice = variant?.price ?? node.priceRange.minVariantPrice;
  const compareAtPrice = variant?.compareAtPrice;
  const isDiscounted = !!compareAtPrice && Number(compareAtPrice.amount) > Number(shownPrice.amount);
  const discountPercent = isDiscounted ? Math.round((1 - Number(shownPrice.amount) / Number(compareAtPrice!.amount)) * 100) : 0;
  const sizeCount = node.variants.edges.length;
  const addItem = useCartStore((state) => state.addItem);
  const [pending, setPending] = useState(false);

  const handleAdd = async () => {
    if (!variant) return;
    setPending(true);
    try {
      await addItem({
        product,
        variantId: variant.id,
        variantTitle: variant.title,
        price: variant.price,
        quantity: 1,
        selectedOptions: variant.selectedOptions,
      });
      trackAddToCart({
        id: variant.id,
        name: node.title,
        handle: node.handle,
        variant: variant.title,
        price: Number(variant.price.amount),
        currency: variant.price.currencyCode,
        quantity: 1,
      });
      toast.success("Added to cart", { description: node.title });
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="group flex flex-col">
      <Link
        to="/product/$handle"
        params={{ handle: node.handle }}
        className="block focus-visible:outline-none"
      >
        <div className="relative aspect-4/5 overflow-hidden rounded-lg border border-[#eadde0] bg-white">
          {image ? (
            <img
              src={image.url}
              alt={image.altText ?? node.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs tracking-[0.2em] text-muted-foreground uppercase">
              No photo
            </div>
          )}
          {isDiscounted && <span className="absolute top-2 left-2 rounded-full bg-[#ed1c32] px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase">{discountPercent}% OFF</span>}
          {variant && !variant.availableForSale && (
            <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase">
              Out of stock
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="text-[10px] tracking-[0.2em] text-[#ed1c32] uppercase">
            {node.productType || "Fyxx"}
          </p>
          <h3 className="mt-1 line-clamp-2 font-display text-xl leading-tight text-[#4b0719]">{node.title}</h3>
          <p className="mt-1 text-sm tabular-nums text-[#4b0719]">
            {formatPrice(shownPrice)}
          </p>
          {sizeCount > 1 && (
            <p className="mt-0.5 text-[10px] tracking-[0.16em] text-[#805d66] uppercase">
              {sizeCount} sizes
            </p>
          )}
        </div>
      </Link>
      <Button
        onClick={handleAdd}
        disabled={!variant || pending}
        variant="outline"
        size="sm"
        className="mt-3 w-full rounded-none border-[#ed1c32] bg-[#ed1c32] font-bold text-white hover:bg-[#c90f27] hover:text-white"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            Add to cart
          </>
        )}
      </Button>
    </article>
  );
}
