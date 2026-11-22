-- Fyxx Friday final QA.
-- 1. Default sale sort ("Biggest markdown first") rotates through category
--    groups (bf_settings.discount_sort_groups: wine, spirits, cigars,
--    accessories; unlisted mains join the last group). Inside a group:
--    biggest % first, then lower price first. Sold out stays last. Other
--    sorts unchanged.
-- 2./3./4. Texts in bf_settings: ticker_preview / ticker_sale / ticker_ended
--    ("|"-separated), sale_cart_note, reminder.title_empty.
-- 5. bf_top_added(p_since, p_until): "Most added to cart" for /admin
--    (service role only). Excludes bf_settings.test_utm_sources.

insert into bf_settings (key, value, updated_at) values
('discount_sort_groups', '[
  {"name":"Wine","mains":["Red Wine","White Wine","Rosé & Orange"]},
  {"name":"Spirits","mains":["Whisky","Vodka","Tequila & Mezcal","Gin","Rum","Arak","Sake","Cognac & Brandy","Liqueurs & Bitters"]},
  {"name":"Cigars","mains":["Cigars"]},
  {"name":"Accessories","mains":["Accessories"]}
]'::jsonb, now()),
('ticker_preview', to_jsonb('FYXX FRIDAY | FRI 27 NOV | FROM 10:00 | UP TO 50% OFF'::text), now()),
('ticker_sale', to_jsonb('FYXX FRIDAY | LIVE NOW | ENDS AT MIDNIGHT | UP TO 50% OFF'::text), now()),
('ticker_ended', to_jsonb('FYXX FRIDAY IS OVER | THANK YOU'::text), now()),
('sale_cart_note', to_jsonb('Fyxx Friday prices are live until midnight. No code needed.'::text), now()),
('test_utm_sources', '["claude-qa","test"]'::jsonb, now())
on conflict (key) do nothing;

update bf_settings set value = value || '{"title_empty":"Remind me at 10:00 on Friday"}'::jsonb, updated_at = now()
 where key = 'reminder' and not (value ? 'title_empty');

-- Group position of a main category for the rotating sort (unlisted -> last).
create or replace function public.bf_sort_group(p_main text)
 returns int language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(
    (select (ord - 1)::int from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(g, ord)
      where s.key = 'discount_sort_groups' and g -> 'mains' ? p_main limit 1),
    1000)
$function$;
revoke all on function public.bf_sort_group(text) from public, anon, authenticated;

do $$
declare d text; o text;
begin
  d := pg_get_functiondef('public.bf_catalog(jsonb)'::regprocedure);
  o := $o$      case when v_sort = 'discount' then b.discount_percent end desc nulls last,
      case when v_sort = 'discount' then b.saved_amount end desc nulls last,$o$;
  if position(o in d) = 0 then raise exception 'bf_catalog body changed'; end if;
  d := replace(d, o, $n$      -- Rotate category groups: 1st wine, 1st spirit, 1st cigar, 1st accessory, 2nd wine...
      case when v_sort = 'discount' then row_number() over (
        partition by b.available, bf_sort_group(b.main_category)
        order by b.discount_percent desc, b.price asc, b.title) end asc nulls last,
      case when v_sort = 'discount' then bf_sort_group(b.main_category) end asc nulls last,$n$);
  execute d;
end $$;

create or replace function public.bf_top_added(p_since timestamptz, p_until timestamptz)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with ev as (
    select e.* from bf_events e
     where e.event = 'add_to_cart' and e.created_at >= p_since and e.created_at < p_until
       and not (lower(coalesce(e.utm_source, '')) in (
         select lower(x) from jsonb_array_elements_text(
           coalesce((select value from bf_settings where key = 'test_utm_sources'), '[]'::jsonb)) x))
  ), per as (
    select coalesce(product_title, variant_id) as product, max(product_handle) as handle,
           count(*) as adds, count(distinct session_id) as people, coalesce(sum(value), 0) as value
      from ev group by 1
  ), src as (
    select distinct on (product) product, utm_source, n from (
      select coalesce(product_title, variant_id) as product, coalesce(utm_source, '(direct)') as utm_source, count(*) as n
        from ev group by 1, 2) z
     order by product, n desc, utm_source
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'product', per.product, 'handle', per.handle, 'adds', per.adds, 'people', per.people,
      'value', round(per.value, 3), 'top_source', src.utm_source, 'top_source_adds', src.n)
      order by per.adds desc, per.people desc, per.value desc), '[]'::jsonb)
    from per left join src using (product)
$function$;
revoke all on function public.bf_top_added(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.bf_top_added(timestamptz, timestamptz) to service_role;

-- bf_teaser: also the ticker texts and the Friday cart note.
create or replace function public.bf_teaser()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select bf_sale_state() || jsonb_build_object(
    'copy', coalesce(
      (select jsonb_object_agg(key, value) from bf_settings
       where key in ('teaser_headline', 'teaser_subline', 'teaser_countdown_label', 'teaser_button',
                     'teaser_cart_note', 'sale_label_preview', 'teaser_updating_note', 'no_code_note',
                     'sale_end_label', 'sale_cart_note', 'ticker_preview', 'ticker_sale', 'ticker_ended')),
      '{}'::jsonb),
    'reminder', (select value from bf_settings where key = 'reminder'),
    'quick_links', coalesce((select value from bf_settings where key = 'quick_links'), '[]'::jsonb),
    'low_stock_max', coalesce((select value from bf_settings where key = 'low_stock_max'), '5'::jsonb),
    'ended', (select value from bf_settings where key = 'ended_copy'),
    'goes_well_with', coalesce((select value from bf_settings where key = 'goes_well_with'), '[]'::jsonb),
    'nav_groups', coalesce((select jsonb_agg(g ->> 'name' order by ord)
       from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(g, ord) where s.key = 'nav_groups'), '[]'::jsonb))
$function$;
