import { describe, expect, it } from "vitest";

import {
  buildCatalogQuery,
  categoryScope,
  CATEGORIES,
  isCategory,
  SHOPIFY_API_VERSION,
  SHOPIFY_STORE_PERMANENT_DOMAIN,
  SHOPIFY_STOREFRONT_URL,
  stripHtml,
} from "@/lib/shopify";

describe("catalog shelves", () => {
  it("shows every product on the Everything shelf", () => {
    expect(buildCatalogQuery({ category: "all" })).toBeNull();
  });

  it("limits the Wine shelf to the Wine product type", () => {
    expect(buildCatalogQuery({ category: "wine" })).toBe("(product_type:Wine)");
  });

  it("limits the Cigars shelf to the Cigars product type", () => {
    expect(buildCatalogQuery({ category: "cigars" })).toBe("(product_type:Cigars)");
  });

  it("treats Spirits as the whole family of spirit types, never wine", () => {
    const spirits = buildCatalogQuery({ category: "spirits" }) ?? "";

    expect(spirits).toContain("product_type:Whisky");
    expect(spirits).toContain("product_type:Vodka");
    expect(spirits).toContain("product_type:Gin");
    expect(spirits).toContain('product_type:"Cognac/Brandy"');
    expect(spirits).not.toContain("product_type:Wine");
  });

  it("keeps the shelf while a search term is typed", () => {
    expect(buildCatalogQuery({ category: "wine", search: "gato" })).toBe(
      "(product_type:Wine) AND gato",
    );
  });

  it("searches the whole catalog when the shelf is Everything", () => {
    expect(buildCatalogQuery({ category: "all", search: " jameson " })).toBe("jameson");
  });

  it("ignores a blank search instead of filtering everything out", () => {
    expect(buildCatalogQuery({ category: "spirits", search: "   " })).toBe(categoryScope("spirits"));
  });

  it("only accepts the four shelves the page offers", () => {
    expect(CATEGORIES).toEqual(["all", "wine", "spirits", "cigars"]);
    expect(isCategory("wine")).toBe(true);
    expect(isCategory("beer")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });
});

describe("Storefront API wiring", () => {
  it("calls the 2026-10 Storefront API on the connected store", () => {
    expect(SHOPIFY_API_VERSION).toBe("2026-10");
    expect(SHOPIFY_STORE_PERMANENT_DOMAIN).toBe("drynksapp.myshopify.com");
    expect(SHOPIFY_STOREFRONT_URL).toBe(
      "https://drynksapp.myshopify.com/api/2026-10/graphql.json",
    );
  });
});

describe("description text", () => {
  it("writes symbols out instead of showing the code for them", () => {
    expect(stripHtml("<p>Awards &amp; Press Review</p>")).toBe("Awards & Press Review");
    expect(stripHtml("<div>O'Malley&#39;s&nbsp;Cask</div>")).toBe("O'Malley's Cask");
    expect(stripHtml("<p>Whisky</p><p>&amp; Bitters</p>")).toBe("Whisky & Bitters");
  });
});
