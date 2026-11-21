-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 21 Nov 2026 via the
-- Supabase MCP as migration "bf_nav_groups" on gpnglfdusrymnookeclg.
-- Header navigation sections (The Cellar / The Bar / The Humidor): each groups
-- several main categories (bf_settings.nav_groups, editable on /admin).
-- bf_catalog / bf_catalog_facets accept p.group. Only bf_ objects.

insert into public.bf_settings (key, value) values ('nav_groups', $json$[
  {"name": "The Cellar", "mains": ["Red Wine", "White Wine", "Rosé & Orange"]},
  {"name": "The Bar", "mains": ["Whisky", "Vodka", "Tequila & Mezcal", "Gin", "Rum", "Arak", "Sake", "Cognac & Brandy", "Liqueurs & Bitters"]},
  {"name": "The Humidor", "mains": ["Cigars"]}
]$json$::jsonb) on conflict (key) do nothing;

create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band int, p_q text, p_disc int, p_mains text[])
returns setof public.bf_products language sql stable security definer set search_path = public as $$
  with edges as (
    select coalesce(array(select (x #>> '{}')::numeric from jsonb_array_elements(
      coalesce((select value from bf_settings where key = 'price_bands'), '[20,50,100]'::jsonb)) x), '{}') as e
  )
  select b.* from bf_products b, edges
  where b.available
    and (p_state <> 'sale' or (b.compare_at_price is not null and b.compare_at_price > b.price))
    and (p_disc is null or p_state <> 'sale' or b.discount_percent >= p_disc)
    and (p_main is null or b.main_category = p_main)
    and (p_mains is null or b.main_category = any(p_mains))
    and (p_sub is null or b.sub_category = p_sub)
    and (p_band is null
      or (p_band = 0 and b.price < edges.e[1])
      or (p_band between 1 and array_length(edges.e, 1) - 1 and b.price >= edges.e[p_band] and b.price < edges.e[p_band + 1])
      or (p_band = array_length(edges.e, 1) and b.price >= edges.e[p_band]))
    and (p_q is null or position(lower(p_q) in lower(b.title || ' ' || coalesce(b.vendor, ''))) > 0)
$$;

-- 6-argument form kept (used by the "up to" and top deals parts): no group filter.
create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band int, p_q text, p_disc int)
returns setof public.bf_products language sql stable security definer set search_path = public as $$
  select * from bf_visible(p_state, p_main, p_sub, p_band, p_q, p_disc, null::text[])
$$;

-- Categories in a navigation group (bf_settings.nav_groups), or null.
create or replace function public.bf_group_mains(p_group text)
returns text[] language sql stable security definer set search_path = public as $$
  select case when nullif(p_group, '') is null then null else coalesce((
    select array(select jsonb_array_elements_text(g -> 'mains'))
      from bf_settings s, jsonb_array_elements(s.value) g
     where s.key = 'nav_groups' and g ->> 'name' = p_group limit 1), '{}'::text[]) end
$$;

create or replace function public.bf_catalog(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  st jsonb := bf_sale_state();
  v_state text := st ->> 'state';
  v_main text := nullif(p ->> 'main', '');
  v_sub text := nullif(p ->> 'sub', '');
  v_band int := nullif(p ->> 'band', '')::int;
  v_disc int := nullif(p ->> 'disc', '')::int;
  v_mains text[] := bf_group_mains(p ->> 'group');
  v_q text := nullif(btrim(coalesce(p ->> 'q', '')), '');
  v_batch int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'batch_size'), 24);
  v_limit int := least(greatest(coalesce(nullif(p ->> 'limit', '')::int, v_batch), 1), 100);
  v_offset int := greatest(coalesce(nullif(p ->> 'offset', '')::int, 0), 0);
  v_sort text := coalesce(nullif(p ->> 'sort', ''), case when v_state = 'sale' then 'discount' else 'newest' end);
  v_items jsonb; v_total int;
begin
  if v_sort = 'discount' and v_state <> 'sale' then v_sort := 'newest'; end if;
  select count(*) into v_total from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains);
  select coalesce(jsonb_agg(bf_card(to_jsonb(x), v_state) order by x.rn), '[]'::jsonb) into v_items from (
    select y.*, row_number() over () as rn from (
    select * from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains) b
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
  v_disc int := nullif(p ->> 'disc', '')::int;
  v_mains text[] := bf_group_mains(p ->> 'group');
  v_q text := nullif(btrim(coalesce(p ->> 'q', '')), '');
  v_min int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'upto_min_products'), 10);
  v_top int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'top_deals_count'), 12);
  v_edges jsonb := coalesce((select value from bf_settings where key = 'price_bands'), '[20,50,100]'::jsonb);
  v_map jsonb := coalesce((select value from bf_settings where key = 'category_mapping'), '[]'::jsonb);
  v_discs jsonb := coalesce((select value from bf_settings where key = 'discount_filters'), '[10,20,30]'::jsonb);
  v_sale boolean := v_state = 'sale';
  r jsonb;
begin
  if not v_sale then v_disc := null; end if;
  select jsonb_build_object(
    'state', v_state, 'sale_start', st -> 'sale_start', 'sale_end', st -> 'sale_end',
    'badge_amount_threshold', coalesce((select value from bf_settings where key = 'badge_amount_threshold'), '100'::jsonb),
    'batch_size', coalesce((select value from bf_settings where key = 'batch_size'), '24'::jsonb),
    'price_bands', v_edges,
    'headline_upto', case when v_sale then (select bf_upto(array_agg(discount_percent), v_min) from bf_visible(v_state, null, null, null, null, null)) end,
    -- products matching every current filter
    'total', (select count(*) from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains)),
    -- navigation groups (The Cellar, The Bar, The Humidor) with product counts
    'groups', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', g ->> 'name',
        'mains', g -> 'mains',
        'count', (select count(*) from bf_visible(v_state, null, null, v_band, v_q, v_disc, bf_group_mains(g ->> 'name')))
      ) order by ord), '[]'::jsonb)
      from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(g, ord) where s.key = 'nav_groups'),
    'all', jsonb_build_object('count', (select count(*) from bf_visible(v_state, null, null, v_band, v_q, v_disc))),
    'mains', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', m ->> 'name',
        'image', bf_main_image(m ->> 'name', m ->> 'image_handle'),
        'count', (select count(*) from bf_visible(v_state, m ->> 'name', null, v_band, v_q, v_disc)),
        'upto', case when v_sale then (select bf_upto(array_agg(discount_percent), v_min) from bf_visible(v_state, m ->> 'name', null, null, null, null)) end
      ) order by ord), '[]'::jsonb)
      from jsonb_array_elements(v_map) with ordinality as t(m, ord)),
    'subs', case when v_main is null then '[]'::jsonb else (select coalesce(jsonb_agg(x order by ord), '[]'::jsonb) from (
        select s.ord, jsonb_build_object(
          'name', s.name,
          'count', (select count(*) from bf_visible(v_state, v_main, s.name, v_band, v_q, v_disc)),
          'upto', case when v_sale then (select bf_upto(array_agg(discount_percent), v_min) from bf_visible(v_state, v_main, s.name, null, null, null)) end) as x
        from (
          select sub ->> 'name' as name, ord from jsonb_array_elements(
            (select m -> 'subs' from jsonb_array_elements(v_map) m where m ->> 'name' = v_main limit 1)) with ordinality as u(sub, ord)
          union all
          select (select m ->> 'fallback_sub' from jsonb_array_elements(v_map) m where m ->> 'name' = v_main limit 1), 1000
        ) s where s.name is not null
      ) z where (x ->> 'count')::int > 0) end,
    'bands', (select coalesce(jsonb_agg(jsonb_build_object(
        'index', i - 1,
        'min', case when i = 1 then null else (v_edges ->> (i - 2))::numeric end,
        'max', case when i > jsonb_array_length(v_edges) then null else (v_edges ->> (i - 1))::numeric end,
        'count', (select count(*) from bf_visible(v_state, v_main, v_sub, i - 1, v_q, v_disc, v_mains))
      ) order by i), '[]'::jsonb)
      from generate_series(1, jsonb_array_length(v_edges) + 1) i),
    -- "X% off or more" options (sale only); counts respect the other filters
    'discounts', case when not v_sale then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object(
        'min', (d #>> '{}')::int,
        'count', (select count(*) from bf_visible(v_state, v_main, v_sub, v_band, v_q, (d #>> '{}')::int, v_mains))
      ) order by (d #>> '{}')::int), '[]'::jsonb) from jsonb_array_elements(v_discs) d) end,
    'top_deals', case when not v_sale then '[]'::jsonb else (select coalesce(jsonb_agg(bf_card(to_jsonb(t), v_state) order by t.discount_percent desc, t.saved_amount desc), '[]'::jsonb) from (
        select * from (
          select distinct on (c.product_id) * from (
            select b.*, 0 as pick from (
              select distinct on (main_category) * from bf_visible(v_state, null, null, null, null, null)
              order by main_category, discount_percent desc, saved_amount desc) b
            union all
            select b.*, 1 as pick from bf_visible(v_state, null, null, null, null, null) b
          ) c order by c.product_id, c.pick
        ) u order by u.pick, u.discount_percent desc, u.saved_amount desc limit greatest(v_top, 0)
      ) t) end
  ) into r;
  return r;
end $$;


-- Public: sale state, teaser texts and the navigation groups (for the header).
create or replace function public.bf_teaser()
returns jsonb language sql stable security definer set search_path = public as $$
  select bf_sale_state() || jsonb_build_object(
    'copy', coalesce(
      (select jsonb_object_agg(key, value) from bf_settings
       where key in ('teaser_headline', 'teaser_subline', 'teaser_countdown_label', 'teaser_button', 'teaser_cart_note')),
      '{}'::jsonb),
    'nav_groups', coalesce((select jsonb_agg(g ->> 'name' order by ord)
       from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(g, ord) where s.key = 'nav_groups'), '[]'::jsonb))
$$;

revoke all on function public.bf_visible(text, text, text, int, text, int, text[]) from public, anon, authenticated;
revoke all on function public.bf_group_mains(text) from public, anon, authenticated;
grant execute on function public.bf_visible(text, text, text, int, text, int, text[]) to service_role;
grant execute on function public.bf_group_mains(text) to service_role;
