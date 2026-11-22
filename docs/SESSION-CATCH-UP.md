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

### 22 Nov 2026: product pages like myfyxx.com

- `src/routes/product.$handle.tsx` rebuilt in the Fyxx Friday look, laid out
  like the myfyxx.com product page: brand (title before "|") and name, a line
  like "Red Wine · Spain · Rioja · 75cl" from Shopify tags (WineStyle_,
  Country_, Region_) and the size, price (crossed-out original when
  discounted), size chips, quantity stepper, Add to cart, delivery / returns /
  points promises, then the description in sections.
- `src/lib/product-description.ts` turns descriptionHtml (old pasted and new
  structured styles) into intro + sections: Tasting notes, The facts (label /
  value table), Goes with, Serving, Awards, The producer. Tests in
  `src/test/product-description.test.ts` with real descriptions; across all
  1,392 in-stock products 1,252 get sections, 115 intro only, 25 empty.
- Product query now also loads `tags`.


### 22 Nov 2026: checkout stays in the browser for Fyxx app users

- Problem: the Fyxx app (Shopney, co.shopney.fyxx) claims all myfyxx.com links
  on phones except /checkouts/*. Shopify's cart checkout link
  (www.myfyxx.com/cart/c/...) opened the app with an empty cart.
- Fix (`src/lib/checkout-handoff.functions.ts`, used by CartDrawer): on
  Checkout our server opens the /cart/c link without following it, reads the
  real /checkouts/cn/... address and Shopify's `_shopify_essential` cookie, and
  sets that cookie for Domain=myfyxx.com, Path=/checkouts, 2 hours (the longer
  path makes browsers send it before an older one). The new tab goes straight
  to /checkouts/..., which the app ignores. Only on *.myfyxx.com hosts; any
  failure falls back to the normal link. Tested with curl (fresh browser,
  returning visitor) and the fallback locally; live test after publish.
- Cleaner long term: ask Shopney to exclude /cart/c/* from the app's links.


### 21 Nov 2026: header sections (The Cellar / The Bar / The Humidor)

- Header links Home / The Cellar / About us replaced by shop sections from
  `bf_settings.nav_groups` (editable on /admin -> Sale & products): The Cellar
  (Red Wine, White Wine, Rosé & Orange), The Bar (all spirits), The Humidor
  (Cigars). Shown on desktop in the header and on phones as a second row
  (header is now 100 px tall on phones; filter bar sticks at 100 px).
- A section link goes to `/?group=<name>#shop`: only that section's products
  and category circles show, with a removable tag.
- SQL in `docs/sql/2026-11-21-bf-nav-groups.sql` (migration `bf_nav_groups`):
  `bf_visible` 7-argument form (category list), the 6-argument form now wraps
  it; `bf_group_mains`; `bf_catalog` / `bf_catalog_facets` accept `group` and
  facets return `groups`; `bf_teaser` returns `nav_groups` for the header.


### 21 Nov 2026: beer removed again

- Team decision: no beer after all. Removed the "Beer" main from
  `category_mapping` and added "Beer" and "Cider" back to
  `exclusions.product_types`; the sync removed the 59 beer and cider rows from
  `bf_products`. 13 category circles remain.


### 21 Nov 2026: choose a size before adding

- "Add to cart" on a landing page card now looks the product up in Shopify
  (`getProductByHandle`). More than one variant (244 in-stock products, e.g.
  sizes): a bottom panel (`src/components/grid/VariantPicker.tsx`) asks which
  one first; nothing is added until the shopper picks. Sold-out options are
  greyed out; discounted ones show the crossed-out price. One variant: added
  straight away as before. Product query now loads up to 30 variants.


### 21 Nov 2026: crossed-out prices always shown

- Team decision: every discounted product shows the original price crossed out
  and the new price in red, before and during the sale. `bf_card` now always
  returns `compare_at_price` (migration `bf_card_compare_always`, SQL in
  `docs/sql/2026-11-21-bf-card-compare-always.sql`); the badge fields
  (`discount_percent`, `saved_amount`) stay sale-only, so "-25%" badges,
  "up to X%" and Top deals still start with the sale.
- Product page and cart lines also show the crossed-out original price
  (from Shopify's compareAtPrice).


### 21 Nov 2026: cart shows live prices and "You save"

- `syncCart` (cartStore) now reads every cart line's current price and
  compare-at price from Shopify (`fetchCartLines` in `shopify-cart.ts`) and
  updates the local cart; it also runs right after each add. So a cart filled
  before the sale shows the sale prices on the 27th, and the teaser cart note
  ("Your cart updates automatically") is true. Checkout handoff unchanged.
- Floating cart bar and cart drawer show "You save JOD X" whenever Shopify has
  a compare-at price above the price (any phase, not only during the sale).


### 21 Nov 2026: favicon and link preview

- Favicon from the Fyxx Friday logo (cream on burgundy): `public/favicon.svg`,
  `favicon.ico` (16/32/48), `favicon-32.png`, `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`; links in `src/routes/__root.tsx`.
- Link preview (option A, burgundy + bottles): `public/brand/og-fyxx-friday.jpg`
  1200 x 630, 76 KB. Title "Fyxx Friday | 27 November", description "One day.
  The biggest deals of the year on wine, spirits and cigars. Delivered in
  Amman." Set in `src/routes/index.tsx` head(). Render script:
  `docs/og-image-render.cjs` (Playwright; served from the site address so the
  Adobe font kit loads).


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

## 2026-11-22: Only products on the Fyxx Friday sale list

Asked for: show a product only if it has a variant with `in_sale = true` in
`bf_sale_flags`; before Friday 27 Nov 10:00 Amman show the normal price and a
"Marked down on Friday" label (no sale price or %); add Accessories; a switch
in /admin to turn the filter off. The project doc
`claude/fyxx-friday-sale-list-2026-11-22.md` was not found in the repo, so the
comments on `bf_sale_list` / `bf_sale_flags` were used instead.

Database (migration `bf_sale_list_filter`, record in
`docs/sql/2026-11-22-bf-sale-list-filter.sql`):
- `bf_products.in_sale` (boolean). Set by the sync, never by the site.
- New settings: `sale_list_filter` (true = filter on) and
  `sale_label_preview` (label text).
- `bf_visible` hides rows with `in_sale = false` while the switch is on.
  `bf_card` returns `in_sale`. `bf_teaser` copy includes `sale_label_preview`.

Sync `bf-products-sync` (v6): reads `bf_sale_flags` server side with the
service role (paged), picks the variant among the in_sale ones (best in stock),
`available` means an in_sale variant is in stock. "In stock only" unchanged.
Accessories added to `category_mapping` (Wine Accessories, Bar Accessory,
Cigar Accessory). Beer and Cider still excluded.

Site: card shows the label (top left of the photo) before the sale for
in_sale items; /admin/sale has the switch and the label text.

Counts: 1033 shown before, 1028 after (57 of them Accessories). Anon cannot
read `bf_sale_flags`, `bf_sale_list` or `bf_products`.

## 2026-11-22: Blurred "-XX% off on Friday" badge

Before Friday 10:00 the sale-list card label is now a red badge: "-", a blurred
number, then "% off on Friday" (replaces "Marked down on Friday"). The blurred
number is always the stand-in "88", never the real discount, so nothing real
is in the page before 10:00. The text after the % is `sale_label_preview`
(now "off on Friday"), editable in /admin/sale; empty hides the badge.

Update: the blurred "88" read as a real number, so it is now a blurred blank
patch (no digits at all) between "-" and "%".

## 2026-11-22: Sale sizes only, accessories in the header sections

Decisions from the owner: crossed-out Shopify prices keep showing before
10:00 (real current markdowns). Sizes not on the sale list are hidden.

- Sizes: `src/lib/sale-variants.functions.ts` (`getSaleVariantIds`, server
  only, service role) returns the in-sale variant ids of one product from
  `bf_sale_flags`, or `filter: false` when `sale_list_filter` is off.
  `onlySaleVariants` trims a Shopify product to those sizes. Used by the
  product page loader and the landing-page size picker. If the check fails,
  no size can be added ("Not available right now"), never all sizes.
- Header sections can hold one type of a category: `nav_groups.mains` entry
  "Main/Sub". Wine accessories in The Cellar, Bar accessories in The Bar,
  Cigar accessories in The Humidor. Migration `bf_nav_group_subs`
  (`docs/sql/2026-11-22-bf-nav-group-subs.sql`): `bf_visible` matches
  "Main/Sub", `bf_catalog_facets` sub counts respect the section. Front end:
  `mainInGroup` in `src/lib/catalog.ts`.
- Counts: The Cellar 354, The Bar 580, The Humidor 94 (= all 1028).
  Accessories 11 / 27 / 19.
- Tested locally with Grey Goose (4 sizes in Shopify, 2 on the sale): page
  and picker show only 70cl and 100cl.

## 2026-11-22: Home link in the header

"Home" now comes before The Cellar / The Bar / The Humidor on phones and
desktop (`src/components/SiteHeader.tsx`). It goes to the top of the landing
page with no section, and is underlined when no section is picked. Phone row
spacing tightened so all four fit on a 320px screen.
