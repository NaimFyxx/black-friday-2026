-- Fyxx Friday, phase 3 (Friday version).
-- * bf_products.stock: units left of the card's variant (from the sync).
-- * bf_card returns available + stock.
-- * During the sale the grid also lists sold-out sale products, at the end
--   (8-argument bf_visible with p_sold_out; the 7- and 6-argument versions
--   stay in-stock only, so filters, counts, top deals and "up to" are unchanged).
-- * bf_settings: low_stock_max (5), sale_end_label, ended_copy, goes_well_with.

alter table bf_products add column if not exists stock integer;

insert into bf_settings (key, value, updated_at) values
('low_stock_max', '5'::jsonb, now()),
('sale_end_label', to_jsonb('Ends at midnight'::text), now()),
('ended_copy', jsonb_build_object('title', 'Fyxx Friday is over. Thank you!',
   'button', 'Shop at myfyxx.com', 'url', 'https://www.myfyxx.com'), now()),
('goes_well_with', '[
  {"product_types":["Wine"],"main":"Accessories","sub":"Wine accessories","title":"Goes well with"},
  {"product_types":["Whisky","Vodka","Tequila","Mezcal","Gin","Rum","Arak","Raki","Sake","Cognac/Brandy","Liqueurs","Bitters","Vermouth","Apéritif","Digestif","Absinthe"],"main":"Accessories","sub":"Wine accessories","title":"Goes well with"}
]'::jsonb, now())
on conflict (key) do nothing;

do $$
declare d text;
begin
  -- 8-argument bf_visible = the current 7-argument body + sold-out switch.
  d := pg_get_functiondef('public.bf_visible(text,text,text,integer,text,integer,text[])'::regprocedure);
  if position('where b.available' in d) = 0 then raise exception 'bf_visible body changed'; end if;
  d := replace(d, 'p_mains text[])', 'p_mains text[], p_sold_out boolean)');
  d := replace(d, 'where b.available', 'where (b.available or (p_sold_out and p_state = ''sale''))');
  execute d;
end $$;

create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band integer, p_q text, p_disc integer, p_mains text[])
 returns setof bf_products language sql stable security definer set search_path to 'public'
as $function$
  select * from bf_visible(p_state, p_main, p_sub, p_band, p_q, p_disc, p_mains, false)
$function$;
revoke all on function public.bf_visible(text,text,text,integer,text,integer,text[],boolean) from public, anon, authenticated;

create or replace function public.bf_card(b jsonb, p_state text)
 returns jsonb language sql immutable set search_path to 'public'
as $function$
  select jsonb_build_object(
    'product_id', b -> 'product_id', 'variant_id', b -> 'variant_id', 'variant_title', b -> 'variant_title',
    'handle', b -> 'handle', 'title', b -> 'title', 'vendor', b -> 'vendor',
    'main_category', b -> 'main_category', 'sub_category', b -> 'sub_category', 'image_url', b -> 'image_url',
    'price', b -> 'price',
    'compare_at_price', b -> 'compare_at_price',
    'in_sale', coalesce(b -> 'in_sale', 'false'::jsonb),
    'available', coalesce(b -> 'available', 'true'::jsonb),
    'stock', coalesce(b -> 'stock', 'null'::jsonb),
    'discount_percent', case when p_state = 'sale' then b -> 'discount_percent' else '0'::jsonb end,
    'saved_amount', case when p_state = 'sale' then b -> 'saved_amount' else '0'::jsonb end)
$function$;

-- bf_catalog: during the sale include sold-out sale products, always last.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.bf_catalog(jsonb)'::regprocedure);
  if position('bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains)' in d) = 0
     or position('    order by' in d) = 0 then raise exception 'bf_catalog body changed'; end if;
  d := replace(d, 'bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains)',
                  'bf_visible(v_state, v_main, v_sub, v_band, v_q, v_disc, v_mains, true)');
  d := replace(d, E'    order by\n', E'    order by\n      b.available desc,\n');
  execute d;
end $$;
