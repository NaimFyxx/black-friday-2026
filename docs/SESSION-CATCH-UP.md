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

### 21 Nov 2026: Klaviyo popups off on this site

- Klaviyo signup forms (the "Fyxx Friday is Almost Here" popup and the
  "Early Access" teaser) are hidden on friday.myfyxx.com by a CSS rule at the
  end of `src/styles.css`; `src/hooks/useKlaviyoFormsOff.ts` (used in
  `__root.tsx`) undoes any scroll lock a hidden Klaviyo popup sets. Spin & win
  is the only popup. Klaviyo tracking is untouched.
- Cleaner long term: in Klaviyo, exclude friday.myfyxx.com in the forms'
  targeting (then these two pieces can go).


### 21 Nov 2026 (later): Spin & win is now a real slot machine, no email

- `src/components/spin/SpinWidget.tsx` rebuilt: cabinet with blinking bulbs,
  three reels (wine 5, beer 10, cocktail 15, star 20, seven 25), a lever and
  a Spin button. Reels stop one by one on three matching symbols, then the
  points show. No email field; the "one spin per person / 5 to 25" line is
  gone. Sticker is a mini slot machine (7 7 7).
- The prize is now drawn IN THE BROWSER (ODDS constant in SpinWidget, same
  40/30/15/10/5 as `spin_odds`) and remembered in that browser only. Nothing
  is written to `bf_spins`, so nobody can be credited yet. Naim owns the
  Supabase side and will decide how points reach customers.
- `spin_copy.win_note` in bf_settings still says "We will add the points to
  your Fyxx account": needs new wording (in /admin/spins) once the crediting
  plan is known.


### 21 Nov 2026: Spin & win (Fyxx points slot machine)

Design (front end):
- `src/components/spin/SpinWidget.tsx`: "Spin & win" sticker bottom left of the
  landing page (moves up when the floating cart bar shows) and a slot machine
  popup that opens by itself on the first visit (2.5 s). Customer enters their
  email, the reel spins and lands on +5, +10, +15, +20 or +25.
- `src/lib/spin.ts`: data calls and per-browser memory.
- `/admin/spins` ("Spin & win" tab): winners list, total points, CSV download
  for LoyaltyLion, on/off switch, chances per prize, all texts.

Backend (created 21 Nov, SQL in `docs/sql/2026-11-21-bf-spins.sql`; the
team asked that Naim owns the Supabase side from here):
- Table `bf_spins` (one row per email and per browser), RLS on.
- `bf_settings`: `spin_enabled`, `spin_odds` (5:40, 10:30, 15:15, 20:10,
  25:5), `spin_copy`.
- Public functions `bf_spin_config()` and `bf_spin(email, device)` (prize drawn
  in the database).
- Points are NOT credited automatically: credit them in LoyaltyLion.
- TODO for Naim: delete the test row `spin-test-ui@example.com` from
  `bf_spins` (cleanup was declined mid-session).


### 21 Nov 2026: category circles and Shopify sub categories

- `category_mapping` now has 14 categories, shown as photo circles (page row
  above the filter bar, and a grid in the Filter & sort panel): Cigars, Red
  Wine, White Wine, Rosé & Orange, Beer, Whisky, Vodka, Tequila & Mezcal, Sake,
  Arak, Gin, Rum, Cognac & Brandy, Liqueurs & Bitters. Dukkan is not used.
- Beer and Cider are now INCLUDED (Naim's decision, 21 Nov); removed from
  `exclusions.product_types`.
- Sub categories come from Shopify collections where they exist (e.g.
  champagne, prosecco, sparkling-wine, single-malt-whisky, blanco-tequila,
  nicaraguan-cigars, french-wines). Mapping options: `require_tags`,
  `handles`, `catch_all_types`, sub `collections`, `image_handle`.
- `bf-products-sync` reads collection membership; a dry run accepts a
  `mapping` / `exclusions` to try without saving and reports in-stock products
  left without a category.
- `bf_catalog_facets` returns `image` per main (`bf_main_image`), SQL in
  `docs/sql/2026-11-21-bf-category-images.sql`.
- Checked: every in-stock drink lands in a category; left out are only the
  excluded groups (Cuban cigars, food, tobacco, mixers, bundles, accessories).


### 21 Nov 2026: simpler filters

- Filter bar is now: category tabs (All / Wine / Spirits / Cigars, "up to X%"
  under each during the sale), one "Filter & sort" button, product count, and
  removable tags for the filters in use. The button opens a bottom panel with
  Category, Type, Price, Discount (sale only) and Sort; choices apply on
  "Show N products". (`src/components/grid/FilterBar.tsx`)
- New discount filter "X% off or more" (URL `disc`), steps in
  `bf_settings.discount_filters` ([10, 20, 30]), editable on /admin.
- SQL in `docs/sql/2026-11-21-bf-discount-filter.sql` (migration
  `bf_discount_filter`): `bf_visible` gained a `p_disc` argument (old 5-arg
  version dropped); `bf_catalog` reads `disc`; `bf_catalog_facets` adds `total`
  and `discounts`.
- Tested the sale state by moving `sale_start` to 1 Nov, then put it back to
  27 Nov 10:00 Amman.


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
