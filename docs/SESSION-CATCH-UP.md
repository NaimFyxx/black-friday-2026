# Catch up before you touch anything

This site (repo `NaimFyxx/black-friday-2026`, live at `friday.myfyxx.com`)
shares one Supabase project, `gpnglfdusrymnookeclg`, with Pulse (three Claude
Code sessions) and Lovable. One database, one `public` schema. Lovable and
Lori (ChatGPT) also push to `main`. Whatever you last knew is probably out of
date.

**The database is the record, not git.** Migrations applied through the
Supabase MCP do not write a file into `supabase/migrations/`, and this repo's
`AGENTS.md` reserves that folder for Lovable. So every SQL change made from a
Claude session is copied into `docs/sql/` (dated file names).

## Do these in order

1. **`git pull`** (we work directly on `main`; commit small and push often),
   then read this file to the end, including the log below.
2. **List the migrations** (`list_migrations`). Everything after the last one
   you recognise was done by someone else. Skim them all.
3. **For every table you will read or write, check the live shape** from
   `information_schema.columns` (columns, nullability, primary key, RLS), not
   from `types.ts` or memory.
4. **Say what changed and what you intend to touch**, then wait for a go.

## Who owns what

| Prefix | Owner |
|---|---|
| `bf_*` tables and functions, edge functions `bf-admin` and `bf-products-sync`, cron job `bf-products-sync` | this site |
| `inv_*`, `mkt_*`, `klaviyo_*`, `shopify_*`, `pos_*`, `odoo_*`, `ll_*`, `btg_*` and everything else | Pulse, read only for us |

Never change another system's tables, functions, cron jobs or owner-only
checks. Never change prices: they come from Shopify (`drynksapp.myshopify.com`)
and Pulse sets them.

## House rules for this site

- No em dashes anywhere, including UI copy. Plain language.
- Prices as `JOD 12.500` (`formatJod` / `formatPrice` in `src/lib/shopify.ts`).
- Every number and switch lives in `bf_settings` and is editable on `/admin`.
- No links to Shopify collections (they break in the Fyxx app webview).
- Mobile first. Colours and fonts only from `src/tokens.css`.
- Don't prettier-reformat Lori's files (`src/routes/index.tsx`,
  `src/components/ProductCard.tsx`): keep diffs minimal.
- Don't change the checkout handoff (`CartDrawer` `handleCheckout`) or the
  `bf_events` tracking without being asked.

## Traps

- Supabase reads return at most 1000 rows by default. Page with `.range()`.
- `bf_settings.updated_at` has a default but no trigger: set it on upsert.
- Lovable can't see Supabase secrets; edge functions can. The site talks to
  them with `bf_settings.edge_key`.
- The Klaviyo signup popup ("Fyxx Friday is almost here") is configured in
  Klaviyo, not in this code.

## Before you finish

- Copy any SQL you applied into `docs/sql/`.
- Commit edge function source (Lovable redeploys from the repo).
- Append what you changed to the log below, newest first.

---

## Log

### 21 Nov 2026: teaser hero and cart note

Later the same day: `sale_start` moved to **27 Nov 10:00 Amman**
(`2026-11-27T10:00:00+03:00`), subline now "One day only", cart note now says
10:00, and the countdown shows seconds ("5d 03h 12m 08s"). `sale_end` is still
1 Dec 00:00 and needs confirming.

Database (SQL in `docs/sql/2026-11-21-bf-teaser.sql`, migration
`bf_teaser_copy`):
- New `bf_settings` keys: `teaser_headline`, `teaser_subline`,
  `teaser_countdown_label`, `teaser_button`, `teaser_cart_note`.
- New public function `bf_teaser()`: the sale state plus those five texts only.

Site:
- `src/components/hero/TeaserHero.tsx`: big burgundy hero shown only before
  `sale_start` (cream logo SVG, campaign bottles, headline, subline, countdown
  "Prices drop in 5d 03h 12m", button that smooth-scrolls to the filter bar).
  It replaces the small logo and bottles banner in that phase; sale and ended
  states are unchanged. When the countdown hits zero the page refetches and
  switches to the sale state by itself.
- New smaller bottle images `public/brand/fyxx-friday-bottles-360.webp` and
  `-600.webp` (29 KB and 52 KB) for phones.
- Cart drawer shows `teaser_cart_note` before the sale only.
- `/admin/sale` edits the five texts (dashes like – and — are refused).
- `src/lib/teaser.ts`: data and countdown format.

Cart: tested add, close browser, reopen (desktop and 360x640): cart kept
(localStorage `shopify-cart` + Shopify cart id). Shopify keeps a cart 30 days
after its last change. Open point: the drawer shows the price saved when the
item was added; it does not refresh prices from Shopify (checkout does).

### 19 Nov 2026: catalog, filters, sorting and discount badges

Database (SQL in `docs/sql/2026-11-19-bf-products.sql`, migration
`bf_products_catalog`):
- New table `bf_products` (one row per eligible Shopify product, the variant
  the card shows, price and compare-at from Shopify, `discount_percent`
  rounded down, `saved_amount`). RLS on, service role only.
- New `bf_settings` keys: `sale_start`, `sale_end` (Amman time, +03:00),
  `badge_amount_threshold` (100), `upto_min_products` (10), `top_deals_count`
  (12), `batch_size` (24), `price_bands` ([20, 50, 100]), `category_mapping`,
  `exclusions`, and `products_last_refresh` (written by the sync).
- Functions: `bf_sale_state()`, `bf_catalog(p)`, `bf_catalog_facets(p)`
  (granted to anon: public catalog data only), internal `bf_visible`,
  `bf_card`, `bf_upto`.

Edge function `bf-products-sync` (source in `supabase/functions/`): reads the
Storefront API, applies mapping and exclusions, upserts `bf_products`, removes
stale rows, refuses to run if the result is under half of last time. Cron job
`bf-products-sync` runs it every 15 minutes.

Site:
- `src/tokens.css`: palette and font roles (`.ff-headline`, `.ff-subline`,
  `.ff-small`, `.ff-num`), imported by `src/styles.css`.
- Homepage catalog now reads `bf_products` (`src/lib/catalog.ts`,
  `src/components/grid/`): sticky chips (All / Wine / Spirits / Cigars, then
  sub categories, then price bands) with counts and "up to X%" during the sale,
  sort menu, search on title and brand together with the filters, batches of
  24 on scroll, Top deals strip, badges, crossed-out compare-at, "Up to X% off"
  headline, ended-state message, floating cart bar with "You saved", back to
  top. Filters live in the URL; "Back to the catalog" goes back in history so
  filters and scroll come back.
- Cart lines now remember `compareAtPrice` (for "You saved"). Cart drawer
  open state is shared (`src/stores/cartUiStore.ts`). Checkout unchanged.
- `/admin/sale` ("Sale & products"): edit every setting above, Refresh products
  now, counts and "up to" per category.
- Prices show as `JOD 12.500`; em dashes removed from page titles.

Tested: sale state by setting `sale_start` to 1 Nov and ended state by setting
`sale_end` to 2 Nov; both put back to 27 Nov 00:00 and 1 Dec 00:00 Amman.

Not used any more but left in place: `src/components/ProductCard.tsx`,
`CATEGORY_COLLECTIONS` / `catalogSource` in `src/lib/shopify.ts`.
