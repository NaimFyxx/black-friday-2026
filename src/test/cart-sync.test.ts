import { beforeEach, describe, expect, it, vi } from "vitest";

// syncCart's behaviour depends only on what fetchCartLines returns, so mock it.
const fetchCartLines = vi.fn();
vi.mock("@/lib/shopify-cart", () => ({
  fetchCartLines: (...args: unknown[]) => fetchCartLines(...args),
  createShopifyCart: vi.fn(),
  addLineToShopifyCart: vi.fn(),
  updateShopifyCartLine: vi.fn(),
  removeLineFromShopifyCart: vi.fn(),
}));

import { useCartStore } from "@/stores/cartStore";

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

const baseItem = {
  lineId: "line-1",
  product: { node } as never,
  variantId: "gid://shopify/ProductVariant/222",
  variantTitle: "70cl",
  price: { amount: "20.000", currencyCode: "JOD" },
  compareAtPrice: null,
  quantity: 2,
  selectedOptions: [],
};

describe("syncCart", () => {
  beforeEach(() => {
    fetchCartLines.mockReset();
    useCartStore.setState({
      cartId: "gid://shopify/Cart/abc",
      checkoutUrl: "https://shop.example/cart/c/abc",
      items: [{ ...baseItem }],
      isSyncing: false,
      isLoading: false,
    });
  });

  it("clears the cart when Shopify reports it gone (a completed order)", async () => {
    // A completed order, or an expired cart, comes back empty.
    fetchCartLines.mockResolvedValue({ totalQuantity: 0, lines: [] });

    const status = await useCartStore.getState().syncCart();

    expect(status).toBe("empty");
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.cartId).toBeNull();
    expect(state.checkoutUrl).toBeNull();
  });

  it("keeps the cart on a transient network error", async () => {
    fetchCartLines.mockResolvedValue(null);

    const status = await useCartStore.getState().syncCart();

    expect(status).toBe("error");
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.cartId).toBe("gid://shopify/Cart/abc");
  });

  it("applies the live price, compare-at price and quantity from Shopify", async () => {
    fetchCartLines.mockResolvedValue({
      totalQuantity: 3,
      lines: [
        {
          lineId: "line-1",
          variantId: baseItem.variantId,
          quantity: 3,
          price: { amount: "15.000", currencyCode: "JOD" },
          compareAtPrice: { amount: "20.000", currencyCode: "JOD" },
        },
      ],
    });

    const status = await useCartStore.getState().syncCart();

    expect(status).toBe("ok");
    const item = useCartStore.getState().items[0]!;
    expect(item.quantity).toBe(3);
    expect(item.price.amount).toBe("15.000");
    expect(item.compareAtPrice?.amount).toBe("20.000");
  });

  it("reports empty without a network call when there is no cart", async () => {
    useCartStore.setState({ cartId: null, items: [], checkoutUrl: null });

    const status = await useCartStore.getState().syncCart();

    expect(status).toBe("empty");
    expect(fetchCartLines).not.toHaveBeenCalled();
  });
});
