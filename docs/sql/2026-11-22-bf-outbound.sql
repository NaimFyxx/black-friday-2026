-- (migration bf_events_outbound) Clicks that leave the Friday site.
alter table bf_events drop constraint if exists bf_events_event_check;
alter table bf_events add constraint bf_events_event_check
  check (event = any (array['visit','view_item','add_to_cart','begin_checkout','outbound']));
alter table bf_events add column if not exists destination text;
-- bf_outbound(p_since, p_until) -> [{destination, link, clicks, people}]
-- (destination 'website' | 'app'; link = which button, stored in product_title;
-- team visits excluded; service role only).
