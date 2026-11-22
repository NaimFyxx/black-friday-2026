// Server-only: Shopify orders placed through this site, for /admin.
//
// Every cart this site creates carries hidden attributes (_bf_session,
// _utm_source, ...; see CART_ATTR), which Shopify copies onto the order. The
// `bf-admin` Supabase Edge Function reads the campaign window's orders with
// Pulse's Shopify app (read only; this site can't see those secrets itself)
// and returns only the ones that came through this site.

import { callBfAdmin } from "./bf-edge.server";

export type SiteOrder = {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  currency: string;
  cancelled: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  isFirstOrder: boolean | null;
};

/** A myfyxx.com website order by a browser that visited the Friday site first. */
export type AfterVisitOrder = {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  currency: string;
  cancelled: boolean;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  firstVisit: string | null;
  isFirstOrder: boolean | null;
};

export type SiteOrdersResult =
  | { status: "ok"; orders: SiteOrder[]; afterVisit?: AfterVisitOrder[] }
  | { status: "not_configured" }
  | { status: "error"; message: string };

export async function fetchSiteOrders(
  sinceIso: string,
  untilIso: string,
): Promise<SiteOrdersResult> {
  try {
    return await callBfAdmin<SiteOrdersResult>({
      action: "orders",
      since: sinceIso,
      until: untilIso,
    });
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
