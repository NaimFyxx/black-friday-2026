# Black Friday 2026 — admin setup

The admin dashboards live at **`/admin`** (Sources, Activity, Customers, Errors).
The code is in the repo; three things have to be switched on in Lovable /
Shopify. Until they are, each page shows a yellow "not set up yet" box instead
of breaking.

## 1. Database tables (paste this prompt into Lovable)

> Please run this SQL as a new migration on the Supabase database, exactly as
> written. It adds two new tables (`bf_events`, `bf_error_log`) and three
> read-only report functions for the Black Friday 2026 admin. It does not
> change any existing table.

```sql
-- Black Friday 2026: campaign events (visits, product views, carts, checkouts)
-- with the visitor's first-touch UTM source. Written only by the site's server
-- (service role); RLS on with NO policies, so browsers can't read or write it.
create table if not exists public.bf_events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  event        text not null check (event in ('visit', 'view_item', 'add_to_cart', 'begin_checkout')),
  session_id   text not null,
  path         text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  from_app     boolean not null default false,
  value        numeric,
  currency     text,
  item_count   integer
);
create index if not exists bf_events_created_at_idx on public.bf_events (created_at);
alter table public.bf_events enable row level security;

-- Black Friday 2026: errors real visitors hit (page crashes, script errors).
create table if not exists public.bf_error_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  area       text not null,
  message    text not null,
  path       text,
  user_agent text,
  detail     jsonb
);
create index if not exists bf_error_log_created_at_idx on public.bf_error_log (created_at desc);
alter table public.bf_error_log enable row level security;

-- Sources report: one row per first-touch source, with the funnel counts.
create or replace function public.bf_source_funnel(p_since timestamptz, p_until timestamptz)
returns table (
  utm_source text, utm_medium text, utm_campaign text,
  sessions bigint, product_views bigint, cart_sessions bigint, checkout_sessions bigint
)
language sql stable security definer set search_path = public
as $$
  with per_session as (
    select e.session_id,
      (array_agg(e.utm_source   order by e.created_at))[1] as utm_source,
      (array_agg(e.utm_medium   order by e.created_at))[1] as utm_medium,
      (array_agg(e.utm_campaign order by e.created_at))[1] as utm_campaign,
      count(*) filter (where e.event = 'view_item')  as views,
      bool_or(e.event = 'add_to_cart')               as carted,
      bool_or(e.event = 'begin_checkout')            as checked_out
    from public.bf_events e
    where e.created_at >= p_since and e.created_at < p_until
    group by e.session_id
  )
  select p.utm_source, p.utm_medium, p.utm_campaign,
    count(*)::bigint,
    coalesce(sum(p.views), 0)::bigint,
    count(*) filter (where p.carted)::bigint,
    count(*) filter (where p.checked_out)::bigint
  from per_session p
  group by p.utm_source, p.utm_medium, p.utm_campaign
  order by count(*) desc;
$$;

-- Activity report: per Amman day.
create or replace function public.bf_activity_daily(p_since timestamptz, p_until timestamptz)
returns table (day date, visits bigint, product_views bigint, carts bigint, checkouts bigint)
language sql stable security definer set search_path = public
as $$
  select (e.created_at at time zone 'Asia/Amman')::date as day,
    count(distinct e.session_id) filter (where e.event = 'visit'),
    count(*)                     filter (where e.event = 'view_item'),
    count(distinct e.session_id) filter (where e.event = 'add_to_cart'),
    count(distinct e.session_id) filter (where e.event = 'begin_checkout')
  from public.bf_events e
  where e.created_at >= p_since and e.created_at < p_until
  group by 1
  order by 1;
$$;

-- Customers report: each customer's first (non-cancelled) order ever, from the
-- existing shopify_orders table, to tell new from returning customers.
create or replace function public.bf_first_order_dates(p_customer_ids text[])
returns table (shopify_customer_id text, first_order_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select o.shopify_customer_id, min(o.ordered_at)
  from public.shopify_orders o
  where o.shopify_customer_id = any(p_customer_ids) and o.cancelled_at is null
  group by o.shopify_customer_id;
$$;

-- Report functions: server only.
revoke all on function public.bf_source_funnel(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.bf_activity_daily(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.bf_first_order_dates(text[]) from public, anon, authenticated;
grant execute on function public.bf_source_funnel(timestamptz, timestamptz) to service_role;
grant execute on function public.bf_activity_daily(timestamptz, timestamptz) to service_role;
grant execute on function public.bf_first_order_dates(text[]) to service_role;
```

## 2. Admin password (Lovable → Secrets)

Add a secret named **`ADMIN_PASSWORD`**: any password, at least 8 characters.
Share it with whoever should see the dashboards. Changing it signs everyone out.

## 3. Shopify orders by source (Shopify admin + Lovable → Secrets)

This lets the Sources and Activity pages show **which sources led to real
orders and revenue**.

1. Shopify admin → **Settings → Apps and sales channels → Develop apps** →
   **Create an app** (name it e.g. "Black Friday admin").
2. **Configure Admin API scopes** → tick **`read_orders`** → Save.
3. **Install app** → reveal the **Admin API access token** (starts `shpat_`)
   and copy it (Shopify only shows it once).
4. In Lovable → Secrets, add **`SHOPIFY_ADMIN_TOKEN`** with that token.

## How the source tracking works

- Share links with UTM tags, e.g.
  `https://<site>/?utm_source=instagram&utm_medium=story&utm_campaign=bf26`.
  Links from the FYXX app with `?from=app` show up as source `fyxx_app`.
- The first source a visitor arrives with is remembered on their device
  (first-touch) and attached to every visit / cart / checkout event and to the
  Shopify cart as hidden attributes (`_bf_session`, `_utm_source`, …), which
  Shopify copies onto the order.
- Everything is also sent to Google Analytics (tagged
  `campaign_name = black_friday_2026`), Meta Pixel, Klaviyo and Microsoft
  Clarity — the same accounts as the Christmas, Valentine's and Fyxx Cup sites.

Campaign dates for the reports are in `src/lib/campaign-config.ts`
(20 Nov – 30 Nov 2026 by default).
