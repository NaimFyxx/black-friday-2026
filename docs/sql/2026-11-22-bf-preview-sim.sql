-- Fyxx Friday preview, part 2.
-- C. Safety net: at sale time, if fewer than bf_settings.sale_min_marked
--    (default 500) sale-list products have a crossed-out price in Shopify,
--    keep the before-sale shop and flag "updating". ?preview=updating shows it.
-- A. Admin price simulation: bf_catalog_sim / bf_catalog_facets_sim (service
--    role only, called by the site server after an admin check) show the
--    planned Friday prices from bf_sale_list (sale_price as price, price_now
--    crossed out). Cost is never read. Nothing is written.
-- B. In the sale state bf_visible already lists only in_sale products (switch
--    sale_list_filter on) with compare-at above price; unchanged.

insert into bf_settings (key, value, updated_at)
values ('sale_min_marked', '500'::jsonb, now())
on conflict (key) do nothing;

create or replace function public.bf_sale_state(p_preview text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  st jsonb := bf_sale_state();
  v_min int := coalesce((select (value #>> '{}')::int from bf_settings where key = 'sale_min_marked'), 500);
  v_marked int;
begin
  if p_preview = 'friday' then return st || '{"state":"sale","preview":"friday"}'::jsonb; end if;
  if p_preview = 'ended' then return st || '{"state":"ended","preview":"ended"}'::jsonb; end if;
  if p_preview = 'updating' then return st || '{"state":"preview","updating":true,"preview":"updating"}'::jsonb; end if;
  if st ->> 'state' = 'sale' then
    select count(*) into v_marked from bf_products b
     where b.available and b.in_sale and b.compare_at_price is not null and b.compare_at_price > b.price;
    if v_marked < v_min then
      return st || jsonb_build_object('state', 'preview', 'updating', true);
    end if;
  end if;
  return st;
end $function$;
revoke all on function public.bf_sale_state(text) from public, anon, authenticated;

-- bf_visible: in simulation (transaction-local bf.sim = 'on', set only by the
-- service-role-only *_sim functions below) sale-list rows use the planned prices.
create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band integer, p_q text, p_disc integer, p_mains text[])
 returns setof bf_products
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with edges as (
    select coalesce(array(select (x #>> '{}')::numeric from jsonb_array_elements(
      coalesce((select value from bf_settings where key = 'price_bands'), '[20,50,100]'::jsonb)) x), '{}') as e
  ), sw as (
    select coalesce((select (value #>> '{}')::boolean from bf_settings where key = 'sale_list_filter'), false) as only_sale,
           coalesce(current_setting('bf.sim', true), '') = 'on' as sim
  ), src as (
    select b.product_id, b.variant_id, b.variant_title, b.handle, b.title, b.vendor, b.product_type,
           b.main_category, b.sub_category, b.image_url,
           coalesce(s.sale_price, b.price) as price,
           case when s.sale_price is not null then s.price_now else b.compare_at_price end as compare_at_price,
           case when s.sale_price is not null then floor((s.price_now - s.sale_price) / s.price_now * 100)::int else b.discount_percent end as discount_percent,
           case when s.sale_price is not null then round(s.price_now - s.sale_price, 3) else b.saved_amount end as saved_amount,
           b.available, b.shopify_created_at, b.updated_at, b.in_sale
      from bf_products b cross join sw
      left join lateral (
        select l.sale_price, l.price_now from bf_sale_list l
         where sw.sim and b.in_sale and l.in_sale
           and b.variant_id = 'gid://shopify/ProductVariant/' || l.variant_id
           and l.sale_price is not null and l.price_now > l.sale_price
         limit 1) s on true
  )
  select b.* from src b, edges, sw
  where b.available
    and (not sw.only_sale or b.in_sale)
    and (p_state <> 'sale' or (b.compare_at_price is not null and b.compare_at_price > b.price))
    and (p_disc is null or p_state <> 'sale' or b.discount_percent >= p_disc)
    and (p_main is null or b.main_category = p_main)
    and (p_mains is null or b.main_category = any(p_mains)
         or (b.main_category || '/' || coalesce(b.sub_category, '')) = any(p_mains))
    and (p_sub is null or b.sub_category = p_sub)
    and (p_band is null
      or (p_band = 0 and b.price < edges.e[1])
      or (p_band between 1 and array_length(edges.e, 1) - 1 and b.price >= edges.e[p_band] and b.price < edges.e[p_band + 1])
      or (p_band = array_length(edges.e, 1) and b.price >= edges.e[p_band]))
    and (p_q is null or position(lower(p_q) in lower(b.title || ' ' || coalesce(b.vendor, ''))) > 0)
$function$;

create or replace function public.bf_catalog_sim(p jsonb)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare r jsonb;
begin
  perform set_config('bf.sim', 'on', true);
  r := bf_catalog(coalesce(p, '{}'::jsonb) || '{"preview":"friday"}'::jsonb);
  perform set_config('bf.sim', '', true);
  return r || '{"simulated":true}'::jsonb;
end $function$;

create or replace function public.bf_catalog_facets_sim(p jsonb)
 returns jsonb
 language plpgsql
 volatile security definer
 set search_path to 'public'
as $function$
declare r jsonb;
begin
  perform set_config('bf.sim', 'on', true);
  r := bf_catalog_facets(coalesce(p, '{}'::jsonb) || '{"preview":"friday"}'::jsonb);
  perform set_config('bf.sim', '', true);
  return r || '{"simulated":true}'::jsonb;
end $function$;

-- Planned Friday prices for one product's sale-list variants (product page).
create or replace function public.bf_sim_variant_prices(p_product_gid text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_object_agg('gid://shopify/ProductVariant/' || l.variant_id,
           jsonb_build_object('price', l.sale_price, 'compare_at', l.price_now)), '{}'::jsonb)
    from bf_sale_list l
   where l.in_sale and l.sale_price is not null and l.price_now > l.sale_price
     and 'gid://shopify/Product/' || l.product_id = p_product_gid
$function$;

revoke all on function public.bf_catalog_sim(jsonb) from public, anon, authenticated;
revoke all on function public.bf_catalog_facets_sim(jsonb) from public, anon, authenticated;
revoke all on function public.bf_sim_variant_prices(text) from public, anon, authenticated;
grant execute on function public.bf_catalog_sim(jsonb) to service_role;
grant execute on function public.bf_catalog_facets_sim(jsonb) to service_role;
grant execute on function public.bf_sim_variant_prices(text) to service_role;

-- Hardening (applied as bf_preview_sim_token): bf.sim must equal a random
-- token kept in bf_settings (not readable by anon), so setting the variable
-- by hand does nothing. Only the *_sim functions read and set it.
insert into bf_settings (key, value, updated_at)
values ('sim_token', to_jsonb(encode(gen_random_bytes(24), 'hex')), now())
on conflict (key) do nothing;
-- bf_visible: sim = (current_setting('bf.sim', true) = bf_settings.sim_token)
-- bf_catalog_sim / bf_catalog_facets_sim: set_config('bf.sim', <token>, true)

-- (migration bf_teaser_updating_note) bf_settings.teaser_updating_note
-- "Prices are updating, refresh in a few minutes", added to bf_teaser() copy.

-- (migration bf_sim_lookup_indexed, 22 Nov) Performance fix: the planned-price
-- lookup in bf_visible compared text ('gid://.../' || l.variant_id), so every
-- simulated row scanned bf_sale_list. bf_catalog_facets_sim took 7.4 s and hit
-- the 8 s API statement timeout (admin preview fell back to Shopify prices).
-- Now: l.variant_id = nullif(substring(b.variant_id from '(\d+)$'), '')::bigint
-- (primary key lookup): 0.24 s.
