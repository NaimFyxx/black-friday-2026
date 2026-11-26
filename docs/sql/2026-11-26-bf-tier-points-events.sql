-- (migration bf_tier_points_events) Fyxx Rewards 2x points tracking.
-- Lets bf_events store the three tier-points events the site now sends:
--   tier_points_open       (tiers opened)
--   tier_points_join_tap   ("Join Fyxx Rewards" tapped)
--   tier_points_login_tap  ("Log in" tapped)
-- Where it happened (home | product | cart) is stored in bf_events.destination.
-- Run this in Supabase (or ask Lovable) before the new events will be saved;
-- until then the inserts are silently dropped (recordEvent is best-effort).
alter table bf_events drop constraint if exists bf_events_event_check;
alter table bf_events add constraint bf_events_event_check
  check (event = any (array[
    'visit','view_item','add_to_cart','begin_checkout','outbound',
    'tier_points_open','tier_points_join_tap','tier_points_login_tap'
  ]));
