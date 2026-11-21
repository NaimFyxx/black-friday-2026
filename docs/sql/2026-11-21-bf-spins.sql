-- Black Friday 2026 (repo NaimFyxx/black-friday-2026), applied 21 Nov 2026 via the
-- Supabase MCP as migration "bf_spins" on gpnglfdusrymnookeclg.
-- "Spin & win" Fyxx points slot machine on the landing page. Points are NOT
-- credited automatically: wins are stored here and the team credits them in
-- LoyaltyLion (CSV download on /admin/spins). Only bf_ objects.

create table if not exists public.bf_spins (
  id          bigint generated always as identity primary key,
  email       text not null,                -- lower-cased, trimmed
  device_id   text,                         -- random id kept in the browser
  points      integer not null check (points > 0),
  created_at  timestamptz not null default now()
);
create unique index if not exists bf_spins_email_key on public.bf_spins (email);
create unique index if not exists bf_spins_device_key on public.bf_spins (device_id) where device_id is not null;
alter table public.bf_spins enable row level security;
revoke all on public.bf_spins from anon, authenticated;
comment on table public.bf_spins is 'Black Friday 2026 site: Spin & win results (one per email and per browser). Points to credit in LoyaltyLion.';

insert into public.bf_settings (key, value) values
  ('spin_enabled', 'true'::jsonb),
  ('spin_odds', '[{"points":5,"weight":40},{"points":10,"weight":30},{"points":15,"weight":15},{"points":20,"weight":10},{"points":25,"weight":5}]'::jsonb),
  ('spin_copy', $json${
    "sticker": "Spin & win",
    "title": "Spin for Fyxx points",
    "subtitle": "One spin per person. Win 5 to 25 Fyxx points.",
    "email_label": "Your email (the one on your Fyxx account)",
    "button": "Spin",
    "win": "+{points} Fyxx points",
    "win_note": "Nice one! We will add the points to your Fyxx account.",
    "already": "You already spun and won {points} Fyxx points.",
    "privacy": "We only use your email to add your points."
  }$json$::jsonb)
on conflict (key) do nothing;

-- Public: is the game on, its texts and the prize values (not the odds).
create or replace function public.bf_spin_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', coalesce((select (value #>> '{}')::boolean from bf_settings where key = 'spin_enabled'), false)
               and bf_sale_state() ->> 'state' <> 'ended',
    'prizes', coalesce((select jsonb_agg((o ->> 'points')::int order by (o ->> 'points')::int)
                        from bf_settings s, jsonb_array_elements(s.value) o where s.key = 'spin_odds'), '[]'::jsonb),
    'copy', coalesce((select value from bf_settings where key = 'spin_copy'), '{}'::jsonb))
$$;

-- Public: one spin. The prize is drawn here (weighted by spin_odds), never in
-- the browser. Same email or same browser again returns the first result.
create or replace function public.bf_spin(p_email text, p_device text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_device text := nullif(left(btrim(coalesce(p_device, '')), 64), '');
  v_prev integer;
  v_total numeric;
  v_r numeric;
  v_points integer;
begin
  if not (bf_spin_config() ->> 'enabled')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'reason', 'email');
  end if;
  select points into v_prev from bf_spins
   where email = v_email or (v_device is not null and device_id = v_device)
   order by created_at limit 1;
  if v_prev is not null then
    return jsonb_build_object('ok', true, 'already', true, 'points', v_prev);
  end if;
  select sum((o ->> 'weight')::numeric) into v_total
    from bf_settings s, jsonb_array_elements(s.value) o where s.key = 'spin_odds';
  if coalesce(v_total, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  v_r := random() * v_total;
  select points into v_points from (
    select (o ->> 'points')::int as points,
           sum((o ->> 'weight')::numeric) over (order by ord) as upto
      from bf_settings s, jsonb_array_elements(s.value) with ordinality as t(o, ord)
     where s.key = 'spin_odds') w
   where v_r < w.upto order by w.upto limit 1;
  begin
    insert into bf_spins (email, device_id, points) values (v_email, v_device, v_points);
  exception when unique_violation then
    select points into v_prev from bf_spins
     where email = v_email or (v_device is not null and device_id = v_device)
     order by created_at limit 1;
    return jsonb_build_object('ok', true, 'already', true, 'points', v_prev);
  end;
  return jsonb_build_object('ok', true, 'already', false, 'points', v_points);
end $$;

revoke all on function public.bf_spin_config() from public;
revoke all on function public.bf_spin(text, text) from public;
grant execute on function public.bf_spin_config() to anon, authenticated, service_role;
grant execute on function public.bf_spin(text, text) to anon, authenticated, service_role;
