-- 2026-11-23: visits before an order (migration bf_visits_before).
-- Input: [{"visitor_id": "...", "at": "<order time>"}, ...] (from the orders'
-- _bf_visitor cart attribute). Output: how many visits (tab sessions) that
-- visitor had on the site up to the order, and when they first came.
-- Same exclusion as the dashboards: team visits (internal).

create or replace function public.bf_visits_before(p_items jsonb)
returns table(visitor_id text, at timestamptz, visits bigint, first_seen timestamptz)
language sql stable security definer
set search_path to 'public'
as $$
  select i.visitor_id, i.at,
    count(distinct e.session_id) as visits,
    min(e.created_at) as first_seen
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(visitor_id text, at timestamptz)
  left join bf_events e
    on e.visitor_id = i.visitor_id and e.created_at <= i.at and not e.internal
  group by i.visitor_id, i.at;
$$;

revoke all on function public.bf_visits_before(jsonb) from public, anon, authenticated;
grant execute on function public.bf_visits_before(jsonb) to service_role;
