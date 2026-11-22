-- Fyxx Friday: hidden preview (?preview=friday / ?preview=ended) to see the
-- sale or the after-sale page before Friday. Only changes which state the
-- catalog functions use for display. Reads only; prices are never written.
-- bf_sale_state() itself is unchanged; a one-argument version adds the override.

create or replace function public.bf_sale_state(p_preview text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when p_preview = 'friday' then bf_sale_state() || '{"state":"sale","preview":"friday"}'::jsonb
    when p_preview = 'ended' then bf_sale_state() || '{"state":"ended","preview":"ended"}'::jsonb
    else bf_sale_state() end
$function$;
revoke all on function public.bf_sale_state(text) from public, anon, authenticated;

-- Teaser texts with the same override (the old no-argument bf_teaser stays).
create or replace function public.bf_teaser(p jsonb)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select bf_teaser() || (bf_sale_state(p ->> 'preview') - 'now')
$function$;
grant execute on function public.bf_teaser(jsonb) to anon, authenticated;

-- bf_catalog / bf_catalog_facets: read the state through the override.
do $$
declare f text; d text;
begin
  foreach f in array array['public.bf_catalog(jsonb)', 'public.bf_catalog_facets(jsonb)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('st jsonb := bf_sale_state();' in d) = 0 then raise exception 'unexpected body in %', f; end if;
    d := replace(d, 'st jsonb := bf_sale_state();', 'st jsonb := bf_sale_state(p ->> ''preview'');');
    execute d;
  end loop;
end $$;
