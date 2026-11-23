// Teaser phase (before bf_settings.sale_start): hero text and the cart note,
// all editable on /admin -> Sale & products. Read through the public database
// function bf_teaser(), which returns only the sale state and these texts.

import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SaleState } from "@/lib/catalog";
import type { Preview } from "@/lib/preview";

/** Shortcut chip at the top of the shop (bf_settings.quick_links). */
export interface QuickLink {
  label: string;
  mains?: string[];
  band?: number;
  /** Only shown during the sale. */
  sale_only?: boolean;
}

/** "Send me my cart at 10:00" form (bf_settings.reminder). */
export interface ReminderCopy {
  enabled?: boolean;
  list_id?: string;
  title?: string;
  /** Pop-up title when the cart is empty. */
  title_empty?: string;
  hero_link?: string;
  placeholder?: string;
  button?: string;
  consent?: string;
  thanks?: string;
  calendar?: string;
}

export interface TeaserInfo {
  state: SaleState;
  sale_start: string | null;
  sale_end: string | null;
  /** Safety net: sale time reached but Shopify prices aren't ready yet. */
  updating?: boolean;
  reminder?: ReminderCopy | null;
  /** "Only X left" at this many or fewer (during the sale). */
  low_stock_max?: number;
  /** After the sale: title, button text and link. */
  ended?: { title?: string; button?: string; url?: string } | null;
  /** Product pages: accessories to suggest, by Shopify product type. */
  goes_well_with?: Array<{ product_types: string[]; main: string; sub?: string; title?: string }>;
  quick_links?: QuickLink[];
  /** Set while the hidden preview is on. */
  preview?: Preview;
  /** Gift card sticker: percent off, 0 = off (bf_settings.gift_card_discount_*). */
  gift_card_discount?: number;
  /** Fyxx Rewards line on the home and product pages (bf_settings.rewards_strip_enabled). */
  rewards_strip?: boolean;
  /** Green Room mystery gift on/off (bf_settings.mystery_gift_enabled). */
  mystery_gift?: boolean;
  /** Header navigation sections (bf_settings.nav_groups). */
  nav_groups?: string[];
  copy: {
    teaser_headline?: string;
    teaser_subline?: string;
    teaser_countdown_label?: string;
    teaser_button?: string;
    teaser_cart_note?: string;
    teaser_updating_note?: string;
    /** "Prices drop automatically. No code needed." */
    no_code_note?: string;
    /** During the sale, before the countdown to sale_end: "Ends at midnight". */
    sale_end_label?: string;
    /** Cart note during the sale. */
    sale_cart_note?: string;
    /** Ticker per state, parts separated by "|". */
    ticker_preview?: string;
    ticker_sale?: string;
    ticker_ended?: string;
    /** Card label before the sale for products on the sale list. */
    sale_label_preview?: string;
  };
}

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export const teaserQueryOptions = (preview: Preview | null = null) =>
  queryOptions({
    queryKey: ["bf-teaser", preview ?? ""],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as Rpc).call(supabase, "bf_teaser", {
        p: { preview },
      });
      if (error) throw new Error(error.message);
      return data as TeaserInfo;
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    // While prices are updating, look again every minute so the sale
    // appears by itself once Shopify is ready.
    refetchInterval: (q) => (q.state.data?.updating ? 60_000 : false),
  });

/** "5d 03h 12m 08s" until the given time ("03h 12m 08s" on the last day). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
  return d > 0 ? `${d}d ${hms}` : hms;
}
