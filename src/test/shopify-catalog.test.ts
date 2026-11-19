import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  CATEGORY_COLLECTIONS,
  catalogSource,
  isCategory,
  SHOPIFY_API_VERSION,
  SHOPIFY_STORE_PERMANENT_DOMAIN,
  SHOPIFY_STOREFRONT_URL,
  stripHtml,
} from "@/lib/shopify";

describe("catalog shelves", () => {
  it("shows the whole catalog on All products", () => {
    expect(catalogSource({ category: "all" })).toEqual({ collection: null, query: null });
  });

  it("shows each shelf's Shopify collection", () => {
    expect(catalogSource({ category: "red-wine" })).toEqual({
      collection: "red-wines",
      query: null,
    });
    expect(catalogSource({ category: "white-wine" })).toEqual({
      collection: "white-wines",
      query: null,
    });
    expect(catalogSource({ category: "tequila-mezcal" }).collection).toBe("tequila-and-mezcal");
    expect(catalogSource({ category: "dukkan" }).collection).toBe("dukkan");
  });

  it("gives every shelf except All products a collection", () => {
    for (const c of CATEGORIES) {
      if (c === "all") expect(CATEGORY_COLLECTIONS[c]).toBeNull();
      else expect(CATEGORY_COLLECTIONS[c]).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("searches the whole catalog when a term is typed", () => {
    expect(catalogSource({ category: "whisky", search: " jameson " })).toEqual({
      collection: null,
      query: "jameson",
    });
  });

  it("ignores a blank search instead of filtering everything out", () => {
    expect(catalogSource({ category: "gin", search: "   " })).toEqual({
      collection: "gin",
      query: null,
    });
  });

  it("only accepts the shelves the page offers", () => {
    expect(CATEGORIES).toEqual([
      "all",
      "cigars",
      "red-wine",
      "white-wine",
      "beer",
      "whisky",
      "vodka",
      "tequila-mezcal",
      "sake",
      "arak",
      "gin",
      "rum",
      "dukkan",
    ]);
    expect(isCategory("whisky")).toBe(true);
    expect(isCategory("spirits")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });
});

describe("Storefront API wiring", () => {
  it("calls the 2026-10 Storefront API on the connected store", () => {
    expect(SHOPIFY_API_VERSION).toBe("2026-10");
    expect(SHOPIFY_STORE_PERMANENT_DOMAIN).toBe("drynksapp.myshopify.com");
    expect(SHOPIFY_STOREFRONT_URL).toBe("https://drynksapp.myshopify.com/api/2026-10/graphql.json");
  });
});

describe("description text", () => {
  it("writes symbols out instead of showing the code for them", () => {
    expect(stripHtml("<p>Awards &amp; Press Review</p>")).toBe("Awards & Press Review");
    expect(stripHtml("<div>O'Malley&#39;s&nbsp;Cask</div>")).toBe("O'Malley's Cask");
    expect(stripHtml("<p>Whisky</p><p>&amp; Bitters</p>")).toBe("Whisky & Bitters");
  });
});
