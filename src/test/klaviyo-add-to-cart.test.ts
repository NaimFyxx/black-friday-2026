import { beforeEach, describe, expect, it, vi } from "vitest";

// recordEvent is a server function; the test only checks what goes to Klaviyo.
vi.mock("@/lib/track.functions", () => ({ recordEvent: () => Promise.resolve({ ok: true }) }));

import { trackAddToCart } from "@/lib/analytics";
import { useCartStore } from "@/stores/cartStore";

type W = Window & {
  _klOnsite?: unknown[][];
  klaviyo?: unknown;
  __bfTrackingOff?: boolean;
};
const w = window as W;

const node = {
  id: "gid://shopify/Product/111",
  title: "Test Gin",
  handle: "test-gin",
  descriptionHtml: "",
  productType: "Gin",
  vendor: "Fyxx",
  priceRange: { minVariantPrice: { amount: "20.000", currencyCode: "JOD" } },
  images: { edges: [{ node: { url: "https://cdn.example/gin.png", altText: null } }] },
  variants: { edges: [] },
  options: [],
};

const item = {
  id: "gid://shopify/ProductVariant/222",
  name: "Test Gin",
  handle: "test-gin",
  variant: "70cl",
  price: 20,
  currency: "JOD",
  quantity: 2,
};

describe("Klaviyo Added to Cart", () => {
  beforeEach(() => {
    delete w._klOnsite;
    delete w.klaviyo;
    delete w.__bfTrackingOff;
    useCartStore.setState({
      cartId: "gid://shopify/Cart/abc",
      checkoutUrl: "https://shop.example/cart/c/abc",
      items: [
        {
          lineId: "line-1",
          product: { node } as never,
          variantId: item.id,
          variantTitle: "70cl",
          price: { amount: "20.000", currencyCode: "JOD" },
          quantity: 2,
          selectedOptions: [],
        },
      ],
    });
  });

  it("queues the event for klaviyo.js with the added item and the whole cart", () => {
    trackAddToCart(item);

    expect(w._klOnsite).toHaveLength(1);
    const [method, name, props] = w._klOnsite![0] as [string, string, Record<string, unknown>];
    expect(method).toBe("track");
    expect(name).toBe("Added to Cart");
    expect(props).toMatchObject({
      $value: 40,
      AddedItemProductName: "Test Gin",
      AddedItemProductID: "111",
      AddedItemVariantID: "222",
      AddedItemQuantity: 2,
      AddedItemURL: `${window.location.origin}/product/test-gin`,
      AddedItemImageURL: "https://cdn.example/gin.png",
      ItemNames: ["Test Gin"],
      CheckoutURL: "https://shop.example/cart/c/abc",
    });
  });

  it("uses klaviyo.push once klaviyo.js has loaded", () => {
    const push = vi.fn();
    w.klaviyo = { push };
    trackAddToCart(item);
    expect(push).toHaveBeenCalledWith(["track", "Added to Cart", expect.any(Object)]);
  });

  it("sends nothing when tracking is switched off", () => {
    w.__bfTrackingOff = true;
    trackAddToCart(item);
    expect(w._klOnsite).toBeUndefined();
  });
});
