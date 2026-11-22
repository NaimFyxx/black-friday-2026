/**
 * Shopify Storefront API access for the Fyxx catalog.
 *
 * Reads only: the public catalog, product pages and the cart/checkout mutations.
 * The Admin API is never touched from app code.
 */

export const SHOPIFY_API_VERSION = "2026-10";
export const SHOPIFY_STORE_PERMANENT_DOMAIN = "drynksapp.myshopify.com";
export const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
// Storefront API public access token: designed for browser-side catalog reads.
export const SHOPIFY_STOREFRONT_TOKEN = "6bdaffcdd3b82d66838dff6365ead6cd";

export const PRODUCTS_PER_PAGE = 24;

export const CATEGORIES = [
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
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  all: "All Products",
  cigars: "Cigars",
  "red-wine": "Red Wine",
  "white-wine": "White Wine",
  beer: "Beer",
  whisky: "Whisky",
  vodka: "Vodka",
  "tequila-mezcal": "Tequila & Mezcal",
  sake: "Sake",
  arak: "Arak",
  gin: "Gin",
  rum: "Rum",
  dukkan: "Dukkan",
};

/**
 * Each shelf shows its Shopify COLLECTION (the lists the Fyxx team curates in
 * Shopify admin, same as on myfyxx.com), in the collection's own order.
 * "All products" is the whole catalog.
 */
export const CATEGORY_COLLECTIONS: Record<Category, string | null> = {
  all: null,
  cigars: "cigars",
  "red-wine": "red-wines",
  "white-wine": "white-wines",
  beer: "beer",
  whisky: "whisky",
  vodka: "vodka",
  "tequila-mezcal": "tequila-and-mezcal",
  sake: "sake",
  arak: "arak",
  gin: "gin",
  rum: "rum",
  dukkan: "dukkan",
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Where a shelf's products come from. A search term searches the WHOLE
 * catalog (Shopify can't search inside a collection); otherwise the shelf's
 * collection, or everything for "All products".
 */
export function catalogSource(input: { category: Category; search?: string | undefined }): {
  collection: string | null;
  query: string | null;
} {
  const term = input.search?.trim();
  if (term) return { collection: null, query: term };
  return { collection: CATEGORY_COLLECTIONS[input.category] ?? null, query: null };
}

export interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: ShopifyMoney;
  compareAtPrice?: ShopifyMoney | null;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  /** Shopify tags, e.g. WineStyle_Red, Country_Spain, Region_Rioja. */
  tags?: string[];
  priceRange: { minVariantPrice: ShopifyMoney };
  images: { edges: Array<{ node: ShopifyImage }> };
  variants: { edges: Array<{ node: ShopifyVariant }> };
  options: Array<{ name: string; values: string[] }>;
}

/** Kept in `{ node }` shape so cart items and grid cards share one type. */
export interface ShopifyProduct {
  node: ShopifyProductNode;
}

export interface CatalogPage {
  products: ShopifyProduct[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  descriptionHtml
  productType
  vendor
  tags
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 4) { edges { node { url altText } } }
  variants(first: 30) {
    edges {
      node {
        id
        title
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        availableForSale
        selectedOptions { name value }
      }
    }
  }
  options { name values }
`;

const CATALOG_QUERY = `
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges { node { ${PRODUCT_FIELDS} } }
    }
  }
`;

const COLLECTION_QUERY = `
  query GetCollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      products(first: $first, after: $after, sortKey: COLLECTION_DEFAULT) {
        pageInfo { hasNextPage endCursor }
        edges { node { ${PRODUCT_FIELDS} } }
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) { ${PRODUCT_FIELDS} }
  }
`;

type GraphQLError = { message: string };
type GraphQLResponse<T> = { data?: T; errors?: GraphQLError[] };

export async function storefrontApiRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphQLResponse<T> | null> {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    if (typeof window !== "undefined") {
      const { toast } = await import("sonner");
      // Shown to shoppers: no mention of the shop platform.
      toast.error("The shop is unavailable right now", {
        description: "Please try again in a few minutes.",
      });
    }
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = (await response.json()) as GraphQLResponse<T>;

  if (data.errors) {
    throw new Error(`Error calling Shopify: ${data.errors.map((e) => e.message).join(", ")}`);
  }

  return data;
}

type CatalogResponse = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: ShopifyProductNode }>;
  };
};

export async function getProducts(input: {
  first?: number;
  after?: string | null;
  query?: string | null;
  /** Shopify collection handle: list that collection's products instead. */
  collection?: string | null;
}): Promise<CatalogPage> {
  if (input.collection) {
    const res = await storefrontApiRequest<{
      collection: CatalogResponse["products"] extends infer P ? { products: P } | null : never;
    }>(COLLECTION_QUERY, {
      handle: input.collection,
      first: input.first ?? PRODUCTS_PER_PAGE,
      after: input.after ?? null,
    });
    const products = res?.data?.collection?.products;
    return {
      products: (products?.edges ?? []).map((edge) => ({ node: edge.node })),
      pageInfo: products?.pageInfo ?? { hasNextPage: false, endCursor: null },
    };
  }
  const data = await storefrontApiRequest<CatalogResponse>(CATALOG_QUERY, {
    first: input.first ?? PRODUCTS_PER_PAGE,
    after: input.after ?? null,
    query: input.query ?? null,
  });

  if (!data) return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };

  const products = data.data?.products;
  return {
    products: (products?.edges ?? []).map((edge) => ({ node: edge.node })),
    pageInfo: products?.pageInfo ?? { hasNextPage: false, endCursor: null },
  };
}

export async function getProductByHandle(handle: string): Promise<ShopifyProductNode | null> {
  const data = await storefrontApiRequest<{ productByHandle: ShopifyProductNode | null }>(
    PRODUCT_BY_HANDLE_QUERY,
    { handle },
  );

  return data?.data?.productByHandle ?? null;
}

/** "JOD 12.500": currency first, three decimals (fils). */
export function formatPrice(money: ShopifyMoney): string {
  return formatJod(Number(money.amount), money.currencyCode);
}

export function formatJod(amount: number, currency = "JOD"): string {
  return `${currency} ${amount.toFixed(3)}`;
}

export function primaryImage(product: ShopifyProductNode): ShopifyImage | null {
  return product.images.edges[0]?.node ?? null;
}

export function firstVariant(product: ShopifyProductNode): ShopifyVariant | null {
  return product.variants.edges[0]?.node ?? null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntity(match: string, entity: string): string {
  const code =
    entity.startsWith("#x") || entity.startsWith("#X")
      ? Number.parseInt(entity.slice(2), 16)
      : entity.startsWith("#")
        ? Number.parseInt(entity.slice(1), 10)
        : Number.NaN;

  if (Number.isFinite(code)) {
    return code > 0 && code <= 0x10fffd ? String.fromCodePoint(code) : match;
  }

  return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, decodeEntity)
    .replace(/\s+/g, " ")
    .trim();
}
