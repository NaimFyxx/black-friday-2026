import { useEffect, useRef } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { useQuery } from "@tanstack/react-query";

import { giftProgress } from "@/lib/mystery-gift";
import { usePreview } from "@/lib/preview";
import { teaserQueryOptions } from "@/lib/teaser";
import { useCartStore } from "@/stores/cartStore";

const SEEN_KEY = "fyxx:gift-unlocked";

/**
 * Every time the cart total passes a new mystery gift marker (each 50 JOD),
 * congratulate the shopper on the page. Only counts going up: taking an item
 * out and adding it back doesn't repeat the message in the same visit.
 */
export function GiftUnlockNotifier() {
  const items = useCartStore((s) => s.items);
  const best = useRef<number | null>(null);
  // Switched on/off in bf_settings.mystery_gift_enabled.
  const on = !!useQuery(teaserQueryOptions(usePreview())).data?.mystery_gift;

  useEffect(() => {
    if (!on || window.location.pathname.startsWith("/admin")) return;
    const total = items.reduce((sum, i) => sum + Number(i.price.amount) * i.quantity, 0);
    const { unlocked } = giftProgress(total);
    if (best.current === null) {
      // First look after the page loads: remember where the cart already is.
      let seen = 0;
      try {
        seen = Number(window.sessionStorage.getItem(SEEN_KEY)) || 0;
      } catch {
        // no sessionStorage
      }
      best.current = Math.max(seen, unlocked);
      return;
    }
    if (unlocked > best.current) {
      best.current = unlocked;
      try {
        window.sessionStorage.setItem(SEEN_KEY, String(unlocked));
      } catch {
        // no sessionStorage
      }
      // The "Added to cart" message comes right after the cart changes; let it
      // appear, then replace it with the gift message so they don't overlap.
      window.setTimeout(() => {
        toast.dismiss();
        showGiftToast();
      }, 700);
    }
  }, [items, on]);

  return null;
}

function showGiftToast() {
  toast.custom(
    () => (
      <div className="flex w-[min(92vw,380px)] items-start gap-3 rounded-2xl bg-ff-burgundy px-4 py-3.5 text-ff-cream shadow-xl">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ff-red">
          <Gift className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="ff-headline block text-base">Congratulations!</span>
          <span className="block text-sm leading-snug">
            Exclusive gift from The Green Room unlocked.
          </span>
          <span className="mt-0.5 block text-xs text-ff-warm-cream">
            Keep adding for an even better one.
          </span>
        </span>
      </div>
    ),
    { duration: 5000 },
  );
}
