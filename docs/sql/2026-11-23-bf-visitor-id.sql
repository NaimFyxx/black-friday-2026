-- 2026-11-23: anonymous visitor id (migration bf_visitor_id).
-- One random id per browser (localStorage + first-party cookie fyxx_vid),
-- sent with every bf_events row, so /admin can count visitors and how many
-- times each came back. Nothing personal: a random number only.

alter table public.bf_events add column if not exists visitor_id text;

create index if not exists bf_events_visitor_idx
  on public.bf_events (visitor_id, created_at)
  where visitor_id is not null;

-- Visitors in a time range: totals, how many came 1 / 2 / 3 / 4+ times, and
-- the most frequent visitors with what they did. Same exclusions as the other
-- dashboards: team visits (internal) and test tags (bf_settings.test_utm_sources).
create or replace function public.bf_visitors(
  p_since timestamptz, p_until timestamptz, p_limit int default 100)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  with ev as (
    select e.*
    from bf_events e
    where e.visitor_id is not null
      and e.created_at >= p_since and e.created_at < p_until
      and not e.internal
      and not (lower(coalesce(e.utm_source, '')) in (
        select lower(x) from jsonb_array_elements_text(
          coalesce((select value from bf_settings where key = 'test_utm_sources'), '[]'::jsonb)) x))
  ),
  per_visitor as (
    select ev.visitor_id,
      count(distinct ev.session_id)                                          as visits,
      min(ev.created_at)                                                     as first_seen,
      max(ev.created_at)                                                     as last_seen,
      (array_agg(ev.utm_source order by ev.created_at))[1]                   as utm_source,
      (array_agg(case when ev.utm_source is null then ev.referrer else ev.utm_medium end
                 order by ev.created_at))[1]                                 as utm_medium,
      count(distinct ev.session_id) filter (where ev.event = 'view_item')    as visits_viewed,
      count(*) filter (where ev.event = 'add_to_cart')                       as adds,
      count(distinct ev.session_id) filter (where ev.event = 'add_to_cart')  as visits_carted,
      bool_or(ev.event = 'begin_checkout')                                   as checked_out
    from ev
    group by ev.visitor_id
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'visitors',            count(*),
      'returning',           count(*) filter (where visits > 1),
      'visits',              coalesce(sum(visits), 0),
      'carted',              count(*) filter (where adds > 0),
      'returning_carted',    count(*) filter (where visits > 1 and adds > 0),
      'checked_out',         count(*) filter (where checked_out),
      'returning_checked_out', count(*) filter (where visits > 1 and checked_out)),
    'by_visits', jsonb_build_object(
      '1',  count(*) filter (where visits = 1),
      '2',  count(*) filter (where visits = 2),
      '3',  count(*) filter (where visits = 3),
      '4+', count(*) filter (where visits >= 4)),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.visits desc, r.last_seen desc)
      from (select * from per_visitor order by visits desc, last_seen desc limit p_limit) r
    ), '[]'::jsonb))
  from per_visitor;
$$;

revoke all on function public.bf_visitors(timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.bf_visitors(timestamptz, timestamptz, int) to service_role;
