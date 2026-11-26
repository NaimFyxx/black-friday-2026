// Which sizes of a product are on the Fyxx Friday sale list. Read on the
// server only (bf_sale_flags is not public); the browser gets back just the
// in-sale variant ids of the one product it asked about.
// If the bf_settings switch sale_list_filter is off, nothing is filtered.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { ShopifyProductNode } from "@/lib/shopify";

type Loose = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

export const getSaleVariantIds = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ productId: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ filter: boolean; ids: string[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as Loose;
    const { data: sw, error: e1 } = await db
      .from("bf_settings")
      .select("value")
      .eq("key", "sale_list_filter")
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (sw?.value !== true) return { filter: false, ids: [] };
    // Products in an "always_show" main (bf_settings.category_mapping, e.g. the
    // gift card) are not on the sale list: every size can be picked.
    const [{ data: map }, { data: prod }] = await Promise.all([
      db.from("bf_settings").select("value").eq("key", "category_mapping").maybeSingle(),
      db.from("bf_products").select("main_category").eq("product_id", data.productId).maybeSingle(),
    ]);
    const always = new Set(
      (Array.isArray(map?.value)
        ? (map.value as Array<{ name?: string; always_show?: boolean }>)
        : []
      )
        .filter((m) => m.always_show === true)
        .map((m) => m.name),
    );
    if (prod?.main_category && always.has(prod.main_category)) return { filter: false, ids: [] };
    const { data: rows, error } = await db
      .from("bf_sale_flags")
      .select("variant_gid")
      .eq("product_gid", data.productId)
      .eq("in_sale", true);
    if (error) throw new Error(error.message);
    return { filter: true, ids: (rows ?? []).map((r: { variant_gid: string }) => r.variant_gid) };
  });

/** The product with only its in-sale sizes (all sizes when the switch is off). */
export async function onlySaleVariants(product: ShopifyProductNode): Promise<ShopifyProductNode> {
  // If the check fails, no size can be added (never fall back to all sizes).
  const { filter, ids } = await getSaleVariantIds({ data: { productId: product.id } }).catch(
    () => ({ filter: true, ids: [] as string[] }),
  );
  if (!filter) return product;
  const keep = new Set(ids);
  return {
    ...product,
    variants: {
      ...product.variants,
      edges: product.variants.edges.filter((e) => keep.has(e.node.id)),
    },
  };
}
