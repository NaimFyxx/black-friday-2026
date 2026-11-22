-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 22 Nov 2026 via the
-- Supabase MCP as migration "bf_sale_list_filter" on gpnglfdusrymnookeclg.
-- Landing page shows only products on the Fyxx Friday sale list
-- (public.bf_sale_flags, built from bf_sale_list by Pulse). bf-products-sync
-- reads the flags with the service role and stores bf_products.in_sale; the
-- flags themselves are never exposed to visitors. Switch: bf_settings
-- sale_list_filter (true = only in_sale products). Only bf_ objects changed;
-- bf_sale_list / bf_sale_flags are read only.

alter table public.bf_products add column if not exists in_sale boolean not null default false;

insert into public.bf_settings (key, value) values
  ('sale_list_filter', 'false'::jsonb), -- switched on after the first sync filled in_sale
  ('sale_label_preview', '"Marked down on Friday"'::jsonb)
on conflict (key) do nothing;

create or replace function public.bf_visible(p_state text, p_main text, p_sub text, p_band int, p_q text, p_disc int, p_mains text[])
returns setof public.bf_products language sql stable security definer set search_path = public as $$
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
    and (p_mains is null or b.main_category = any(p_mains))
    and (p_sub is null or b.sub_category = p_sub)
    and (p_band is null
      or (p_band = 0 and b.price < edges.e[1])
      or (p_band between 1 and array_length(edges.e, 1) - 1 and b.price >= edges.e[p_band] and b.price < edges.e[p_band + 1])
      or (p_band = array_length(edges.e, 1) and b.price >= edges.e[p_band]))
    and (p_q is null or position(lower(p_q) in lower(b.title || ' ' || coalesce(b.vendor, ''))) > 0)
$$;

create or replace function public.bf_card(b jsonb, p_state text)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'product_id', b -> 'product_id', 'variant_id', b -> 'variant_id', 'variant_title', b -> 'variant_title',
    'handle', b -> 'handle', 'title', b -> 'title', 'vendor', b -> 'vendor',
    'main_category', b -> 'main_category', 'sub_category', b -> 'sub_category', 'image_url', b -> 'image_url',
    'price', b -> 'price',
    'compare_at_price', b -> 'compare_at_price',
    'in_sale', coalesce(b -> 'in_sale', 'false'::jsonb),
    'discount_percent', case when p_state = 'sale' then b -> 'discount_percent' else '0'::jsonb end,
    'saved_amount', case when p_state = 'sale' then b -> 'saved_amount' else '0'::jsonb end)
$$;

-- bf_teaser also returns the pre-sale card label (sale_label_preview).
create or replace function public.bf_teaser()
returns jsonb language sql stable security definer set search_path = public as $$
  select bf_sale_state() || jsonb_build_object(
    'copy', coalesce(
      (select jsonb_object_agg(key, value) from bf_settings
       where key in ('teaser_headline', 'teaser_subline', 'teaser_countdown_label', 'teaser_button', 'teaser_cart_note', 'sale_label_preview')),
      '{}'::jsonb),
    'nav_groups', coalesce((select jsonb_agg(g ->> 'name' order by ord)
       from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(g, ord) where s.key = 'nav_groups'), '[]'::jsonb))
$$;
