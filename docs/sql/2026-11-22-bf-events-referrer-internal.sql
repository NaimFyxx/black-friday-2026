-- bf_events: where untagged visitors came from, and the team's own visits.
-- * referrer: the site the visitor first arrived from (hostname, e.g.
--   instagram.com, l.facebook.com, google.com) or 'direct'. First touch,
--   kept in the browser like the UTMs.
-- * internal: true when the browser has the hidden-preview cookie or is
--   signed in to /admin (decided on the server). Internal events are stored
--   but left out of every dashboard count.
-- Sources: sessions without utm_source now show the referrer as medium
-- (source "(none)", medium "instagram.com" / "direct").

alter table bf_events add column if not exists referrer text;
alter table bf_events add column if not exists internal boolean not null default false;

create or replace function public.bf_source_funnel(p_since timestamptz, p_until timestamptz)
 returns table(utm_source text, utm_medium text, utm_campaign text, sessions bigint, product_views bigint, cart_sessions bigint, checkout_sessions bigint)
 language sql stable security definer set search_path to 'public'
as $function$
  with per_session as (
    select e.session_id,
      (array_agg(e.utm_source   order by e.created_at))[1] as utm_source,
      (array_agg(e.utm_medium   order by e.created_at))[1] as utm_medium,
      (array_agg(e.utm_campaign order by e.created_at))[1] as utm_campaign,
      (array_agg(e.referrer     order by e.created_at))[1] as referrer,
      count(*) filter (where e.event = 'view_item')  as views,
      bool_or(e.event = 'add_to_cart')               as carted,
      bool_or(e.event = 'begin_checkout')            as checked_out,
      bool_or(e.internal)                            as internal
    from public.bf_events e
    where e.created_at >= p_since and e.created_at < p_until
    group by e.session_id
  )
  select p.utm_source,
    -- No UTM: show where they came from instead (or "(none)" for visits
    -- recorded before 22 Nov, when this wasn't stored yet).
    case when p.utm_source is null then p.referrer else p.utm_medium end,
    p.utm_campaign,
    count(*)::bigint,
    coalesce(sum(p.views), 0)::bigint,
    count(*) filter (where p.carted)::bigint,
    count(*) filter (where p.checked_out)::bigint
  from per_session p
  where not p.internal
  group by 1, 2, 3
  order by count(*) desc;
$function$;

create or replace function public.bf_activity_daily(p_since timestamptz, p_until timestamptz)
 returns table(day date, visits bigint, product_views bigint, carts bigint, checkouts bigint)
 language sql stable security definer set search_path to 'public'
as $function$
  select (e.created_at at time zone 'Asia/Amman')::date as day,
    count(distinct e.session_id) filter (where e.event = 'visit'),
    count(*)                     filter (where e.event = 'view_item'),
    count(distinct e.session_id) filter (where e.event = 'add_to_cart'),
    count(distinct e.session_id) filter (where e.event = 'begin_checkout')
  from public.bf_events e
  where e.created_at >= p_since and e.created_at < p_until and not e.internal
  group by 1
  order by 1;
$function$;

do $$
declare d text; o text;
begin
  d := pg_get_functiondef('public.bf_top_added(timestamptz,timestamptz)'::regprocedure);
  o := $o$where e.event = 'add_to_cart' and e.created_at >= p_since and e.created_at < p_until$o$;
  if position(o in d) = 0 then raise exception 'bf_top_added body changed'; end if;
  d := replace(d, o, o || ' and not e.internal');
  execute d;
end $$;
