-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 21 Nov 2026 via the
-- Supabase MCP as migration "bf_card_compare_always" on gpnglfdusrymnookeclg.
-- Every discounted product shows its crossed-out original price at all times
-- (team decision 21 Nov). The discount badge fields stay sale-only.
create or replace function public.bf_card(b jsonb, p_state text)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'product_id', b -> 'product_id', 'variant_id', b -> 'variant_id', 'variant_title', b -> 'variant_title',
    'handle', b -> 'handle', 'title', b -> 'title', 'vendor', b -> 'vendor',
    'main_category', b -> 'main_category', 'sub_category', b -> 'sub_category', 'image_url', b -> 'image_url',
    'price', b -> 'price',
    'compare_at_price', b -> 'compare_at_price',
    'discount_percent', case when p_state = 'sale' then b -> 'discount_percent' else '0'::jsonb end,
    'saved_amount', case when p_state = 'sale' then b -> 'saved_amount' else '0'::jsonb end)
$$;
