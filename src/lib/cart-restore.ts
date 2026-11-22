// Cart restore link for the 10:00 Fyxx Friday email:
//   https://friday.myfyxx.com/?cart=<CartID>&utm_...
// CartID is sent with every Klaviyo "Added to Cart" event (cartToken below).
// On load: if that Shopify cart still has items, it becomes this browser's
// cart and the cart drawer opens. Works on any device, and opens the site in
// the browser (a myfyxx.com checkout link can open the Fyxx app instead).
// Unknown or empty carts are ignored. Each link is used once per browser tab
// (sessionStorage), so a reload doesn't overwrite changes made since. The
// address bar is left alone (changing it during start-up upsets hydration);
// UTMs are captured as usual.

import { formatCheckoutUrl, type CartItem } from "@/lib/shopify-cart";
import { storefrontApiRequest } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { useCartUi } from "@/stores/cartUiStore";

import { CART_GID_PREFIX as PREFIX } from "@/lib/cart-token";

const RESTORE_QUERY = `
  query restoreCart($id: ID!) {
    cart(id: $id) {
      id
      checkoutUrl
      totalQuantity
      lines(first: 100) {
        nodes {
          id
          quantity
          cost {
            amountPerQuantity { amount currencyCode }
            compareAtAmountPerQuantity { amount currencyCode }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
              availableForSale
              selectedOptions { name value }
              product {
                id
                title
                handle
                productType
                vendor
                images(first: 1) { edges { node { url altText } } }
              }
            }
          }
        }
      }
    }
  }
`;

type Money = { amount: string; currencyCode: string };
type RestoreLine = {
  id: string;
  quantity: number;
  cost: { amountPerQuantity: Money; compareAtAmountPerQuantity: Money | null };
  merchandise: {
    id?: string;
    title?: string;
    availableForSale?: boolean;
    selectedOptions?: Array<{ name: string; value: string }>;
    product?: {
      id: string;
      title: string;
      handle: string;
      productType: string;
      vendor: string;
      images: { edges: Array<{ node: { url: string; altText: string | null } }> };
    };
  };
};

function toItem(l: RestoreLine): CartItem | null {
  const v = l.merchandise;
  if (!v.id || !v.product) return null;
  const price = l.cost.amountPerQuantity;
  const cmp =
    l.cost.compareAtAmountPerQuantity &&
    Number(l.cost.compareAtAmountPerQuantity.amount) > Number(price.amount)
      ? l.cost.compareAtAmountPerQuantity
      : null;
  const options = (v.selectedOptions ?? []).filter((o) => o.name !== "Title");
  return {
    lineId: l.id,
    variantId: v.id,
    variantTitle: v.title === "Default Title" ? "" : (v.title ?? ""),
    price,
    compareAtPrice: cmp,
    quantity: l.quantity,
    selectedOptions: options,
    product: {
      node: {
        id: v.product.id,
        title: v.product.title,
        handle: v.product.handle,
        descriptionHtml: "",
        productType: v.product.productType,
        vendor: v.product.vendor,
        priceRange: { minVariantPrice: price },
        images: v.product.images,
        variants: {
          edges: [
            {
              node: {
                id: v.id,
                title: v.title ?? "",
                price,
                compareAtPrice: cmp,
                availableForSale: v.availableForSale ?? true,
                selectedOptions: v.selectedOptions ?? [],
              },
            },
          ],
        },
        options: [],
      },
    } as CartItem["product"],
  };
}

/** Called once on page load. Never throws. */
export async function restoreCartFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = new URLSearchParams(window.location.search).get("cart");
  if (!token) return;
  const seenKey = `fyxx:cart-restored:${token}`;
  try {
    if (window.sessionStorage.getItem(seenKey)) return;
    window.sessionStorage.setItem(seenKey, "1");
  } catch {
    // no sessionStorage: restore anyway
  }
  try {
    const id = token.startsWith("gid://") ? token : PREFIX + token;
    const data = await storefrontApiRequest<{
      cart?: {
        id: string;
        checkoutUrl: string;
        totalQuantity: number;
        lines: { nodes: RestoreLine[] };
      } | null;
    }>(RESTORE_QUERY, { id });
    const cart = data?.data?.cart;
    if (!cart || cart.totalQuantity === 0) return; // gone or empty: ignore
    const items = cart.lines.nodes.map(toItem).filter((i): i is CartItem => i !== null);
    if (items.length === 0) return;
    useCartStore.setState({
      cartId: cart.id,
      checkoutUrl: formatCheckoutUrl(cart.checkoutUrl),
      items,
    });
    useCartUi.getState().setOpen(true);
  } catch {
    // a broken link must never break the page
  }
}
