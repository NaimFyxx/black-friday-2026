-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 21 Nov 2026 via the
-- Supabase MCP as migration "bf_discount_filter" on gpnglfdusrymnookeclg.
-- Adds a "discount at least X%" filter (sale only) and a total count for the
-- current filters. Thresholds in bf_settings.discount_filters (editable on /admin).
-- Only bf_ objects.

insert into public.bf_settings (key, value) values ('discount_filters', '[10, 20, 30]'::jsonb)
on conflict (key) do nothing;

create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band int, p_q text, p_disc int)
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
    and (p_sub is null or b.sub_category = p_sub)
    and (p_band is null
      or (p_band = 0 and b.price < edges.e[1])
      or (p_band between 1 and array_length(edges.e, 1) - 1 and b.price >= edges.e[p_band] and b.price < edges.e[p_band + 1])
      or (p_band = array_length(edges.e, 1) and b.price >= edges.e[p_band]))
    and (p_q is null or position(lower(p_q) in lower(b.title || ' ' || coalesce(b.vendor, ''))) > 0)
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
  v_q text := nullif(btrim(coalesce(p ->> 'q', '')), '');
  v_batch int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'batch_size'), 24);
  v_limit int := least(greatest(coalesce(nullif(p ->> 'limit', '')::int, v_batch), 1), 100);
  v_offset int := greatest(coalesce(nullif(p ->> 'offset', '')::int, 0), 0);
  v_sort text := coalesce(nullif(p ->> 'sort', ''), case when v_state = 'sale' then 'discount' else 'newest' end);
  v_items jsonb; v_total int;
begin
  if v_sort = 'discount' and v_state <> 'sale' then v_sort := 'newest'; end if;
  select count(*) into v_total from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc);
  select coalesce(jsonb_agg(bf_card(to_jsonb(x), v_state) order by x.rn), '[]'::jsonb) into v_items from (
    select y.*, row_number() over () as rn from (
    select * from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc) b
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
    'total', (select count(*) from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc)),
    'all', jsonb_build_object('count', (select count(*) from bf_visible(v_state, null, null, v_band, v_q, v_disc))),
    'mains', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', m ->> 'name',
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
        'count', (select count(*) from bf_visible(v_state, v_main, v_sub, i - 1, v_q, v_disc))
      ) order by i), '[]'::jsonb)
      from generate_series(1, jsonb_array_length(v_edges) + 1) i),
    -- "X% off or more" options (sale only); counts respect the other filters
    'discounts', case when not v_sale then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object(
        'min', (d #>> '{}')::int,
        'count', (select count(*) from bf_visible(v_state, v_main, v_sub, v_band, v_q, (d #>> '{}')::int))
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

drop function if exists public.bf_visible(text, text, text, int, text);
revoke all on function public.bf_visible(text, text, text, int, text, int) from public, anon, authenticated;
grant execute on function public.bf_visible(text, text, text, int, text, int) to service_role;
