import { useEffect, useState } from "react";

/**
 * False on the server and during the browser's first (hydration) render, true
 * right after. Anything that depends on the visitor's own state (cart,
 * cookies, localStorage, the clock) renders only once this is true, so the
 * first browser render matches the server HTML exactly (no React #418).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
