-- Fyxx Friday: reminder form settings, "no code" line, quick links.
-- Texts and the Klaviyo list id live in bf_settings (public, no secrets):
-- the Klaviyo list "Fyxx Friday 2026 - Cart reminder" is Wwe9ax.

insert into bf_settings (key, value, updated_at) values
('reminder', jsonb_build_object(
   'enabled', true,
   'list_id', 'Wwe9ax',
   'title', 'Send me my cart at 10:00 on Friday',
   'hero_link', 'Remind me at 10:00',
   'placeholder', 'Your email',
   'button', 'Remind me',
   'consent', 'By signing up you agree to get Fyxx marketing emails. Unsubscribe anytime.',
   'thanks', 'Done. We will email you at 10:00 on Friday.',
   'calendar', 'Add to calendar'), now()),
('no_code_note', to_jsonb('Prices drop automatically. No code needed.'::text), now()),
('quick_links', '[
  {"label":"Wine","mains":["Red Wine","White Wine","Rosé & Orange"]},
  {"label":"Spirits","mains":["Whisky","Vodka","Tequila & Mezcal","Gin","Rum","Arak","Sake","Cognac & Brandy","Liqueurs & Bitters"]},
  {"label":"Cigars","mains":["Cigars"]},
  {"label":"Accessories","mains":["Accessories"]},
  {"label":"Under 20 JOD","band":0},
  {"label":"Up to 50% off: wine accessories","mains":["Accessories/Wine accessories"],"sale_only":true}
]'::jsonb, now())
on conflict (key) do nothing;

-- A quick link with "mains" works like a header section: ?group=<label>.
create or replace function public.bf_group_mains(p_group text)
 returns text[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when nullif(p_group, '') is null then null else coalesce(
    (select array(select jsonb_array_elements_text(g -> 'mains'))
       from bf_settings s, jsonb_array_elements(s.value) g
      where s.key = 'nav_groups' and g ->> 'name' = p_group limit 1),
    (select array(select jsonb_array_elements_text(g -> 'mains'))
       from bf_settings s, jsonb_array_elements(s.value) g
      where s.key = 'quick_links' and g ->> 'label' = p_group and g ? 'mains' limit 1),
    '{}'::text[]) end
$function$;

create or replace function public.bf_teaser()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select bf_sale_state() || jsonb_build_object(
    'copy', coalesce(
      (select jsonb_object_agg(key, value) from bf_settings
       where key in ('teaser_headline', 'teaser_subline', 'teaser_countdown_label', 'teaser_button',
                     'teaser_cart_note', 'sale_label_preview', 'teaser_updating_note', 'no_code_note')),
      '{}'::jsonb),
    'reminder', (select value from bf_settings where key = 'reminder'),
    'quick_links', coalesce((select value from bf_settings where key = 'quick_links'), '[]'::jsonb),
    'nav_groups', coalesce((select jsonb_agg(g ->> 'name' order by ord)
       from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(g, ord) where s.key = 'nav_groups'), '[]'::jsonb))
$function$;
