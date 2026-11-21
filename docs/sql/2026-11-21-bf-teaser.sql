-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 21 Nov 2026 via the
-- Supabase MCP as migration "bf_teaser_copy" on gpnglfdusrymnookeclg.
-- Teaser hero and cart note text, editable from /admin -> Sale & products.
-- Only bf_ objects.

insert into public.bf_settings (key, value) values
  ('teaser_headline', '"Prepare your cart for the 27th."'::jsonb),
  ('teaser_subline', '"Fyxx Friday. 24 hours only, Friday 27 November."'::jsonb),
  ('teaser_countdown_label', '"Prices drop in"'::jsonb),
  ('teaser_button', '"Start adding to cart"'::jsonb),
  ('teaser_cart_note', '"Prices drop at 00:00 on Friday 27 November. Your cart updates automatically."'::jsonb)
on conflict (key) do nothing;

-- Public: the sale state plus the teaser text (no other settings are exposed).
create or replace function public.bf_teaser()
returns jsonb language sql stable security definer set search_path = public as $$
  select bf_sale_state() || jsonb_build_object('copy', coalesce(
    (select jsonb_object_agg(key, value) from bf_settings
     where key in ('teaser_headline', 'teaser_subline', 'teaser_countdown_label', 'teaser_button', 'teaser_cart_note')),
    '{}'::jsonb))
$$;
revoke all on function public.bf_teaser() from public;
grant execute on function public.bf_teaser() to anon, authenticated, service_role;
