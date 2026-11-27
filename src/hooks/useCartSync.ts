import { useEffect } from "react";

import { useCartStore } from "@/stores/cartStore";

/**
 * Re-reads the cart from Shopify on load and whenever the tab or app webview
 * comes back into view, so a completed checkout (Shopify deletes the cart on
 * order creation) or an expired cart is detected and cleared.
 *
 * Checkout opens in the same tab, so shoppers usually return with the browser
 * back button from Shopify's thank-you page. That restores the page from the
 * back-forward cache: there is no re-mount and no `visibilitychange`, only
 * `pageshow`. We also listen for `focus` (app webview / window regains focus).
 */
export function useCartSync() {
  const syncCart = useCartStore((state) => state.syncCart);

  useEffect(() => {
    const sync = () => {
      void syncCart();
    };

    sync(); // first load

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };
    // Fires on a normal load and on a back-forward cache restore (back button).
    const handlePageShow = () => sync();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", sync);
    };
  }, [syncCart]);
}
