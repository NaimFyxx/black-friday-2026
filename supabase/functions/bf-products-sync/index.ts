// bf-products-sync: fills public.bf_products for the Black Friday 2026 site
// (repo NaimFyxx/black-friday-2026). Runs every 15 minutes (pg_cron job
// "bf-products-sync") and from the "Refresh products now" button on /admin.
//
// READ ONLY on Shopify: reads the public Storefront API of drynksapp.myshopify.com.
// Never changes a price. Writes only bf_products and the bf_settings row
// "products_last_refresh". Touches no Pulse table.
//
// Body: { key, dry_run?, mapping?, exclusions? }. `key` must match
// bf_settings.edge_key. A dry run changes nothing and may try a mapping or
// exclusions that are not saved yet.
// in_sale: product has a variant on the Fyxx Friday sale list (bf_sale_flags).
// Which products are kept, and in which category, comes from bf_settings
// "category_mapping" and "exclusions" (editable on /admin).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const STOREFRONT = "https://drynksapp.myshopify.com/api/2026-10/graphql.json";
// Public Storefront token (the same one the website uses in the browser).
const STOREFRONT_TOKEN = "6bdaffcdd3b82d66838dff6365ead6cd";
const MAX_PAGES = 40; // 40 x 250 products

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

async function sha256(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
async function sameString(a: string, b: string) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// A product joins the FIRST main (in mapping order) whose product_types include
// its Shopify product type (and, when require_tags is set, that has one of those
// tags), or whose handles list names it. Inside a main it gets the first sub
// that matches by Shopify collection, tag, product type or handle; otherwise
// fallback_sub. catch_all_types: a product of one of these types that matched
// no main goes to this main (e.g. a wine with no style tag).
type Sub = {
  name: string;
  tags?: string[];
  product_types?: string[];
  collections?: string[];
  handles?: string[];
};
type Main = {
  name: string;
  product_types?: string[];
  require_tags?: string[];
  handles?: string[];
  catch_all_types?: string[];
  fallback_sub?: string;
  image_handle?: string;
  subs?: Sub[];
};
type Exclusions = {
  product_types?: string[];
  product_type_prefixes?: string[];
  vendors?: string[];
  tags?: string[];
  tags_in_main?: Record<string, string[]>;
};

type SfVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: { amount: string };
  compareAtPrice: { amount: string } | null;
};
type SfProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  createdAt: string;
  featuredImage: { url: string } | null;
  variants: { nodes: SfVariant[] };
};

const QUERY = `
  query bfProducts($after: String) {
    products(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle title vendor productType tags createdAt
        featuredImage { url }
        variants(first: 20) {
          nodes { id title availableForSale price { amount } compareAtPrice { amount } }
        }
      }
    }
  }`;

async function fetchAll(): Promise<SfProduct[]> {
  const out: SfProduct[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetch(STOREFRONT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: QUERY, variables: { after } }),
    });
    if (!r.ok) throw new Error(`Shopify Storefront HTTP ${r.status}`);
    const j = await r.json();
    if (j.errors) throw new Error(`Shopify: ${JSON.stringify(j.errors).slice(0, 300)}`);
    const p = j.data.products;
    out.push(...p.nodes);
    if (!p.pageInfo.hasNextPage) return out;
    after = p.pageInfo.endCursor;
  }
  throw new Error(`More than ${MAX_PAGES * 250} products; stopped to be safe`);
}

const has = (list: string[] | undefined, v: string) => !!list && list.includes(v);
const anyTag = (list: string[] | undefined, tags: string[]) =>
  !!list && list.some((t) => tags.includes(t));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function classify(
  p: SfProduct,
  map: Main[],
  ex: Exclusions,
  inCollections: Map<string, Set<string>>,
) {
  const type = (p.productType ?? "").trim();
  if (has(ex.product_types, type)) return null;
  if (ex.product_type_prefixes?.some((pre) => type.startsWith(pre))) return null;
  if (has(ex.vendors, p.vendor)) return null;
  if (anyTag(ex.tags, p.tags)) return null;
  const cols = inCollections.get(p.id) ?? new Set<string>();
  const pick = (m: Main) => {
    if (anyTag(ex.tags_in_main?.[m.name], p.tags)) return null;
    const sub = (m.subs ?? []).find(
      (s) =>
        has(s.handles, p.handle) ||
        (s.collections ?? []).some((c) => cols.has(c)) ||
        anyTag(s.tags, p.tags) ||
        has(s.product_types, type),
    );
    return { main: m.name, sub: sub?.name ?? m.fallback_sub ?? null };
  };
  for (const m of map) {
    if (has(m.handles, p.handle)) return pick(m);
  }
  for (const m of map) {
    const typeOk = has(m.product_types, type);
    if (typeOk && (!m.require_tags?.length || anyTag(m.require_tags, p.tags))) return pick(m);
  }
  const catchAll = map.find((m) => has(m.catch_all_types, type));
  return catchAll ? pick(catchAll) : null; // not in the mapping (accessories, glassware, ...)
}

/** Product ids in each Shopify collection the mapping uses for sub categories. */
async function collectionMembers(map: Main[]): Promise<Map<string, Set<string>>> {
  const handles = new Set(map.flatMap((m) => (m.subs ?? []).flatMap((s) => s.collections ?? [])));
  const byProduct = new Map<string, Set<string>>();
  for (const handle of handles) {
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await fetch(STOREFRONT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({
          query: `query($h: String!, $a: String) { collection(handle: $h) { products(first: 250, after: $a) {
            pageInfo { hasNextPage endCursor } nodes { id } } } }`,
          variables: { h: handle, a: after },
        }),
      });
      if (!r.ok) throw new Error(`Shopify Storefront HTTP ${r.status} (collection ${handle})`);
      const j = await r.json();
      const prods = j.data?.collection?.products;
      if (!prods) break; // collection missing: ignore it
      for (const n of prods.nodes as Array<{ id: string }>) {
        if (!byProduct.has(n.id)) byProduct.set(n.id, new Set());
        byProduct.get(n.id)!.add(handle);
      }
      if (!prods.pageInfo.hasNextPage) break;
      after = prods.pageInfo.endCursor;
    }
  }
  return byProduct;
}

function toRow(p: SfProduct, cat: { main: string; sub: string | null }, saleVariants: Set<string>) {
  const all = p.variants.nodes;
  if (!all.length) return null;
  // Fyxx Friday sale list: when some variants are on it, the card uses one of
  // those (and "in stock" means one of those is in stock).
  const onSale = all.filter((v) => saleVariants.has(v.id));
  const variants = onSale.length ? onSale : all;
  const info = variants.map((v) => {
    const price = Number(v.price.amount);
    const cmp = v.compareAtPrice ? Number(v.compareAtPrice.amount) : null;
    const disc = cmp && cmp > price ? Math.floor(((cmp - price) / cmp) * 100) : 0;
    return { v, price, cmp: cmp && cmp > price ? cmp : null, disc };
  });
  // The card shows one variant: the in-stock one with the biggest discount,
  // else the first in-stock one, else the first.
  const inStock = info.filter((i) => i.v.availableForSale);
  const pick = inStock.length
    ? inStock.reduce((a, b) => (b.disc > a.disc ? b : a), inStock[0])
    : info[0];
  return {
    product_id: p.id,
    variant_id: pick.v.id,
    variant_title: pick.v.title,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor || null,
    product_type: p.productType || null,
    main_category: cat.main,
    sub_category: cat.sub,
    image_url: p.featuredImage?.url ?? null,
    price: r3(pick.price),
    compare_at_price: pick.cmp === null ? null : r3(pick.cmp),
    discount_percent: pick.disc,
    saved_amount: pick.cmp === null ? 0 : r3(pick.cmp - pick.price),
    available: inStock.length > 0,
    in_sale: onSale.length > 0,
    shopify_created_at: p.createdAt,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Variants on the Fyxx Friday sale list (public.bf_sale_flags, in_sale = true),
 * read with the service role; visitors never see this list. A failed read
 * stops the sync (nothing is changed) rather than marking everything "not on
 * sale" and emptying the landing page.
 */
async function saleListVariants(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("bf_sale_flags")
      .select("variant_gid")
      .eq("in_sale", true)
      .order("variant_gid")
      .range(from, from + 999);
    if (error) throw new Error(`sale list read failed: ${error.message}`);
    for (const r of data ?? []) ids.add(r.variant_gid as string);
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db.from("bf_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: { key?: string; dry_run?: boolean; mapping?: Main[]; exclusions?: Exclusions } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const edgeKey = await setting<string | null>("edge_key", null);
  if (!edgeKey || !body.key || !(await sameString(body.key, edgeKey)))
    return json({ error: "forbidden" }, 403);

  const started = Date.now();
  try {
    const map =
      body.dry_run && body.mapping ? body.mapping : await setting<Main[]>("category_mapping", []);
    const ex =
      body.dry_run && body.exclusions
        ? body.exclusions
        : await setting<Exclusions>("exclusions", {});
    if (!Array.isArray(map) || map.length === 0)
      throw new Error("bf_settings.category_mapping is empty");

    const [products, inCollections, saleVariants] = await Promise.all([
      fetchAll(),
      collectionMembers(map),
      saleListVariants(),
    ]);
    const rows = products
      .map((p) => {
        const c = classify(p, map, ex, inCollections);
        return c ? toRow(p, c, saleVariants) : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.main_category] = (counts[r.main_category] ?? 0) + 1;

    if (body.dry_run) {
      // In-stock counts per main / sub, and in-stock products left without a category.
      const tree: Record<string, Record<string, number>> = {};
      for (const r of rows.filter((x) => x.available)) {
        tree[r.main_category] ??= {};
        const t = tree[r.main_category]!;
        t[r.sub_category ?? "(none)"] = (t[r.sub_category ?? "(none)"] ?? 0) + 1;
      }
      const kept = new Set(rows.map((r) => r.product_id));
      const leftOut: Record<string, number> = {};
      for (const p of products) {
        if (kept.has(p.id) || !p.variants.nodes.some((v) => v.availableForSale)) continue;
        leftOut[p.productType || "(no type)"] = (leftOut[p.productType || "(no type)"] ?? 0) + 1;
      }
      return json({
        ok: true,
        dry_run: true,
        fetched: products.length,
        kept: rows.length,
        counts,
        tree,
        leftOut,
      });
    }

    // Safety: a sudden drop (bad fetch or broken mapping) must not empty the site.
    const { count: before } = await db
      .from("bf_products")
      .select("product_id", { count: "exact", head: true });
    if (before && rows.length < before * 0.5) {
      throw new Error(
        `Only ${rows.length} products kept vs ${before} last time; nothing changed. Check the mapping and exclusions.`,
      );
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db
        .from("bf_products")
        .upsert(rows.slice(i, i + 500), { onConflict: "product_id" });
      if (error) throw new Error(`save failed: ${error.message}`);
    }
    // Remove products no longer eligible (deleted in Shopify or now excluded).
    const keep = new Set(rows.map((r) => r.product_id));
    const existing: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("bf_products")
        .select("product_id")
        .order("product_id")
        .range(from, from + 999);
      if (error) throw new Error(`read failed: ${error.message}`);
      existing.push(...(data ?? []).map((e) => e.product_id as string));
      if (!data || data.length < 1000) break;
    }
    const stale = existing.filter((id) => !keep.has(id));
    for (let i = 0; i < stale.length; i += 200) {
      await db
        .from("bf_products")
        .delete()
        .in("product_id", stale.slice(i, i + 200));
    }

    const result = {
      at: new Date().toISOString(),
      ok: true,
      count: rows.length,
      on_sale_list_in_stock: rows.filter((r) => r.in_sale && r.available).length,
      removed: stale.length,
      counts,
      duration_ms: Date.now() - started,
    };
    await db
      .from("bf_settings")
      .upsert(
        { key: "products_last_refresh", value: result, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return json(result);
  } catch (e) {
    const result = {
      at: new Date().toISOString(),
      ok: false,
      error: String((e as Error).message ?? e),
      duration_ms: Date.now() - started,
    };
    if (!body.dry_run)
      await db
        .from("bf_settings")
        .upsert(
          { key: "products_last_refresh", value: result, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
    return json(result, 500);
  }
});
