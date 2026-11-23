// "The Pairings": ready-made sets of products (bf_settings.pairings, edited in
// the database, no Publish needed). Prices come from each product: the set
// price is the sum of the current prices, the compare-at price the sum of the
// regular prices (so on Friday the sale shows). No extra set discount.

import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CatalogItem } from "@/lib/catalog";
import type { Preview } from "@/lib/preview";

export type PairingSet = { id: string; name: string; blurb: string; items: CatalogItem[] };
export type Pairings = {
  state: string;
  nav_label: string | null;
  title: string | null;
  intro: string | null;
  sets: PairingSet[];
};

/** Name of the section in the header and on the page. */
export const PAIRINGS_LABEL = "The Pairings";

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export const pairingsQueryOptions = (preview: Preview | null = null) =>
  queryOptions({
    queryKey: ["bf-pairings", preview ?? ""],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as Rpc).call(supabase, "bf_pairings", {
        p: { preview },
      });
      if (error) throw new Error(error.message);
      return data as Pairings;
    },
    staleTime: 60_000,
  });

/** Set price (sum of current prices) and compare-at (sum of regular prices). */
export function setTotals(items: CatalogItem[]) {
  const price = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const compare = items.reduce(
    (s, i) => s + Math.max(Number(i.compare_at_price) || 0, Number(i.price) || 0),
    0,
  );
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { price: r(price), compare: r(compare) };
}
