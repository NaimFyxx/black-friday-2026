import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatPrice } from "@/lib/shopify";
import { selectCartCount, useCartStore } from "@/stores/cartStore";

export function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const isLoading = useCartStore((state) => state.isLoading);
  const isSyncing = useCartStore((state) => state.isSyncing);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const getCheckoutUrl = useCartStore((state) => state.getCheckoutUrl);
  const syncCart = useCartStore((state) => state.syncCart);
  const totalItems = useCartStore(selectCartCount);

  useEffect(() => setMounted(true), []);

  // Catch cart state changed elsewhere (checkout tab, another device) on open.
  useEffect(() => {
    if (isOpen) syncCart();
  }, [isOpen, syncCart]);

  const totalPrice = items.reduce(
    (sum, item) => sum + Number(item.price.amount) * item.quantity,
    0,
  );
  const currency = items[0]?.price.currencyCode ?? "JOD";

  const handleCheckout = () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      setIsOpen(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open cart"
          className="relative h-10 w-10 rounded-full border-border bg-background"
        >
          <ShoppingBag className="h-4 w-4" />
          {mounted && totalItems > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-none text-primary-foreground">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 border-border bg-background sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-2xl">Your cart</SheetTitle>
          <SheetDescription className="text-xs tracking-[0.18em] uppercase">
            {totalItems === 0
              ? "Nothing in here yet"
              : `${totalItems} item${totalItems !== 1 ? "s" : ""} held in Shopify`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            </div>
          ) : (
            <>
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto py-2">
                {items.map((item) => (
                  <li key={item.variantId} className="flex gap-4 py-4">
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-sm bg-sand">
                      {item.product.node.images.edges[0]?.node && (
                        <img
                          src={item.product.node.images.edges[0].node.url}
                          alt={item.product.node.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-display text-lg leading-tight">
                        {item.product.node.title}
                      </h4>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.selectedOptions.map((o) => o.value).join(" · ") || item.variantTitle}
                      </p>
                      <p className="mt-1 text-sm tabular-nums">{formatPrice(item.price)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.product.node.title}`}
                        className="h-6 w-6 text-muted-foreground"
                        onClick={() => removeItem(item.variantId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex items-center gap-1 rounded-full border border-border">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Decrease quantity"
                          className="h-7 w-7 rounded-full"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Increase quantity"
                          className="h-7 w-7 rounded-full"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="shrink-0 border-t border-border py-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Total
                  </span>
                  <span className="font-display text-2xl tabular-nums">
                    {totalPrice.toFixed(2)} {currency}
                  </span>
                </div>
                <Button
                  onClick={handleCheckout}
                  size="lg"
                  className="mt-4 w-full rounded-full"
                  disabled={items.length === 0 || isLoading || isSyncing}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      Checkout with Shopify
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
