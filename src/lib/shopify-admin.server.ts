// Server-only Shopify Admin API reader for the /admin sources report.
//
// Every cart this site creates carries hidden attributes (_bf_session,
// _utm_source, ...; see CART_ATTR). Shopify copies cart attributes onto the
// order, so here we pull the campaign window's online orders and keep the ones
// that came through this site, grouped by their source.
//
// Needs the BF_SHOPIFY_ADMIN_TOKEN secret: an Admin API access token from a custom
// app in Shopify admin with the `read_orders` scope (see docs/LOVABLE-SETUP.md).

import { CART_ATTR } from "@/lib/campaign-config";
import { SHOPIFY_STORE_PERMANENT_DOMAIN } from "@/lib/shopify";

const API_VERSION = "2026-10";
const MAX_PAGES = 40; // 40 x 250 = 10,000 orders, far above a campaign week

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

export type SiteOrdersResult =
  | { status: "ok"; orders: SiteOrder[] }
  | { status: "not_configured" }
  | { status: "error"; message: string };

const ORDERS_QUERY = `
  query bfOrders($q: String!, $after: String) {
    orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        createdAt
        cancelledAt
        customAttributes { key value }
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { numberOfOrders }
      }
    }
  }
`;

type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  customAttributes: Array<{ key: string; value: string | null }>;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { numberOfOrders: string | number } | null;
};

export async function fetchSiteOrders(
  sinceIso: string,
  untilIso: string,
): Promise<SiteOrdersResult> {
  const token = process.env["BF_SHOPIFY_ADMIN_TOKEN"];
  if (!token) return { status: "not_configured" };

  const url = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
  const q = `created_at:>='${sinceIso}' AND created_at:<'${untilIso}'`;
  const orders: SiteOrder[] = [];
  let after: string | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query: ORDERS_QUERY, variables: { q, after } }),
      });
      if (!res.ok) return { status: "error", message: `Shopify returned ${res.status}` };
      const json = (await res.json()) as {
        data?: {
          orders: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: OrderNode[];
          };
        };
        errors?: Array<{ message: string }>;
      };
      if (json.errors?.length || !json.data) {
        return {
          status: "error",
          message: json.errors?.[0]?.message ?? "Unexpected Shopify reply",
        };
      }

      for (const o of json.data.orders.nodes) {
        const attr = new Map(o.customAttributes.map((a) => [a.key, a.value ?? ""]));
        if (!attr.has(CART_ATTR.session)) continue; // not placed through this site
        const n = o.customer ? Number(o.customer.numberOfOrders) : NaN;
        orders.push({
          id: o.id,
          name: o.name,
          createdAt: o.createdAt,
          total: Number(o.totalPriceSet.shopMoney.amount) || 0,
          currency: o.totalPriceSet.shopMoney.currencyCode,
          cancelled: o.cancelledAt != null,
          utm_source: attr.get(CART_ATTR.source) || null,
          utm_medium: attr.get(CART_ATTR.medium) || null,
          utm_campaign: attr.get(CART_ATTR.campaign) || null,
          utm_content: attr.get(CART_ATTR.content) || null,
          // numberOfOrders counts today's order too, so 1 means first ever.
          isFirstOrder: Number.isFinite(n) ? n <= 1 : null,
        });
      }

      const info = json.data.orders.pageInfo;
      if (!info.hasNextPage || !info.endCursor) break;
      after = info.endCursor;
    }
    return { status: "ok", orders };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
