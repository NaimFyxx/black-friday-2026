import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { trackBeginCheckout } from "@/lib/analytics";
import { CartRecommendations } from "@/components/cart/CartRecommendations";
import { FreeBottlesStrip } from "@/components/rewards/FreeBottlesStrip";
import { RewardsCartSheet } from "@/components/members/RewardsCartSheet";
import { formatJod, formatPrice } from "@/lib/shopify";
import { usePreview } from "@/lib/preview";
import { teaserQueryOptions } from "@/lib/teaser";
import { ReminderForm } from "@/components/reminder/ReminderForm";
import { useRewardsAuth } from "@/hooks/useRewardsAuth";
import { prefillCheckout } from "@/lib/rewards-auth";
import { refreshCartAttributes, setCartBuyerEmail, type CartItem } from "@/lib/shopify-cart";
import { withStoredUtm } from "@/lib/utm-attribution";
import { prepareCheckout } from "@/lib/checkout-handoff.functions";
import { selectCartCount, useCartStore } from "@/stores/cartStore";
import { useCartUi } from "@/stores/cartUiStore";

export function CartDrawer() {
  // Shared open state, so the floating cart bar can open this same drawer.
  const isOpen = useCartUi((s) => s.open);
  const setIsOpen = useCartUi((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  // After the sale: no crossed-out prices or savings.
  const teaserData = useQuery(teaserQueryOptions(usePreview())).data;
  const ended = teaserData?.state === "ended";
  // Checkout clicked: keep the spinner until the browser leaves for Shopify.
  const [goingToCheckout, setGoingToCheckout] = useState(false);
  useEffect(() => {
    // Back button from checkout (page restored from cache): button usable again.
    const reset = () => setGoingToCheckout(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const items = useCartStore((state) => state.items);
  const isLoading = useCartStore((state) => state.isLoading);
  const isSyncing = useCartStore((state) => state.isSyncing);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const getCheckoutUrl = useCartStore((state) => state.getCheckoutUrl);
  const cartId = useCartStore((state) => state.cartId);
  const syncCart = useCartStore((state) => state.syncCart);
  const prepareCheckoutFn = useServerFn(prepareCheckout);
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
  // Original (compare-at) price minus price, as Shopify reports them now.
  const totalSaved = items.reduce((sum, item) => {
    const cmp = item.compareAtPrice ? Number(item.compareAtPrice.amount) : 0;
    const price = Number(item.price.amount);
    return sum + (cmp > price ? (cmp - price) * item.quantity : 0);
  }, 0);

  // Signed-in Fyxx Rewards member: their email is attached to the cart at
  // checkout so Shopify pre-fills it and the order earns their points.
  const { user } = useRewardsAuth();

  // Attach the member's email / phone / saved address to the cart as soon as
  // they are signed in and a cart exists - not only when they click Checkout
  // here. So however they reach checkout later (a new navigation, or a checkout
  // page reloaded after they logged in), their details are already on the cart.
  // Best-effort and self-gating: no signed-in session means it is a no-op.
  useEffect(() => {
    if (user?.email && cartId) void prefillCheckout(cartId);
  }, [user?.email, cartId]);

  const handleCheckout = async () => {
    const checkoutUrl = getCheckoutUrl();
    if (checkoutUrl) {
      // One last check: if the cart is already completed (a previous order),
      // Shopify has deleted it, so don't send the shopper to a dead checkout.
      // syncCart clears a gone cart and returns "empty"; a network error ("error")
      // must not block a legitimate checkout.
      setGoingToCheckout(true);
      if ((await syncCart()) === "empty") {
        setGoingToCheckout(false);
        toast.success("Your last order went through. Your cart is now empty.");
        return;
      }
      const tracked = trackBeginCheckout(
        items.map((item) => ({
          id: item.variantId,
          name: item.product.node.title,
          handle: item.product.node.handle,
          variant: item.variantTitle,
          price: Number(item.price.amount),
          currency: item.price.currencyCode,
          quantity: item.quantity,
        })),
      );
      // Carry the latest campaign (UTMs + fbclid) onto checkout.
      const normal = withStoredUtm(checkoutUrl);
      // Checkout opens in this tab. It goes to the checkout page directly so
      // the Fyxx app does not take over (see checkout-handoff.functions.ts),
      // and falls back to the normal link. (The spinner is already on from the
      // pre-check above.)
      const go = (url: string) => {
        window.location.href = url;
      };
      // Latest campaign onto the cart first (orders read it), plus the signed-in
      // member's email so checkout pre-fills it and the order earns their
      // points. Then hand off.
      const email = user?.email;
      // Pre-fill the member's email (+ phone + saved address) on the cart. The
      // address is applied server-side; if that fails, fall back to email only.
      // Always attempt it (it self-gates: with no signed-in session it is a
      // no-op), so a member who logged in after the cart was made is covered
      // even if the client auth state had not caught up yet.
      const prefill = () =>
        prefillCheckout(cartId!).then((ok) =>
          ok ? undefined : email ? setCartBuyerEmail(cartId!, email).catch(() => {}) : undefined,
        );
      // Also wait (max ~1 s) for GA4 begin_checkout to go out before leaving.
      const prepared = (
        cartId
          ? Promise.all([refreshCartAttributes(cartId).catch(() => {}), prefill().catch(() => {})])
          : Promise.resolve()
      ).then(() => prepareCheckoutFn({ data: { url: normal } }));
      Promise.all([prepared, tracked.catch(() => {})])
        .then(([r]) => go(r ? withStoredUtm(r.url) : normal))
        .catch(() => go(normal));
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open cart"
          className="relative h-10 w-10 rounded-full border-border bg-ff-cream text-ff-black hover:bg-ff-cream hover:text-ff-red"
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
              : `${totalItems} item${totalItems !== 1 ? "s" : ""}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          {/* Free bottles bar (display only), always at the top of the cart.
              With items it scrolls with them, so the checkout button stays put. */}
          {items.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {!ended && <FreeBottlesStrip inCart className="mt-3 shrink-0" />}
              <div className="flex flex-1 items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Items and suggestions scroll together. Right padding keeps the
                  remove buttons clear of the scrollbar. */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-3">
                {!ended && <FreeBottlesStrip inCart className="mt-3" />}
                <ul className="divide-y divide-border py-2">
                  {items.map((item) => (
                    <li key={item.variantId} className="flex gap-4 py-4">
                      <div className="h-16 w-14 shrink-0 overflow-hidden rounded-sm bg-sand">
                        {item.product.node.images.edges[0]?.node && (
                          <img
                            src={item.product.node.images.edges[0].node.url}
                            alt={item.product.node.title}
                            className="h-full w-full object-cover mix-blend-multiply"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="line-clamp-2 font-display text-lg leading-tight">
                          {item.product.node.title}
                        </h4>
                        {/* Size etc.; nothing for single-option products ("Default Title"). */}
                        {variantLabel(item) && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {variantLabel(item)}
                          </p>
                        )}
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                          {!ended &&
                          item.compareAtPrice &&
                          Number(item.compareAtPrice.amount) > Number(item.price.amount) ? (
                            <>
                              <span className="text-ff-red">{formatPrice(item.price)}</span>
                              <s className="text-xs text-ff-black/55">
                                {formatPrice(item.compareAtPrice)}
                              </s>
                            </>
                          ) : (
                            formatPrice(item.price)
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${item.product.node.title}`}
                          className="h-8 w-8 text-muted-foreground hover:text-ff-red"
                          onClick={() => removeItem(item.variantId)}
                        >
                          <Trash2 className="h-4 w-4" />
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
                {!ended && <CartRecommendations items={items} />}
                <CartReminder />
              </div>

              <div className="shrink-0 border-t border-border py-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    Total
                  </span>
                  <span className="font-display text-2xl tabular-nums">
                    {formatJod(totalPrice, currency)}
                  </span>
                </div>
                {totalSaved > 0 && !ended && (
                  <p className="ff-num mt-1 text-right text-sm text-ff-red">
                    You're saving {formatJod(totalSaved, currency)}
                  </p>
                )}
                {/* Fyxx Rewards 2x points: one line, opens the tiers sheet.
                    Sale state (and ?preview=friday) only; null otherwise. */}
                <RewardsCartSheet className="mt-3" />
                <Button
                  onClick={handleCheckout}
                  size="lg"
                  className="mt-4 w-full rounded-full"
                  disabled={items.length === 0 || isLoading || isSyncing || goingToCheckout}
                >
                  {isLoading || isSyncing || goingToCheckout ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Checkout"
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

/** Before the sale, under the items: "Send me my cart at 10:00 on Friday". */
function CartReminder() {
  const { data } = useQuery(teaserQueryOptions(usePreview()));
  if (data?.state !== "preview" || !data.reminder) return null;
  return (
    <div className="shrink-0 border-t border-border py-4">
      <ReminderForm copy={data.reminder} source="cart" />
    </div>
  );
}

/** "70cl", "Red · 6 pack"... or "" when Shopify says "Default Title" (one option only). */
function variantLabel(item: CartItem): string {
  const fromOptions = item.selectedOptions
    .map((o) => o.value)
    .filter((v) => v && v !== "Default Title")
    .join(" · ");
  if (fromOptions) return fromOptions;
  return item.variantTitle && item.variantTitle !== "Default Title" ? item.variantTitle : "";
}
