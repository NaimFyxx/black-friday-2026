// The Shopify cart id as a URL-safe token, for the email restore link
// friday.myfyxx.com/?cart=<token> (see cart-restore.ts). No imports, so the
// analytics code can use it without import cycles.

export const CART_GID_PREFIX = "gid://shopify/Cart/";

/** "gid://shopify/Cart/abc?key=x" -> "abc%3Fkey%3Dx". */
export function cartToken(cartId: string | null | undefined): string | undefined {
  if (!cartId) return undefined;
  const short = cartId.startsWith(CART_GID_PREFIX) ? cartId.slice(CART_GID_PREFIX.length) : cartId;
  return encodeURIComponent(short);
}
