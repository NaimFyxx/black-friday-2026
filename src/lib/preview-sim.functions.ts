// Admin-only Friday price simulation for ?preview=friday. With an admin login
// the shop shows the planned Friday prices from bf_sale_list (sale price as
// the price, today's price crossed out). Display only: nothing is written to
// Shopify or the database. The database functions are service-role only and
// never return cost. Without an admin login these refuse, and the site falls
// back to the public preview (Shopify prices only).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

async function adminRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { isAdmin } = await import("./admin-session.server");
  if (!(await isAdmin())) throw new Error("not_admin");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin.rpc as unknown as Rpc).call(supabaseAdmin, fn, args);
  if (error) throw new Error(error.message);
  return data;
}

/** Is this browser signed in to the site's /admin? */
export const simAllowed = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("./admin-session.server");
  return isAdmin();
});

const P = z.object({ p: z.record(z.unknown()) });

// Results go back as JSON text (the browser parses them).
export const simCatalog = createServerFn({ method: "POST" })
  .validator((d: unknown) => P.parse(d))
  .handler(async ({ data }) => JSON.stringify(await adminRpc("bf_catalog_sim", { p: data.p })));

export const simFacets = createServerFn({ method: "POST" })
  .validator((d: unknown) => P.parse(d))
  .handler(async ({ data }) =>
    JSON.stringify(await adminRpc("bf_catalog_facets_sim", { p: data.p })),
  );

/** Planned Friday price and today's price per sale-list variant of one product. */
export const simVariantPrices = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ productId: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/) }).parse(d),
  )
  .handler(
    async ({ data }) =>
      (await adminRpc("bf_sim_variant_prices", { p_product_gid: data.productId })) as Record<
        string,
        { price: number; compare_at: number }
      >,
  );
