import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { trackAddToCart } from "@/lib/analytics";
import { RECS_DEFAULT, RECS_MAX, recsFor } from "@/lib/cart-recs";
import {
  formatPrice,
  getProductByHandle,
  primaryImage,
  type ShopifyProductNode,
  type ShopifyVariant,
} from "@/lib/shopify";
import type { CartItem } from "@/lib/shopify-cart";
import { useCartStore } from "@/stores/cartStore";

type Rec = { node: ShopifyProductNode; variant: ShopifyVariant; upsell: boolean };

const cheapestAvailable = (node: ShopifyProductNode): ShopifyVariant | undefined =>
  node.variants.edges
    .map((e) => e.node)
    .filter((v) => v.availableForSale)
    .sort((a, b) => Number(a.price.amount) - Number(b.price.amount))[0];

/** A larger or higher-priced version of something already in the cart. */
function findUpsell(items: CartItem[]): Rec | null {
  const inCart = new Set(items.map((i) => i.variantId));
  for (const item of items) {
    const node = item.product.node;
    const now = Number(item.price.amount) || 0;
    const bigger = node.variants.edges
      .map((e) => e.node)
      .filter((v) => v.availableForSale && !inCart.has(v.id) && Number(v.price.amount) > now)
      .sort((a, b) => Number(a.price.amount) - Number(b.price.amount))[0];
    if (bigger) return { node, variant: bigger, upsell: true };
  }
  return null;
}

/**
 * "You might also like" in the cart: one upsell (a bigger version of something
 * in the cart) and cross-sells for the product types in the cart, from the
 * hard-coded lists in src/lib/cart-recs.ts.
 */
export function CartRecommendations({ items }: { items: CartItem[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const [pending, setPending] = useState<string | null>(null);

  const handles = useMemo(() => {
    const inCart = new Set(items.map((i) => i.product.node.handle));
    // Take turns between the product types in the cart (1st gin pick, 1st
    // cigar pick, 2nd gin pick...), so every kind of item gets a suggestion.
    const lists = [...new Set(items.map((i) => i.product.node.productType))].map((t) => recsFor(t));
    const out: string[] = [];
    for (let k = 0; k < 4; k++) {
      for (const list of lists) {
        const h = list[k];
        if (h && !inCart.has(h) && !out.includes(h)) out.push(h);
      }
    }
    if (out.length === 0) for (const h of RECS_DEFAULT) if (!inCart.has(h)) out.push(h);
    return out.slice(0, RECS_MAX + 2);
  }, [items]);

  const results = useQueries({
    queries: handles.map((h) => ({
      queryKey: ["rec-product", h],
      queryFn: () => getProductByHandle(h),
      staleTime: 10 * 60_000,
    })),
  });

  const recs = useMemo(() => {
    const list: Rec[] = [];
    const upsell = findUpsell(items);
    if (upsell) list.push(upsell);
    for (const r of results) {
      const node = r.data;
      const v = node ? cheapestAvailable(node) : undefined;
      if (node && v && !list.some((x) => x.node.handle === node.handle)) {
        list.push({ node, variant: v, upsell: false });
      }
    }
    return list.slice(0, RECS_MAX);
    // results changes identity every render; its data is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, results.map((r) => r.data?.id ?? "").join(",")]);

  if (recs.length < 2) return null;

  const add = async ({ node, variant }: Rec) => {
    setPending(variant.id);
    try {
      await addItem({
        product: { node },
        variantId: variant.id,
        variantTitle: variant.title === "Default Title" ? "" : variant.title,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? null,
        quantity: 1,
        selectedOptions: variant.selectedOptions.filter((o) => o.name !== "Title"),
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
      setPending(null);
    }
  };

  return (
    <section aria-labelledby="cart-recs" className="border-t border-border pt-4 pb-2">
      <h3 id="cart-recs" className="ff-headline text-sm text-ff-black">
        You might also like
      </h3>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {recs.map((r) => {
          const img = primaryImage(r.node);
          const size =
            r.variant.title && r.variant.title !== "Default Title" ? r.variant.title : "";
          return (
            <li
              key={r.variant.id}
              className="flex flex-col rounded-lg border border-ff-black/10 bg-ff-cream p-2"
            >
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-white">
                {img && (
                  <img
                    src={img.url.includes("?") ? `${img.url}&width=240` : `${img.url}?width=240`}
                    alt=""
                    loading="lazy"
                    className="h-[85%] w-[85%] object-contain mix-blend-multiply"
                  />
                )}
                {r.upsell && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-ff-black px-2 py-0.5 text-[10px] text-ff-cream">
                    Go bigger
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-snug text-ff-black">{r.node.title}</p>
              {size && <p className="truncate text-[11px] text-muted-foreground">{size}</p>}
              <p className="mt-auto pt-1 text-sm tabular-nums">{formatPrice(r.variant.price)}</p>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void add(r)}
                className="ff-subline mt-2 inline-flex h-8 items-center justify-center gap-1 rounded-full bg-ff-red text-xs text-ff-cream hover:bg-ff-burgundy disabled:opacity-60"
              >
                {pending === r.variant.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add to cart
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
