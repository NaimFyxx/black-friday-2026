import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { sizedImage } from "@/lib/catalog";
import {
  formatPrice,
  primaryImage,
  type ShopifyProductNode,
  type ShopifyVariant,
} from "@/lib/shopify";
import { cn } from "@/lib/utils";

/**
 * Shown when a product on the landing page has more than one option (size,
 * vintage, pack...): the shopper picks one before anything goes in the cart.
 * Prices and stock come from Shopify.
 */
export function VariantPicker({
  product,
  open,
  onOpenChange,
  onAdd,
}: {
  product: ShopifyProductNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (variant: ShopifyVariant) => Promise<void>;
}) {
  const variants = product?.variants.edges.map((e) => e.node) ?? [];
  const inStock = variants.filter((v) => v.availableForSale);
  const [chosen, setChosen] = useState<ShopifyVariant | null>(null);
  const [adding, setAdding] = useState(false);

  // Fresh choice each time; if only one option is in stock, pick it already.
  useEffect(() => {
    if (open) setChosen(inStock.length === 1 ? inStock[0]! : null);
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) return null;
  const image = primaryImage(product);
  const optionName =
    product.options[0]?.name && product.options[0].name !== "Title"
      ? product.options[0].name
      : "Option";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-2xl border-ff-black/15 bg-ff-cream p-0 md:mx-auto md:max-w-lg"
      >
        <div className="flex items-center gap-4 border-b border-ff-black/15 px-5 py-4 pr-12">
          {image && (
            <img
              src={sizedImage(image.url, 160)}
              alt=""
              width={56}
              height={70}
              className="h-[70px] w-14 shrink-0 rounded-md bg-ff-cream object-contain mix-blend-multiply"
            />
          )}
          <div className="min-w-0">
            <SheetTitle className="ff-subline line-clamp-2 text-base leading-tight text-ff-black">
              {product.title}
            </SheetTitle>
            <SheetDescription className="ff-small mt-1 text-xs text-ff-black/70">
              Choose a {optionName.toLowerCase()} to add to your cart
            </SheetDescription>
          </div>
        </div>

        <fieldset className="px-5 py-4">
          <legend className="ff-headline mb-2.5 text-sm text-ff-black uppercase">
            {optionName}
          </legend>
          <div className="grid gap-2">
            {variants.map((v) => {
              const discounted =
                !!v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount);
              const active = chosen?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!v.availableForSale}
                  onClick={() => setChosen(v)}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left transition-colors",
                    active
                      ? "border-ff-red bg-ff-red text-ff-cream"
                      : "border-ff-black/25 bg-ff-cream text-ff-black",
                    !v.availableForSale && "opacity-45",
                  )}
                >
                  <span className="ff-subline text-sm">{v.title}</span>
                  <span className="flex flex-wrap items-baseline justify-end gap-x-2 text-right">
                    {!v.availableForSale ? (
                      <span className="ff-small text-xs">Sold out</span>
                    ) : (
                      <>
                        <span
                          className={cn("ff-num text-sm", !active && discounted && "text-ff-red")}
                        >
                          {formatPrice(v.price)}
                        </span>
                        {discounted && (
                          <s
                            className={cn(
                              "ff-small text-xs",
                              active ? "text-ff-cream/75" : "text-ff-black/55",
                            )}
                          >
                            {formatPrice(v.compareAtPrice!)}
                          </s>
                        )}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div
          className="sticky bottom-0 border-t border-ff-black/15 bg-ff-cream px-5 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            disabled={!chosen || adding}
            onClick={async () => {
              if (!chosen) return;
              setAdding(true);
              try {
                await onAdd(chosen);
                onOpenChange(false);
              } finally {
                setAdding(false);
              }
            }}
            className="ff-subline flex h-12 w-full items-center justify-center rounded-full bg-ff-red text-base text-ff-cream disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : chosen ? (
              `Add to cart · ${formatPrice(chosen.price)}`
            ) : (
              `Choose a ${optionName.toLowerCase()}`
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
