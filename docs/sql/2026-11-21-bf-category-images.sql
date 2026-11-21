-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 21 Nov 2026 via the
-- Supabase MCP as migration "bf_category_images" on gpnglfdusrymnookeclg.
-- Category circles: bf_catalog_facets now returns an image per main category,
-- the photo of the product named by category_mapping[].image_handle (falls back
-- to the first in-stock product of that category). Only bf_ objects.
--

-- Photo for a category circle: the named product, else the first in-stock one.
create or replace function public.bf_main_image(p_main text, p_handle text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select image_url from bf_products where handle = p_handle and image_url is not null limit 1),
    (select image_url from bf_products where main_category = p_main and available and image_url is not null
     order by shopify_created_at limit 1))
$$;
revoke all on function public.bf_main_image(text, text) from public, anon, authenticated;
grant execute on function public.bf_main_image(text, text) to service_role;

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

