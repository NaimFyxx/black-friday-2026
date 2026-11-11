import { useEffect } from "react";

import { useCartStore } from "@/stores/cartStore";

/**
 * Clears the local cart once Shopify reports it empty — that is how a completed
 * checkout (or an expired cart) is detected after the tab comes back.
 */
export function useCartSync() {
  const syncCart = useCartStore((state) => state.syncCart);

  useEffect(() => {
    syncCart();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncCart();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncCart]);
}
