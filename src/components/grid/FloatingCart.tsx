import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

import { formatJod } from "@/lib/shopify";
import { selectCartCount, useCartStore } from "@/stores/cartStore";
import { useCartUi } from "@/stores/cartUiStore";

/**
 * Floating cart bar: item count, total and what the shopper saves (original
 * Shopify compare-at price minus the price, refreshed from Shopify by the cart
 * sync). Opens the existing cart drawer.
 */

export function FloatingCart({ sale }: { sale: boolean }) {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((s) => s.items);
  const count = useCartStore(selectCartCount);
  const setOpen = useCartUi((s) => s.setOpen);
  useEffect(() => setMounted(true), []);

  // Stay out of the way while the hero's "Fill your cart" button is on screen
  // (on phones the bar would cover it). The header cart icon is always there.
  const [heroCtaVisible, setHeroCtaVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("hero-cta");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setHeroCtaVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, count]);

  if (!mounted || count === 0 || heroCtaVisible) return null;

  const total = items.reduce((sum, i) => sum + Number(i.price.amount) * i.quantity, 0);
  const saved = items.reduce((sum, i) => {
    const cmp = i.compareAtPrice ? Number(i.compareAtPrice.amount) : 0;
    const price = Number(i.price.amount);
    return sum + (cmp > price ? (cmp - price) * i.quantity : 0);
  }, 0);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed inset-x-4 bottom-4 z-40 flex items-center gap-3 rounded-full bg-ff-burgundy px-5 py-3 text-left text-ff-cream shadow-lg md:right-6 md:left-auto md:w-96"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ShoppingBag className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="ff-num block text-sm">
          {count} item{count === 1 ? "" : "s"} · {formatJod(total)}
        </span>
        {saved > 0 && (
          <span className="ff-num block text-xs text-ff-warm-cream">
            You save {formatJod(saved)}
          </span>
        )}
      </span>
      <span className="ff-subline shrink-0 rounded-full bg-ff-red px-3 py-1 text-xs">
        View cart
      </span>
    </button>
  );
}
