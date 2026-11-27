import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { trackAddToCart } from "@/lib/analytics";
import {
  formatPrice,
  getProductByHandle,
  primaryImage,
  type ShopifyProductNode,
  type ShopifyVariant,
} from "@/lib/shopify";
import type { CartItem } from "@/lib/shopify-cart";
import { useCartStore } from "@/stores/cartStore";

type Rec = { node: ShopifyProductNode; variant: ShopifyVariant; pct: number };
type Pick = { handle: string; variant_id: string; pct: number };

/** How many suggestions to show. */
const RECS_MAX = 4;

/**
 * "You might also like" in the cart: discounted Fyxx Friday products related
 * to the cart (bf_cart_recs): same categories first, a similar budget, closest
 * price first, categories taking turns. Only products with a discount (the
 * planned Friday % before 10:00, the live one after). Prices come from Shopify.
 */
export function CartRecommendations({ items }: { items: CartItem[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const [pending, setPending] = useState<string | null>(null);

  const cartHandles = useMemo(
    () => [...new Set(items.map((i) => i.product.node.handle))].sort(),
    [items],
  );
  const { data: picks = [] } = useQuery({
    queryKey: ["cart-recs", cartHandles],
    queryFn: async (): Promise<Pick[]> => {
      const { data, error } = await supabase.rpc(
        "bf_cart_recs" as never,
        { p_handles: cartHandles, p_limit: RECS_MAX + 2 } as never,
      );
      if (error) return [];
      const list: unknown = data;
      return Array.isArray(list) ? (list as Pick[]) : [];
    },
    staleTime: 60_000,
    enabled: cartHandles.length > 0,
  });

  const results = useQueries({
    queries: picks.map((p) => ({
      queryKey: ["rec-product", p.handle],
      queryFn: () => getProductByHandle(p.handle),
      staleTime: 10 * 60_000,
    })),
  });

  const recs = useMemo(() => {
    const inCart = new Set(items.map((i) => i.variantId));
    const list: Rec[] = [];
    picks.forEach((p, i) => {
      const node = results[i]?.data;
      if (!node) return;
      const variants = node.variants.edges.map((e) => e.node);
      // The discounted size from the sale list; any in-stock size if Shopify differs.
      const v =
        variants.find((x) => x.id === p.variant_id && x.availableForSale) ??
        variants.find((x) => x.availableForSale);
      if (v && !inCart.has(v.id)) list.push({ node, variant: v, pct: Number(p.pct) || 0 });
    });
    return list.slice(0, RECS_MAX);
    // results changes identity every render; its data is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, picks, results.map((r) => r.data?.id ?? "").join(",")]);

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
                {r.pct > 0 && (
                  <span className="ff-num absolute top-1.5 left-1.5 rounded-full bg-ff-red px-2 py-0.5 text-[10px] text-ff-cream">
                    -{r.pct}% off
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
