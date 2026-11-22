-- Fyxx Friday: a nav section (The Cellar / The Bar / The Humidor) can now hold
-- one sub category of a main, written "Main/Sub" in nav_groups.mains,
-- e.g. "Accessories/Wine accessories". Plain "Main" entries work as before.
-- Only bf_ functions and bf_settings change.

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
    select coalesce((select (value #>> '{}')::boolean from bf_settings where key = 'sale_list_filter'), false) as only_sale
  )
  select b.* from bf_products b, edges, sw
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

update bf_settings set value = '[
  {"name":"The Cellar","mains":["Red Wine","White Wine","Rosé & Orange","Accessories/Wine accessories"]},
  {"name":"The Bar","mains":["Whisky","Vodka","Tequila & Mezcal","Gin","Rum","Arak","Sake","Cognac & Brandy","Liqueurs & Bitters","Accessories/Bar accessories"]},
  {"name":"The Humidor","mains":["Cigars","Accessories/Cigar accessories"]}
]'::jsonb, updated_at = now() where key = 'nav_groups';

-- Inside a section, the "Type" options only count that section's products
-- (so The Cellar > Accessories shows only Wine accessories). Same function as
-- before with v_mains added to the two sub-category counts.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.bf_catalog_facets(jsonb)'::regprocedure);
  d := replace(d,
    $x$'count', (select count(*) from bf_visible(v_state, v_main, s.name, v_band, v_q, v_disc)),$x$,
    $x$'count', (select count(*) from bf_visible(v_state, v_main, s.name, v_band, v_q, v_disc, v_mains)),$x$);
  d := replace(d,
    $x$from bf_visible(v_state, v_main, s.name, null, null, null)) end) as x$x$,
    $x$from bf_visible(v_state, v_main, s.name, null, null, null, v_mains)) end) as x$x$);
  if position('s.name, v_band, v_q, v_disc, v_mains' in d) = 0 then raise exception 'facets patch did not apply'; end if;
  execute d;
end $$;
