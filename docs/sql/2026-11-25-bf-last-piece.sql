-- 2026-11-25: "Last piece" label (applied as migration bf_last_piece).
--   bf_settings.last_piece_enabled (true), switch on /admin > Offers on the site.
--   bf_teaser(p) gains 'last_piece' (boolean).
--   bf_stock(p_handle) returns the stock count for one product (null when not
--   available), for the product page. Granted to anon.
insert into bf_settings (key, value, updated_at) values ('last_piece_enabled', 'true'::jsonb, now())
on conflict (key) do nothing;
CREATE OR REPLACE FUNCTION public.bf_stock(p_handle text)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select case when available then stock end from bf_products where handle = p_handle limit 1
$function$;
grant execute on function public.bf_stock(text) to anon, authenticated;
-- bf_teaser(p): same as before plus
--   'last_piece', coalesce((select value from bf_settings where key = 'last_piece_enabled'), 'false'::jsonb) = 'true'::jsonb
