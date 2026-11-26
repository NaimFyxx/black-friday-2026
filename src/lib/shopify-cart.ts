/**
 * Cart + checkout mutations against the Shopify Storefront API.
 *
 * Every checkout URL comes from the API response, never hand-built. Checkout
 * opens in the same tab (see CartDrawer), with `channel=online_store` so it
 * does not hit the storefront password wall.
 */

import { getSessionId, getVisitorId, trackingOff } from "@/lib/analytics";
import { CART_ATTR } from "@/lib/campaign-config";
import { storefrontApiRequest, type ShopifyProduct } from "@/lib/shopify";
import { getFirstReferrer, getStoredUtm } from "@/lib/utm-attribution";

/** Session + last-touch UTMs and fbclid as Shopify cart attributes (empty values dropped). */
function campaignCartAttributes(): Array<{ key: string; value: string }> {
  // Tracking switched off (in /admin): leave test orders out of the reports.
  if (trackingOff()) return [];
  const utm = getStoredUtm() ?? {};
  const pairs: Array<[string, string | undefined]> = [
    [CART_ATTR.session, getSessionId() || "unknown"],
    [CART_ATTR.visitor, getVisitorId()],
    [CART_ATTR.source, utm.utm_source],
    [CART_ATTR.medium, utm.utm_medium],
    [CART_ATTR.campaign, utm.utm_campaign],
    [CART_ATTR.content, utm.utm_content],
    [CART_ATTR.term, utm.utm_term],
    [CART_ATTR.fbclid, utm.fbclid],
    // Untagged visitors: where they came from, so their orders match their
    // visits on the Sources page.
    [CART_ATTR.referrer, utm.utm_source ? undefined : getFirstReferrer()],
  ];
  return pairs.filter((p): p is [string, string] => !!p[1]).map(([key, value]) => ({ key, value }));
}

const CART_ATTRIBUTES_UPDATE_MUTATION = `
  mutation cartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
    cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
      userErrors { field message }
    }
  }
`;

/**
 * Right before checkout: put the visitor's latest campaign on the cart. The
 * cart may have been made on an earlier visit from another ad; Shopify
 * replaces all attributes with this list, so stale values don't linger.
 */
export async function refreshCartAttributes(cartId: string): Promise<void> {
  if (trackingOff()) return;
  const data = await storefrontApiRequest<{
    cartAttributesUpdate?: { userErrors?: Array<{ message: string }> };
  }>(CART_ATTRIBUTES_UPDATE_MUTATION, { cartId, attributes: campaignCartAttributes() });
  const errors = data?.data?.cartAttributesUpdate?.userErrors ?? [];
  if (errors.length) console.error("Cart attributes update failed:", errors);
}

const CART_BUYER_IDENTITY_MUTATION = `
  mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      userErrors { field message }
    }
  }
`;

/**
 * Put the signed-in member's email on the cart so Shopify checkout pre-fills it
 * and the order (and its Fyxx Rewards points) are tied to their account. Called
 * right before handoff. The Storefront API sets it on the cart by id, so the
 * checkout URL is unchanged. Best-effort: never blocks checkout.
 */
export async function setCartBuyerEmail(cartId: string, email: string): Promise<void> {
  if (!cartId || !email) return;
  try {
    const data = await storefrontApiRequest<{
      cartBuyerIdentityUpdate?: { userErrors?: Array<{ message: string }> };
    }>(CART_BUYER_IDENTITY_MUTATION, { cartId, buyerIdentity: { email } });
    const errors = data?.data?.cartBuyerIdentityUpdate?.userErrors ?? [];
    if (errors.length) console.error("Cart buyer identity update failed:", errors);
  } catch (err) {
    console.error("Cart buyer identity update error:", err);
  }
}

export interface CartItem {
  lineId: string | null; // Shopify cart line ID, null until synced
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  /** Shopify compare-at price when the line was added during the sale (for "You saved"). */
  compareAtPrice?: { amount: string; currencyCode: string } | null;
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

const CART_QUERY = `
  query cart($id: ID!) {
    cart(id: $id) { id totalQuantity }
  }
`;

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`;

const CART_LINES_UPDATE_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id }
      userErrors { field message }
    }
  }
`;

const CART_LINES_REMOVE_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id }
      userErrors { field message }
    }
  }
`;

type UserError = { field: string[] | null; message: string };
type CartLineEdge = { node: { id: string; merchandise: { id: string } } };

export function formatCheckoutUrl(checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set("channel", "online_store");
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

function isCartNotFoundError(userErrors: UserError[]): boolean {
  return userErrors.some(
    (e) =>
      e.message.toLowerCase().includes("cart not found") ||
      e.message.toLowerCase().includes("does not exist"),
  );
}

export async function createShopifyCart(
  item: CartItem,
): Promise<{ cartId: string; checkoutUrl: string; lineId: string } | null> {
  const data = await storefrontApiRequest<{
    cartCreate?: {
      cart?: {
        id: string;
        checkoutUrl: string;
        lines: { edges: CartLineEdge[] };
      };
      userErrors?: UserError[];
    };
  }>(CART_CREATE_MUTATION, {
    input: {
      lines: [{ quantity: item.quantity, merchandiseId: item.variantId }],
      // Hidden attributes copied onto the order, so /admin can credit the
      // sale to the source that brought the shopper in.
      attributes: campaignCartAttributes(),
    },
  });

  if (!data) return null;

  if (data.data?.cartCreate?.userErrors?.length) {
    console.error("Cart creation failed:", data.data.cartCreate.userErrors);
    return null;
  }

  const cart = data.data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) return null;

  const lineId = cart.lines.edges[0]?.node?.id;
  if (!lineId) return null;

  return { cartId: cart.id, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl), lineId };
}

export async function addLineToShopifyCart(
  cartId: string,
  item: CartItem,
): Promise<{ success: boolean; lineId?: string | undefined; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest<{
    cartLinesAdd?: { cart?: { lines: { edges: CartLineEdge[] } }; userErrors?: UserError[] };
  }>(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [{ quantity: item.quantity, merchandiseId: item.variantId }],
  });

  if (!data) return { success: false };

  const userErrors = data.data?.cartLinesAdd?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) {
    console.error("Add line failed:", userErrors);
    return { success: false };
  }

  const lines = data.data?.cartLinesAdd?.cart?.lines?.edges ?? [];
  const newLine = lines.find((l) => l.node.merchandise.id === item.variantId);
  return { success: true, lineId: newLine?.node?.id };
}

export async function updateShopifyCartLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest<{
    cartLinesUpdate?: { userErrors?: UserError[] };
  }>(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: lineId, quantity }] });

  if (!data) return { success: false };

  const userErrors = data.data?.cartLinesUpdate?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) {
    console.error("Update line failed:", userErrors);
    return { success: false };
  }
  return { success: true };
}

export async function removeLineFromShopifyCart(
  cartId: string,
  lineId: string,
): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest<{
    cartLinesRemove?: { userErrors?: UserError[] };
  }>(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: [lineId] });

  if (!data) return { success: false };

  const userErrors = data.data?.cartLinesRemove?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) {
    console.error("Remove line failed:", userErrors);
    return { success: false };
  }
  return { success: true };
}

const CART_LINES_QUERY = `
  query cartLines($id: ID!) {
    cart(id: $id) {
      id
      totalQuantity
      lines(first: 100) {
        nodes {
          id
          quantity
          merchandise { ... on ProductVariant { id } }
          cost {
            amountPerQuantity { amount currencyCode }
            compareAtAmountPerQuantity { amount currencyCode }
          }
        }
      }
    }
  }
`;

export type LivePrice = { amount: string; currencyCode: string };
export interface LiveCartLine {
  lineId: string;
  variantId: string;
  quantity: number;
  price: LivePrice;
  compareAtPrice: LivePrice | null;
}

/**
 * The cart as Shopify holds it now: quantity and the current price and
 * compare-at price of every line (so prices that dropped since the item was
 * added show in the cart). null = API error (keep the local cart); a cart that
 * no longer exists (checked out or expired) comes back with totalQuantity 0.
 */
export async function fetchCartLines(
  cartId: string,
): Promise<{ totalQuantity: number; lines: LiveCartLine[] } | null> {
  const data = await storefrontApiRequest<{
    cart?: {
      totalQuantity: number;
      lines: {
        nodes: Array<{
          id: string;
          quantity: number;
          merchandise: { id?: string };
          cost: { amountPerQuantity: LivePrice; compareAtAmountPerQuantity: LivePrice | null };
        }>;
      };
    } | null;
  }>(CART_LINES_QUERY, { id: cartId });
  if (!data) return null;
  const cart = data.data?.cart;
  if (!cart) return { totalQuantity: 0, lines: [] };
  return {
    totalQuantity: cart.totalQuantity,
    lines: cart.lines.nodes.map((n) => ({
      lineId: n.id,
      variantId: n.merchandise.id ?? "",
      quantity: n.quantity,
      price: n.cost.amountPerQuantity,
      compareAtPrice: n.cost.compareAtAmountPerQuantity,
    })),
  };
}

export async function fetchCartQuantity(cartId: string): Promise<number | null> {
  const data = await storefrontApiRequest<{ cart?: { id: string; totalQuantity: number } }>(
    CART_QUERY,
    { id: cartId },
  );
  if (!data) return null;
  return data.data?.cart?.totalQuantity ?? 0;
}
