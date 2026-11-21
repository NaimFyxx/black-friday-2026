// Teaser phase (before bf_settings.sale_start): hero text and the cart note,
// all editable on /admin -> Sale & products. Read through the public database
// function bf_teaser(), which returns only the sale state and these texts.

import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SaleState } from "@/lib/catalog";

export interface TeaserInfo {
  state: SaleState;
  sale_start: string | null;
  sale_end: string | null;
  copy: {
    teaser_headline?: string;
    teaser_subline?: string;
    teaser_countdown_label?: string;
    teaser_button?: string;
    teaser_cart_note?: string;
  };
}

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export const teaserQueryOptions = () =>
  queryOptions({
    queryKey: ["bf-teaser"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as Rpc).call(supabase, "bf_teaser");
      if (error) throw new Error(error.message);
      return data as TeaserInfo;
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  });

/** "5d 03h 12m" until the given time ("03h 12m" on the last day). */
export function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const hm = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return d > 0 ? `${d}d ${hm}` : hm;
}
