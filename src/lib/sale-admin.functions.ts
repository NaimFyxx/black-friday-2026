// /admin -> Sale & products. Every number and switch for the Fyxx Friday
// catalog lives in bf_settings; this page reads and saves them (service role,
// admin session required) and can start a product refresh right away.
// Only bf_settings and bf_products are touched. Prices are never written here.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Loose = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const KEYS = [
  "sale_start",
  "sale_end",
  "badge_amount_threshold",
  "upto_min_products",
  "top_deals_count",
  "batch_size",
  "price_bands",
  "discount_filters",
  "nav_groups",
  "sale_list_filter",
  "sale_label_preview",
  "category_mapping",
  "exclusions",
  "products_last_refresh",
  "teaser_headline",
  "teaser_subline",
  "teaser_countdown_label",
  "teaser_button",
  "teaser_cart_note",
  "teaser_updating_note",
] as const;

async function admin() {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Loose;
}

/** Same rule as the site: the N-th highest percent, or the highest if fewer than N. */
function upto(percents: number[], min: number): number | null {
  if (percents.length === 0) return null;
  const sorted = [...percents].sort((a, b) => b - a);
  return sorted.length >= Math.max(min, 1) ? sorted[Math.max(min, 1) - 1]! : sorted[0]!;
}

export const getSaleAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data: rows, error } = await db
    .from("bf_settings")
    .select("key, value, updated_at")
    .in("key", KEYS);
  if (error) throw new Error(error.message);
  const settings: Record<string, Json> = {};
  for (const r of rows ?? []) settings[r.key] = r.value;

  // Counts per category, and what "up to" would be once the sale is on.
  const products: Array<{
    main_category: string;
    sub_category: string | null;
    available: boolean;
    price: number;
    compare_at_price: number | null;
    discount_percent: number;
  }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await db
      .from("bf_products")
      .select("main_category, sub_category, available, price, compare_at_price, discount_percent")
      .order("product_id")
      .range(from, from + 999);
    if (e) throw new Error(e.message);
    products.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const min = Number(settings["upto_min_products"] ?? 10);
  const groups = new Map<
    string,
    { main: string; sub: string | null; total: number; inStock: number; onSale: number[] }
  >();
  const add = (key: string, main: string, sub: string | null, p: (typeof products)[number]) => {
    const g = groups.get(key) ?? { main, sub, total: 0, inStock: 0, onSale: [] };
    g.total++;
    if (p.available) g.inStock++;
    if (p.available && p.compare_at_price !== null && Number(p.compare_at_price) > Number(p.price))
      g.onSale.push(p.discount_percent);
    groups.set(key, g);
  };
  for (const p of products) {
    add("~all", "All", null, p);
    add(p.main_category, p.main_category, null, p);
    add(
      `${p.main_category}/${p.sub_category ?? "(none)"}`,
      p.main_category,
      p.sub_category ?? "(none)",
      p,
    );
  }
  const stats = [...groups.values()]
    .map((g) => ({
      main: g.main,
      sub: g.sub,
      total: g.total,
      inStock: g.inStock,
      onSale: g.onSale.length,
      upto: upto(g.onSale, min),
    }))
    .sort((a, b) =>
      a.main === "All"
        ? -1
        : b.main === "All"
          ? 1
          : a.main.localeCompare(b.main) || (a.sub ?? "").localeCompare(b.sub ?? ""),
    );

  return { settings, stats };
});

// Amman has been on UTC+3 all year since 2022.
const ammanLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the date and time picker")
  .transform((v) => `${v}:00+03:00`);
const int = (lo: number, hi: number) => z.number().int().min(lo).max(hi);
// Shop copy: plain text, no em or en dashes (house style).
const copy = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[\u2013\u2014]/.test(v), {
      message: "Please don't use dashes like – or — in shop text",
    });

const SubSchema = z.object({
  name: z.string().min(1).max(40),
  tags: z.array(z.string()).optional(),
  product_types: z.array(z.string()).optional(),
});
const MappingSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(40),
      product_types: z.array(z.string()).optional(),
      fallback_sub: z.string().max(40).optional(),
      subs: z.array(SubSchema).optional(),
    }),
  )
  .min(1);
const ExclusionsSchema = z.object({
  product_types: z.array(z.string()).optional(),
  product_type_prefixes: z.array(z.string()).optional(),
  vendors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  tags_in_main: z.record(z.array(z.string())).optional(),
});

const SaveInput = z
  .object({
    sale_start: ammanLocal,
    sale_end: ammanLocal,
    badge_amount_threshold: z.number().min(0).max(100000),
    upto_min_products: int(1, 1000),
    top_deals_count: int(0, 48),
    batch_size: int(6, 96),
    price_bands: z.array(z.number().positive()).min(1).max(8),
    discount_filters: z.array(z.number().int().min(1).max(95)).max(6),
    nav_groups: z
      .array(
        z.object({ name: z.string().trim().min(1).max(30), mains: z.array(z.string()).min(1) }),
      )
      .max(6),
    category_mapping: MappingSchema,
    exclusions: ExclusionsSchema,
    teaser_headline: copy(80).pipe(z.string().min(1, "The headline can't be empty")),
    teaser_subline: copy(140),
    teaser_countdown_label: copy(40),
    teaser_button: copy(40).pipe(z.string().min(1, "The button text can't be empty")),
    teaser_cart_note: copy(200),
    teaser_updating_note: copy(120),
    sale_list_filter: z.boolean(),
    sale_label_preview: copy(60),
  })
  .refine((d) => new Date(d.sale_start) < new Date(d.sale_end), {
    message: "The sale must end after it starts",
  })
  .refine((d) => d.price_bands.every((v, i, a) => i === 0 || v > a[i - 1]!), {
    message: "Price bands must go up, e.g. 20, 50, 100",
  });

export const saveSaleSettings = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const now = new Date().toISOString();
    const rows = Object.entries(data).map(([key, value]) => ({ key, value, updated_at: now }));
    const { error } = await db.from("bf_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshProductsNow = createServerFn({ method: "POST" }).handler(async () => {
  await admin();
  const { getBfSetting } = await import("./bf-edge.server");
  const base = process.env["SUPABASE_URL"];
  const key = await getBfSetting("edge_key");
  if (!base || !key)
    throw new Error("The product refresh isn't set up (SUPABASE_URL or edge_key missing)");
  const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/bf-products-sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const result = (await res.json()) as { ok: boolean; count?: number; error?: string; at: string };
  if (!result.ok) throw new Error(result.error ?? `Refresh failed (${res.status})`);
  return result;
});
