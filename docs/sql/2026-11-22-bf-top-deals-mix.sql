-- Fyxx Friday: Top deals = a mix. Half the row (rounded up) = biggest JOD
-- saving; the rest = biggest % off among products under
-- bf_settings.top_deals_cheap_under (JOD 50), not already picked. Shown
-- alternating (saving, %, saving, %...), so it isn't only expensive bottles.

insert into bf_settings (key, value, updated_at)
values ('top_deals_cheap_under', '50'::jsonb, now())
on conflict (key) do nothing;

do $$
declare d text; i int; j int;
begin
  d := pg_get_functiondef('public.bf_catalog_facets(jsonb)'::regprocedure);
  i := position('''top_deals''' in d);
  j := position(E'\n  ) into r;' in d);
  if i = 0 or j = 0 or position('  v_sale boolean := v_state = ''sale'';' in d) = 0 then
    raise exception 'bf_catalog_facets body changed';
  end if;
  d := left(d, i - 1) || $new$'top_deals', case when not v_sale then '[]'::jsonb else (select coalesce(jsonb_agg(bf_card(to_jsonb(t), v_state) order by t.rn, t.grp), '[]'::jsonb) from (
        with big as (
          select v.*, row_number() over (order by v.saved_amount desc, v.discount_percent desc) as rn, 0 as grp
            from bf_visible(v_state, null, null, null, null, null) v
           order by v.saved_amount desc, v.discount_percent desc
           limit ceil(greatest(v_top, 0) / 2.0)::int
        ), cheap as (
          select v.*, row_number() over (order by v.discount_percent desc, v.saved_amount desc) as rn, 1 as grp
            from bf_visible(v_state, null, null, null, null, null) v
           where v.price < v_cheap and v.product_id not in (select product_id from big)
           order by v.discount_percent desc, v.saved_amount desc
           limit greatest(greatest(v_top, 0) - (select count(*) from big), 0)
        )
        select * from big union all select * from cheap
      ) t) end$new$ || substr(d, j);
  d := replace(d, '  v_sale boolean := v_state = ''sale'';',
    E'  v_sale boolean := v_state = ''sale'';\n  v_cheap numeric := coalesce((select (value #>> ''{}'')::numeric from bf_settings where key = ''top_deals_cheap_under''), 50);');
  execute d;
end $$;

-- Follow-up (bf_top_deals_mix_variety + _fix): the cheap half takes at most 2
-- products per main category (so it isn't only 50% accessories):
--   cheap = bf_visible(...) v where v.product_id in (select product_id from
--     (select w.product_id, row_number() over (partition by w.main_category
--      order by w.discount_percent desc, w.saved_amount desc) per_cat
--      from bf_visible(...) w where w.price < v_cheap and not in big) z
--     where per_cat <= 2)
