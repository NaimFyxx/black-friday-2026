// Fyxx Friday catalog: reads the bf_products index through the public
// database functions bf_catalog / bf_catalog_facets (Supabase project
// gpnglfdusrymnookeclg). The index is filled from Shopify every 15 minutes by
// the bf-products-sync edge function, so prices always come from Shopify.
// Every number (sale dates, badge threshold, "up to" minimum, batch size,
// price bands, top deals count) comes from bf_settings, editable on /admin.

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Preview } from "@/lib/preview";
import { simCatalog, simFacets } from "@/lib/preview-sim.functions";
import { formatJod, type ShopifyProduct } from "@/lib/shopify";

export type SaleState = "preview" | "sale" | "ended";
export type SortKey = "discount" | "price_asc" | "price_desc" | "newest";

export interface CatalogFilters {
  main?: string | undefined;
  sub?: string | undefined;
  band?: number | undefined;
  /** Navigation section (The Cellar / The Bar / The Humidor): several main categories. */
  group?: string | undefined;
  /** Sale only: discount at least this many percent. */
  disc?: number | undefined;
  q?: string | undefined;
  sort?: SortKey | undefined;
}

export interface CatalogItem {
  product_id: string;
  variant_id: string;
  variant_title: string | null;
  handle: string;
  title: string;
  vendor: string | null;
  main_category: string;
  sub_category: string | null;
  image_url: string | null;
  price: number;
  compare_at_price: number | null; // null outside the sale
  discount_percent: number; // 0 outside the sale
  /** On the Fyxx Friday sale list (bf_sale_flags). */
  in_sale?: boolean;
  /** false: sold out during the sale (listed last, no add button). */
  available?: boolean;
  /** Units left of this variant (null when Shopify doesn't track it). */
  stock?: number | null;
  saved_amount: number; // 0 outside the sale
}

export interface CatalogPage {
  state: SaleState;
  sort: SortKey;
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
  items: CatalogItem[];
}

export interface Chip {
  name: string;
  count: number;
  upto: number | null;
  /** Main categories only: photo for the category circle. */
  image?: string | null;
}

export interface CatalogFacets {
  state: SaleState;
  sale_start: string | null;
  sale_end: string | null;
  badge_amount_threshold: number;
  batch_size: number;
  price_bands: number[];
  headline_upto: number | null;
  all: { count: number };
  mains: Chip[];
  subs: Chip[];
  bands: Array<{ index: number; min: number | null; max: number | null; count: number }>;
  /** Navigation sections with their main categories and product counts. */
  groups: Array<{ name: string; mains: string[]; count: number }>;
  /** Products matching every current filter. */
  total: number;
  /** Sale only: "X% off or more" options, from bf_settings.discount_filters. */
  discounts: Array<{ min: number; count: number }>;
  top_deals: CatalogItem[];
}

// The generated Supabase types don't know these functions yet.
type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

const params = (f: CatalogFilters, preview: Preview | null) => ({
  preview,
  main: f.main ?? null,
  sub: f.sub ?? null,
  band: f.band ?? null,
  group: f.group ?? null,
  disc: f.disc ?? null,
  q: f.q ?? null,
  sort: f.sort ?? null,
});

export async function fetchCatalogPage(
  f: CatalogFilters,
  offset: number,
  preview: Preview | null = null,
  sim = false,
  limit?: number,
): Promise<CatalogPage> {
  const p = { ...params(f, preview), offset, ...(limit ? { limit } : {}) };
  // Admin preview with planned Friday prices; anything wrong -> public preview.
  if (sim) {
    // One retry before falling back to the public preview (Shopify prices).
    const r = await simCatalog({ data: { p } })
      .catch(() => simCatalog({ data: { p } }))
      .catch(() => null);
    if (r) return JSON.parse(r) as CatalogPage;
  }
  const { data, error } = await rpc("bf_catalog", { p });
  if (error) throw new Error(error.message);
  return data as CatalogPage;
}

export async function fetchFacets(
  f: CatalogFilters,
  preview: Preview | null = null,
  sim = false,
): Promise<CatalogFacets> {
  if (sim) {
    const p = params(f, preview);
    const r = await simFacets({ data: { p } })
      .catch(() => simFacets({ data: { p } }))
      .catch(() => null);
    if (r) return JSON.parse(r) as CatalogFacets;
  }
  const { data, error } = await rpc("bf_catalog_facets", { p: params(f, preview) });
  if (error) throw new Error(error.message);
  return data as CatalogFacets;
}

const filterKey = (f: CatalogFilters, preview: Preview | null) => [
  preview ?? "",
  f.main ?? "",
  f.sub ?? "",
  f.band ?? "",
  f.group ?? "",
  f.disc ?? "",
  f.q ?? "",
  f.sort ?? "",
];

export const catalogQueryOptions = (
  f: CatalogFilters,
  preview: Preview | null = null,
  sim = false,
) =>
  infiniteQueryOptions({
    queryKey: ["bf-catalog", sim ? "sim" : "", ...filterKey(f, preview)],
    queryFn: ({ pageParam }) => fetchCatalogPage(f, pageParam, preview, sim),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.has_more ? last.offset + last.limit : undefined),
    staleTime: 60_000,
    gcTime: 30 * 60_000, // keep loaded pages so "back" from a product restores them
  });

export const facetsQueryOptions = (
  f: CatalogFilters,
  preview: Preview | null = null,
  sim = false,
) =>
  queryOptions({
    queryKey: ["bf-facets", sim ? "sim" : "", ...filterKey(f, preview)],
    queryFn: () => fetchFacets(f, preview, sim),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (prev) => prev, // keep chips steady while counts refresh
  });

/**
 * Is a main category part of a nav section? Sections list mains ("Whisky") or
 * one sub of a main ("Accessories/Wine accessories").
 */
export function mainInGroup(groupMains: string[] | undefined, main: string): boolean {
  return !!groupMains?.some((t) => t === main || t.startsWith(`${main}/`));
}

/** The real discount on the photo during the sale: "-15%". */
export function discountBadge(
  item: Pick<CatalogItem, "price" | "discount_percent" | "saved_amount">,
  _threshold?: number,
): string | null {
  if (!(item.discount_percent > 0)) return null;
  return `-${item.discount_percent}%`;
}

/** Shopify image at a given width (the CDN resizes on the fly). */
export function sizedImage(url: string | null, width: number): string | undefined {
  if (!url) return undefined;
  return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
}

/** Cart lines need the Storefront product shape; build the parts the cart uses. */
export function toCartProduct(item: CatalogItem): ShopifyProduct {
  const money = (n: number) => ({ amount: n.toFixed(3), currencyCode: "JOD" });
  return {
    node: {
      id: item.product_id,
      title: item.title,
      handle: item.handle,
      descriptionHtml: "",
      productType: item.sub_category ?? item.main_category,
      vendor: item.vendor ?? "",
      priceRange: { minVariantPrice: money(item.price) },
      images: {
        edges: item.image_url ? [{ node: { url: item.image_url, altText: item.title } }] : [],
      },
      variants: {
        edges: [
          {
            node: {
              id: item.variant_id,
              title: item.variant_title ?? "Default Title",
              price: money(item.price),
              compareAtPrice: item.compare_at_price ? money(item.compare_at_price) : null,
              availableForSale: true,
              selectedOptions: [],
            },
          },
        ],
      },
      options: [],
    },
  };
}

export const SORT_LABELS: Record<SortKey, string> = {
  discount: "Biggest markdown first",
  price_asc: "Price low to high",
  price_desc: "Price high to low",
  newest: "Newest",
};

export function bandLabel(b: { min: number | null; max: number | null }): string {
  if (b.min === null && b.max !== null) return `Under JOD ${b.max}`;
  if (b.min !== null && b.max === null) return `JOD ${b.min}+`;
  return `JOD ${b.min} to ${b.max}`;
}
