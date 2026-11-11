import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  firstVariant,
  formatPrice,
  getProductByHandle,
  primaryImage,
  stripHtml,
  type ShopifyVariant,
} from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ params }) => {
    const product = await getProductByHandle(params.handle);
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — Fyxx` : "Product — Fyxx";
    const description = loaderData
      ? stripHtml(loaderData.descriptionHtml).slice(0, 180) ||
        `${loaderData.title} from the Fyxx cellar in Amman.`
      : "A bottle from the Fyxx cellar in Amman.";
    const image = loaderData ? primaryImage(loaderData)?.url : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [{ property: "og:image", content: image }] : []),
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <p className="text-sm text-muted-foreground">No products found</p>
      <Link
        to="/"
        search={{ q: undefined, category: "all" }}
        className="mt-6 inline-flex items-center rounded-full border border-border px-5 py-2 text-[11px] tracking-[0.18em] uppercase"
      >
        Back to the catalog
      </Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto max-w-6xl px-6 py-24 text-sm text-muted-foreground">
      This product could not be loaded. {error instanceof Error ? error.message : String(error)}
    </div>
  ),
});

function ProductPage() {
  const product = Route.useLoaderData();
  const variants = product.variants.edges.map((edge) => edge.node);
  const [selected, setSelected] = useState<ShopifyVariant | null>(
    () => variants.find((variant) => variant.availableForSale) ?? firstVariant(product),
  );
  const image = primaryImage(product);
  const addItem = useCartStore((state) => state.addItem);
  const [pending, setPending] = useState(false);

  const handleAdd = async () => {
    if (!selected) return;
    setPending(true);
    try {
      await addItem({
        product: { node: product },
        variantId: selected.id,
        variantTitle: selected.title,
        price: selected.price,
        quantity: 1,
        selectedOptions: selected.selectedOptions,
      });
      toast.success("Added to cart", { description: product.title });
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:py-16">
      <Link
        to="/"
        search={{ q: undefined, category: "all" }}
        className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
      >
        ← Back to the catalog
      </Link>

      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="aspect-square overflow-hidden rounded-sm bg-sand">
          {image ? (
            <img
              src={image.url}
              alt={image.altText ?? product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs tracking-[0.2em] text-muted-foreground uppercase">
              No photo
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <p className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            {product.productType || "Fyxx"} · {product.vendor}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-[1.02]">{product.title}</h1>
          <p className="mt-4 font-display text-3xl tabular-nums">
            {formatPrice(selected?.price ?? product.priceRange.minVariantPrice)}
          </p>

          {variants.length > 1 && (
            <div className="mt-8">
              <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                {product.options[0]?.name ?? "Option"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelected(variant)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      selected?.id === variant.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-foreground",
                      !variant.availableForSale && "opacity-40",
                    )}
                  >
                    {variant.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleAdd}
            size="lg"
            disabled={!selected?.availableForSale || pending}
            className="mt-8 w-full max-w-sm rounded-full"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {selected?.availableForSale ? "Add to cart" : "Out of stock"}
              </>
            )}
          </Button>

          <div className="mt-10 border-t border-border pt-6">
            <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              About this bottle
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {stripHtml(product.descriptionHtml) || "No description yet."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
