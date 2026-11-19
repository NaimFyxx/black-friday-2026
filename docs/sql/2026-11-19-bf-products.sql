-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 19 Nov 2026 via the
-- Supabase MCP as migration "bf_products_catalog" on gpnglfdusrymnookeclg.
-- (Kept here because this repo's AGENTS.md reserves supabase/migrations/ for Lovable.)
-- Only bf_ objects. Prices are read from Shopify; nothing here changes a price.

-- 1. Product index, filled every 15 minutes by the bf-products-sync edge function.
create table if not exists public.bf_products (
  product_id         text primary key,          -- Shopify product GID
  variant_id         text not null,             -- the variant the card shows / adds to cart
  variant_title      text,
  handle             text not null,
  title              text not null,
  vendor             text,
  product_type       text,
  main_category      text not null,             -- Wine / Spirits / Cigars (bf_settings.category_mapping)
  sub_category       text,
  image_url          text,
  price              numeric(12,3) not null,    -- JOD, from Shopify
  compare_at_price   numeric(12,3),             -- JOD, from Shopify; null when none
  discount_percent   integer not null default 0,-- floor((compare - price) / compare * 100); 0 when no discount
  saved_amount       numeric(12,3) not null default 0, -- compare - price, JOD
  available          boolean not null,          -- in stock (Storefront availableForSale)
  shopify_created_at timestamptz,
  updated_at         timestamptz not null default now()  -- set on every sync, not just insert
);
create index if not exists bf_products_cat_idx  on public.bf_products (main_category, sub_category);
create index if not exists bf_products_disc_idx on public.bf_products (discount_percent desc);
create index if not exists bf_products_price_idx on public.bf_products (price);
alter table public.bf_products enable row level security;
revoke all on public.bf_products from anon, authenticated;
comment on table public.bf_products is 'Black Friday 2026 site: eligible products from Shopify (read only copy). Filled by edge function bf-products-sync every 15 min.';

-- 2. Settings (all editable from /admin -> Sale & products). Insert only if missing.
insert into public.bf_settings (key, value) values
  ('sale_start', '"2026-11-27T00:00:00+03:00"'::jsonb),
  ('sale_end',   '"2026-12-01T00:00:00+03:00"'::jsonb),
  ('badge_amount_threshold', '100'::jsonb),
  ('upto_min_products', '10'::jsonb),
  ('top_deals_count', '12'::jsonb),
  ('batch_size', '24'::jsonb),
  ('price_bands', '[20, 50, 100]'::jsonb),
  ('category_mapping', $json$[
    {"name": "Wine", "product_types": ["Wine"], "fallback_sub": "Other wine", "subs": [
      {"name": "Bubbles", "tags": ["WineStyle_Sparkling", "WineStyle_PetNat"]},
      {"name": "Rosé", "tags": ["WineStyle_Rosé"]},
      {"name": "Red", "tags": ["WineStyle_Red"]},
      {"name": "White", "tags": ["WineStyle_White"]},
      {"name": "Orange", "tags": ["WineStyle_Orange"]},
      {"name": "Fortified & sweet", "tags": ["WineStyle_Fortified", "WineType_Port", "WineType_Sweet", "WineType_Sweet (Fortified)", "WineStyle_White Port", "WineStyle_Ruby Port"]}
    ]},
    {"name": "Spirits", "subs": [
      {"name": "Whisky", "product_types": ["Whisky"]},
      {"name": "Gin", "product_types": ["Gin"]},
      {"name": "Rum", "product_types": ["Rum"]},
      {"name": "Tequila & Mezcal", "product_types": ["Tequila", "Mezcal"]},
      {"name": "Vodka", "product_types": ["Vodka"]},
      {"name": "Cognac & Brandy", "product_types": ["Cognac/Brandy"]},
      {"name": "Arak", "product_types": ["Arak", "Raki"]},
      {"name": "Liqueurs & aperitifs", "product_types": ["Liqueurs", "Vermouth", "Apéritif", "Digestif", "Bitters", "Absinthe"]},
      {"name": "Sake", "product_types": ["Sake"]}
    ]},
    {"name": "Cigars", "product_types": ["Cigars"], "subs": []}
  ]$json$::jsonb),
  ('exclusions', $json${
    "product_types": ["Beer", "Cider", "Mixer", "Energy Drink", "Water", "Ice", "Cocktail Garnish",
      "Snack Food", "Dried Fruits", "Fyxx Food", "Cheese Platter", "Sea Food", "Coffee",
      "Cigarettes", "Heated Tobacco", "Heated Tobacco Accessory", "Rolling Tobacco", "Rolling Paper",
      "Tobacco Heating Device", "Gift Cards", "Fyxx Cocktail"],
    "product_type_prefixes": ["Bundle"],
    "vendors": ["Fyxx | The Green Room"],
    "tags": ["PRODUCT TYPE: TGR"],
    "tags_in_main": {"Cigars": ["Country_Cuba"]}
  }$json$::jsonb)
on conflict (key) do nothing;

-- 3. Helpers (server-side only).
create or replace function public.bf_upto(p_percents int[], p_min int)
returns int language sql immutable set search_path = public as $$
  -- "Up to X%": the highest whole percent that at least p_min products reach (the
  -- p_min-th highest); if there are fewer than p_min items, their own highest.
  select case
    when coalesce(array_length(p_percents, 1), 0) = 0 then null
    when array_length(p_percents, 1) >= greatest(p_min, 1)
      then (select x from unnest(p_percents) x order by x desc offset greatest(p_min, 1) - 1 limit 1)
    else (select max(x) from unnest(p_percents) x)
  end
$$;

create or replace function public.bf_sale_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s timestamptz := (select (value #>> '{}')::timestamptz from bf_settings where key = 'sale_start');
  e timestamptz := (select (value #>> '{}')::timestamptz from bf_settings where key = 'sale_end');
begin
  return jsonb_build_object(
    'state', case when s is null or now() < s then 'preview' when e is not null and now() >= e then 'ended' else 'sale' end,
    'sale_start', s, 'sale_end', e, 'now', now());
end $$;

-- Products visible in the current state, with optional filters. Internal.
create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band int, p_q text)
returns setof public.bf_products language sql stable security definer set search_path = public as $$
  with edges as (
    select coalesce(array(select (x #>> '{}')::numeric from jsonb_array_elements(
      coalesce((select value from bf_settings where key = 'price_bands'), '[20,50,100]'::jsonb)) x), '{}') as e
  )
  select b.* from bf_products b, edges
  where b.available
    and (p_state <> 'sale' or (b.compare_at_price is not null and b.compare_at_price > b.price))
    and (p_main is null or b.main_category = p_main)
    and (p_sub is null or b.sub_category = p_sub)
    and (p_band is null
      or (p_band = 0 and b.price < edges.e[1])
      or (p_band between 1 and array_length(edges.e, 1) - 1 and b.price >= edges.e[p_band] and b.price < edges.e[p_band + 1])
      or (p_band = array_length(edges.e, 1) and b.price >= edges.e[p_band]))
    and (p_q is null or position(lower(p_q) in lower(b.title || ' ' || coalesce(b.vendor, ''))) > 0)
$$;

create or replace function public.bf_card(b jsonb, p_state text)
returns jsonb language sql immutable set search_path = public as $$
  -- One product card. Preview: normal prices only (no compare-at, no discount fields).
  select jsonb_build_object(
    'product_id', b -> 'product_id', 'variant_id', b -> 'variant_id', 'variant_title', b -> 'variant_title',
    'handle', b -> 'handle', 'title', b -> 'title', 'vendor', b -> 'vendor',
    'main_category', b -> 'main_category', 'sub_category', b -> 'sub_category', 'image_url', b -> 'image_url',
    'price', b -> 'price',
    'compare_at_price', case when p_state = 'sale' then b -> 'compare_at_price' else 'null'::jsonb end,
    'discount_percent', case when p_state = 'sale' then b -> 'discount_percent' else '0'::jsonb end,
    'saved_amount', case when p_state = 'sale' then b -> 'saved_amount' else '0'::jsonb end)
$$;

-- 4. Public read functions used by the site (catalog data is the public shop catalog).
create or replace function public.bf_catalog(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  st jsonb := bf_sale_state();
  v_state text := st ->> 'state';
  v_main text := nullif(p ->> 'main', '');
  v_sub text := nullif(p ->> 'sub', '');
  v_band int := nullif(p ->> 'band', '')::int;
  v_q text := nullif(btrim(coalesce(p ->> 'q', '')), '');
  v_batch int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'batch_size'), 24);
  v_limit int := least(greatest(coalesce(nullif(p ->> 'limit', '')::int, v_batch), 1), 100);
  v_offset int := greatest(coalesce(nullif(p ->> 'offset', '')::int, 0), 0);
  v_sort text := coalesce(nullif(p ->> 'sort', ''), case when v_state = 'sale' then 'discount' else 'newest' end);
  v_items jsonb; v_total int;
begin
  if v_sort = 'discount' and v_state <> 'sale' then v_sort := 'newest'; end if;
  select count(*) into v_total from bf_visible(v_state, v_main, v_sub, v_band, v_q);
  select coalesce(jsonb_agg(bf_card(to_jsonb(x), v_state) order by x.rn), '[]'::jsonb) into v_items from (
    select y.*, row_number() over () as rn from (
    select * from bf_visible(v_state, v_main, v_sub, v_band, v_q) b
    order by
      case when v_sort = 'discount' then b.discount_percent end desc nulls last,
      case when v_sort = 'discount' then b.saved_amount end desc nulls last,
      case when v_sort = 'price_asc' then b.price end asc nulls last,
      case when v_sort = 'price_desc' then b.price end desc nulls last,
      case when v_sort = 'newest' then b.shopify_created_at end desc nulls last,
      b.title, b.product_id
    offset v_offset limit v_limit) y) x;
  return jsonb_build_object('state', v_state, 'sort', v_sort, 'total', v_total,
    'offset', v_offset, 'limit', v_limit, 'has_more', v_offset + v_limit < v_total, 'items', v_items);
end $$;

create or replace function public.bf_catalog_facets(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  st jsonb := bf_sale_state();
  v_state text := st ->> 'state';
  v_main text := nullif(p ->> 'main', '');
  v_sub text := nullif(p ->> 'sub', '');
  v_band int := nullif(p ->> 'band', '')::int;
  v_q text := nullif(btrim(coalesce(p ->> 'q', '')), '');
  v_min int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'upto_min_products'), 10);
  v_top int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'top_deals_count'), 12);
  v_edges jsonb := coalesce((select value from bf_settings where key = 'price_bands'), '[20,50,100]'::jsonb);
  v_map jsonb := coalesce((select value from bf_settings where key = 'category_mapping'), '[]'::jsonb);
  v_sale boolean := v_state = 'sale';
  r jsonb;
begin
  select jsonb_build_object(
    'state', v_state, 'sale_start', st -> 'sale_start', 'sale_end', st -> 'sale_end',
    'badge_amount_threshold', coalesce((select value from bf_settings where key = 'badge_amount_threshold'), '100'::jsonb),
    'batch_size', coalesce((select value from bf_settings where key = 'batch_size'), '24'::jsonb),
    'price_bands', v_edges,
    -- headline "Up to X% off" over every sale item
    'headline_upto', case when v_sale then (select bf_upto(array_agg(discount_percent), v_min) from bf_visible(v_state, null, null, null, null)) end,
    'all', jsonb_build_object('count', (select count(*) from bf_visible(v_state, null, null, v_band, v_q))),
    -- row 1 (in the order of the mapping); counts respect price band + search
    'mains', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', m ->> 'name',
        'count', (select count(*) from bf_visible(v_state, m ->> 'name', null, v_band, v_q)),
        'upto', case when v_sale then (select bf_upto(array_agg(discount_percent), v_min) from bf_visible(v_state, m ->> 'name', null, null, null)) end
      ) order by ord), '[]'::jsonb)
      from jsonb_array_elements(v_map) with ordinality as t(m, ord)),
    -- row 2: sub categories of the chosen main, in mapping order, only those with products
    'subs', case when v_main is null then '[]'::jsonb else (select coalesce(jsonb_agg(x order by ord), '[]'::jsonb) from (
        select s.ord, jsonb_build_object(
          'name', s.name,
          'count', (select count(*) from bf_visible(v_state, v_main, s.name, v_band, v_q)),
          'upto', case when v_sale then (select bf_upto(array_agg(discount_percent), v_min) from bf_visible(v_state, v_main, s.name, null, null)) end) as x
        from (
          select sub ->> 'name' as name, ord from jsonb_array_elements(
            (select m -> 'subs' from jsonb_array_elements(v_map) m where m ->> 'name' = v_main limit 1)) with ordinality as u(sub, ord)
          union all
          select (select m ->> 'fallback_sub' from jsonb_array_elements(v_map) m where m ->> 'name' = v_main limit 1), 1000
        ) s where s.name is not null
      ) z where (x ->> 'count')::int > 0) end,
    -- price bands; counts respect main/sub + search
    'bands', (select coalesce(jsonb_agg(jsonb_build_object(
        'index', i - 1,
        'min', case when i = 1 then null else (v_edges ->> (i - 2))::numeric end,
        'max', case when i > jsonb_array_length(v_edges) then null else (v_edges ->> (i - 1))::numeric end,
        'count', (select count(*) from bf_visible(v_state, v_main, v_sub, i - 1, v_q))
      ) order by i), '[]'::jsonb)
      from generate_series(1, jsonb_array_length(v_edges) + 1) i),
    -- Top deals (sale only): best of each main first, then the biggest discounts
    'top_deals', case when not v_sale then '[]'::jsonb else (select coalesce(jsonb_agg(bf_card(to_jsonb(t), v_state) order by t.discount_percent desc, t.saved_amount desc), '[]'::jsonb) from (
        select * from (
          select distinct on (c.product_id) * from (
            select b.*, 0 as pick from (
              select distinct on (main_category) * from bf_visible(v_state, null, null, null, null)
              order by main_category, discount_percent desc, saved_amount desc) b
            union all
            select b.*, 1 as pick from bf_visible(v_state, null, null, null, null) b
          ) c order by c.product_id, c.pick
        ) u order by u.pick, u.discount_percent desc, u.saved_amount desc limit greatest(v_top, 0)
      ) t) end
  ) into r;
  return r;
end $$;

revoke all on function public.bf_upto(int[], int) from public, anon, authenticated;
revoke all on function public.bf_visible(text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.bf_card(jsonb, text) from public, anon, authenticated;
grant execute on function public.bf_upto(int[], int) to service_role;
grant execute on function public.bf_visible(text, text, text, int, text) to service_role;
grant execute on function public.bf_card(jsonb, text) to service_role;
-- Public read: the shop catalog and the sale dates (no secrets are read).
revoke all on function public.bf_sale_state() from public;
revoke all on function public.bf_catalog(jsonb) from public;
revoke all on function public.bf_catalog_facets(jsonb) from public;
grant execute on function public.bf_sale_state() to anon, authenticated, service_role;
grant execute on function public.bf_catalog(jsonb) to anon, authenticated, service_role;
grant execute on function public.bf_catalog_facets(jsonb) to anon, authenticated, service_role;
