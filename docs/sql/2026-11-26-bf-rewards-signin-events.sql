-- (migration bf_rewards_signin_events) Fyxx Rewards login tracking.
-- Lets bf_events store how many existing members signed in vs how many created
-- a new account on the page:
--   rewards_signin  (existing member signed in)
--   rewards_signup  (new account created)
-- Where it happened (home | product | cart) is in bf_events.destination.
-- Already applied to Project Pulse; kept here for version control.
alter table bf_events drop constraint if exists bf_events_event_check;
alter table bf_events add constraint bf_events_event_check
  check (event = any (array[
    'visit','view_item','add_to_cart','begin_checkout','outbound',
    'tier_points_open','tier_points_join_tap','tier_points_login_tap',
    'rewards_signin','rewards_signup'
  ]));
