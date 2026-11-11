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

export const CATEGORIES = ["all", "wine", "spirits", "cigars"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  all: "Everything",
  wine: "Wine",
  spirits: "Spirits",
  cigars: "Cigars",
};

/**
 * "Spirits" is not a single product type in this catalog — it is the family of
 * whisky, vodka, gin, rum, tequila, liqueurs and friends. Quoting is only added
 * where the type name itself needs it (Cognac/Brandy).
 */
const SPIRITS_TYPES = [
  "Whisky",
  "Vodka",
  "Gin",
  "Rum",
  "Tequila",
  "Liqueurs",
  "Absinthe",
  "Arak",
  "Mezcal",
  "Bitters",
  "Cognac/Brandy",
];

function productTypeFilter(type: string): string {
  return /[^A-Za-z0-9]/.test(type) ? `product_type:"${type}"` : `product_type:${type}`;
}

const CATEGORY_SCOPES: Record<Category, string | null> = {
  all: null,
  wine: "(product_type:Wine)",
  cigars: "(product_type:Cigars)",
  spirits: `(${SPIRITS_TYPES.map(productTypeFilter).join(" OR ")})`,
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/** Search syntax for one shelf, or null when the shelf is "Everything". */
export function categoryScope(category: Category): string | null {
  return CATEGORY_SCOPES[category] ?? null;
}

/**
 * Combine a shelf with a free-text search into one Storefront API query string.
 * Returns null when nothing should be filtered at all.
 */
export function buildCatalogQuery(input: {
  category: Category;
  search?: string | undefined;
}): string | null {
  const scope = categoryScope(input.category);
  const term = input.search?.trim();

  if (scope && term) return `${scope} AND ${term}`;
  if (scope) return scope;
  return term ? term : null;
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
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 4) { edges { node { url altText } } }
  variants(first: 12) {
    edges {
      node {
        id
        title
        price { amount currencyCode }
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
      toast.error("Shopify: Payment required", {
        description:
          "Shopify API access needs an active billing plan. Visit admin.shopify.com to upgrade the store.",
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
}): Promise<CatalogPage> {
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

export function formatPrice(money: ShopifyMoney): string {
  return `${Number(money.amount).toFixed(2)} ${money.currencyCode}`;
}

export function primaryImage(product: ShopifyProductNode): ShopifyImage | null {
  return product.images.edges[0]?.node ?? null;
}

export function firstVariant(product: ShopifyProductNode): ShopifyVariant | null {
  return product.variants.edges[0]?.node ?? null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
