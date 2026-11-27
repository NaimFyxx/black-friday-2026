import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCartLines } from "@/lib/shopify-cart";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("fetchCartLines", () => {
  it("treats a null cart as gone (so the caller clears it)", async () => {
    stubFetch(async () => ok({ data: { cart: null } }));
    expect(await fetchCartLines("gid://shopify/Cart/gone")).toEqual({
      totalQuantity: 0,
      lines: [],
    });
  });

  it("treats an 'already completed' GraphQL error as gone", async () => {
    stubFetch(async () => ok({ errors: [{ message: "Cart has already been completed" }] }));
    expect(await fetchCartLines("gid://shopify/Cart/done")).toEqual({
      totalQuantity: 0,
      lines: [],
    });
  });

  it("treats a 'not found' GraphQL error as gone", async () => {
    stubFetch(async () => ok({ errors: [{ message: "Cart not found" }] }));
    expect(await fetchCartLines("gid://shopify/Cart/missing")).toEqual({
      totalQuantity: 0,
      lines: [],
    });
  });

  it("keeps the cart (null) when the request throws for the network", async () => {
    stubFetch(async () => {
      throw new Error("Failed to fetch");
    });
    expect(await fetchCartLines("gid://shopify/Cart/abc")).toBeNull();
  });

  it("keeps the cart (null) on a server/HTTP error", async () => {
    stubFetch(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response,
    );
    expect(await fetchCartLines("gid://shopify/Cart/abc")).toBeNull();
  });

  it("maps the live lines on success", async () => {
    stubFetch(async () =>
      ok({
        data: {
          cart: {
            totalQuantity: 1,
            lines: {
              nodes: [
                {
                  id: "line-1",
                  quantity: 1,
                  merchandise: { id: "v1" },
                  cost: {
                    amountPerQuantity: { amount: "10.000", currencyCode: "JOD" },
                    compareAtAmountPerQuantity: null,
                  },
                },
              ],
            },
          },
        },
      }),
    );
    expect(await fetchCartLines("gid://shopify/Cart/abc")).toEqual({
      totalQuantity: 1,
      lines: [
        {
          lineId: "line-1",
          variantId: "v1",
          quantity: 1,
          price: { amount: "10.000", currencyCode: "JOD" },
          compareAtPrice: null,
        },
      ],
    });
  });
});
