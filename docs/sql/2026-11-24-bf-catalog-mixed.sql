-- 2026-11-24: default product order on the landing page, "mixed".
--   Fyxx products first (vendor contains bf_settings.vendor_priority[1]),
--   then everything else. Inside each of those two blocks the categories take
--   turns (a wine, a whisky, a cigar, a gin...) in a shuffled order, and the
--   products inside a category are shuffled too. The shuffle changes once a
--   day (Amman date) and stays the same all day, so paging ("load more") never
--   repeats or skips a product. In-stock first, as before.
--   The "block" field is no longer sent in default order, so the grid stops
--   drawing a category heading (categories are mixed now).
-- Previous version (by category, Fyxx first, cheapest first): see
-- 2026-11-22-bf-vendor-priority.sql.
CREATE OR REPLACE FUNCTION public.bf_catalog(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  st jsonb := bf_sale_state(p ->> 'preview');
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
  v_sort text := coalesce(nullif(p ->> 'sort', ''), 'default');
  v_fyxx text := lower(coalesce((select s.value ->> 0 from bf_settings s where s.key = 'vendor_priority'), 'fyxx'));
  v_seed text := to_char(now() at time zone 'Asia/Amman', 'YYYY-MM-DD');
  v_items jsonb; v_total int;
begin
  if v_sort = 'discount' and v_state <> 'sale' then v_sort := 'default'; end if;
  select count(*) into v_total from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains, true);
  select coalesce(jsonb_agg(
           bf_card(to_jsonb(x) - 'blk' - 'rn', v_state)
           order by x.rn), '[]'::jsonb) into v_items from (
    select y.*, row_number() over () as rn from (
      select k.* from (
        select b.*,
          case when v_fyxx <> '' and lower(coalesce(b.vendor, '')) like '%' || v_fyxx || '%' then 0 else 1 end as blk
        from bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains, true) b) k
      order by
        k.available desc,
        case when v_sort = 'default' then k.blk end asc nulls last,
        -- Default: categories take turns, shuffled once a day.
        case when v_sort = 'default' then row_number() over (
          partition by k.available, k.blk, k.main_category
          order by md5(v_seed || k.product_id::text)) end asc nulls last,
        case when v_sort = 'default' then md5(v_seed || coalesce(k.main_category, '')) end asc nulls last,
        -- Picked "discount": categories take turns, biggest discount first.
        case when v_sort = 'discount' then row_number() over (
          partition by k.available, bf_sort_group(k.main_category)
          order by k.discount_percent desc, k.price asc, k.title) end asc nulls last,
        case when v_sort = 'discount' then bf_sort_group(k.main_category) end asc nulls last,
        case when v_sort = 'price_asc' then k.price end asc nulls last,
        case when v_sort = 'price_desc' then k.price end desc nulls last,
        case when v_sort = 'newest' then k.shopify_created_at end desc nulls last,
        k.title, k.product_id
      offset v_offset limit v_limit) y) x;
  return jsonb_build_object('state', v_state, 'sort', v_sort, 'total', v_total,
    'offset', v_offset, 'limit', v_limit, 'has_more', v_offset + v_limit < v_total, 'items', v_items);
end $function$;
