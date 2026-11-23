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

## 2026-11-22: Website QA fixes before Fyxx Friday

- `sale_end` set to 2026-11-28T00:00:00+03:00 (bf_settings). bf_sale_state
  now gives sale 27 Nov 10:00 to 28 Nov 00:00 Amman. The sale-list filter does
  not read sale_end. `CAMPAIGN_END` in campaign-config.ts (the report window,
  build-up week through 1 Dec) is not the sale end and was left as is.
- UTMs (`src/lib/utm-attribution.ts`): "fyxx:utm" is now LAST touch,
  overwritten on every page load with utm_* or fbclid in the URL; stores
  utm_source/medium/campaign/content/term + fbclid. New "fyxx:utm_first" keeps
  first touch (old "fyxx:utm" values are copied into it once). bf_events and the
  GA campaign_view keep using first touch, same fields as before (no fbclid).
  Cart attributes now include `_utm_term` and `_fbclid`; right before checkout
  `refreshCartAttributes` (cartAttributesUpdate) puts the latest values on the
  cart, and the checkout link carries all six as URL params.
  Tested end to end (see below).
- `teaser_button` = "Fill your cart".
- Ticker: FYXX FRIDAY | FRI 27 NOV | FROM 10:00 | UP TO 50% OFF. Meta / OG /
  Twitter descriptions and hidden headings: no "Black Friday", no best/biggest.
- Item 5 (hide "Earns Fyxx Points" for sale items) dropped by the owner: kept.
- Cart: no "Default Title" line for single-option products.
- Product page: "About this product" for cigars and accessories.
- Phones: hero bottles no longer overlap "Friday"; the floating cart bar
  hides while the hero "Fill your cart" button is on screen.
- Product photo: CDN sizes 400 to 1200 with srcset/sizes, preload link in the
  head, eager load; cards preload the product page (and photo) on touch/hover.
- Cart drawer: list padded away from the scrollbar, bigger remove button.

UTM test (local, real Shopify cart): visit 1 qa/test/fyxx-friday-2026-11-27/
qa-ad/TEST1 reached the checkout URL and the cart attributes; visit 2 with
meta/paid/second-touch/ad-2/whisky/TEST2 replaced all of them on the same cart.
First touch stayed on the old record; bf_events payloads carried first touch.

## 2026-11-22: Conversion pack, phase 0: hidden preview switch

`?preview=friday` shows the sale version, `?preview=ended` the after-sale
page, `?preview=off` goes back. Display only.
- DB (migration `bf_preview_state`, `docs/sql/2026-11-22-bf-preview.sql`):
  `bf_sale_state(p_preview text)` (service only) overrides the state;
  `bf_catalog` / `bf_catalog_facets` read `p.preview`; new `bf_teaser(p jsonb)`
  (old no-argument one kept). Nothing is written; prices stay Shopify's.
- Site: `src/lib/preview.ts` reads the URL param (server and browser), keeps it
  in a session cookie `bf_preview` so product pages and header links follow,
  `usePreview()` from the root route context. Query keys include it.
  Preview pages get `robots: noindex, nofollow` and a black strip with
  "Exit preview". Not linked anywhere else.
- Note: in the sale state the shop lists only products with a Shopify
  compare-at above the price, so the Friday preview shows only the products
  marked down in Shopify right now (29 on 22 Nov).

## 2026-11-22: Preview part 2 (admin price simulation, safety net)

- Tracking data cleared on request: `bf_events` and `bf_error_log` emptied
  (568 and 18 test rows). `bf_spins` test row left for Naim.
- A. Admin price simulation: admin (bf_admin session) + `?preview=friday`
  shows the planned Friday prices from `bf_sale_list` (sale_price as price,
  price_now crossed out) for every in_sale product: grid, filters, sorting,
  badges, top deals, "up to", product pages. DB: `bf_catalog_sim`,
  `bf_catalog_facets_sim`, `bf_sim_variant_prices` (service role only).
  `bf_visible` uses the planned prices only when the transaction variable
  `bf.sim` equals the secret `bf_settings.sim_token` (set only by the sim
  functions; setting bf.sim by hand does nothing). Cost is never read.
  Site: `src/lib/preview-sim.functions.ts` (admin check, then service-role
  RPC; results as JSON text), root `beforeLoad` adds `sim` to the context
  (one admin check per page load), query keys include it. Non-admins get the
  public preview (Shopify prices). The cart still uses live Shopify prices.
- B. Already in place: in the sale state `bf_visible` lists only in_sale
  products (switch `sale_list_filter` on) whose Shopify compare-at is above the
  price. Other Shopify markdowns don't show.
- C. Safety net: `bf_sale_state(p_preview)` returns state "preview" with
  `updating: true` when it is sale time but fewer than
  `bf_settings.sale_min_marked` (500) sale products have a crossed-out price.
  The hero shows `teaser_updating_note` instead of the countdown, the teaser
  re-checks every minute and the shop reloads when prices are ready.
  `?preview=updating` shows it. Text and number editable (note on /admin/sale,
  sale_min_marked in bf_settings).

## 2026-11-22: Conversion pack, phase 1

- Meta, og and twitter descriptions: "Fyxx Friday. One day only, Friday 27
  November from 10:00. Up to 50% off. Wine, spirits, cigars and accessories
  marked down, delivered in Amman."
- Checkout opens in the same tab (UTMs + fbclid still on the link, cart
  attributes refreshed first, app handoff kept). The button shows a spinner
  until the browser leaves; the new-tab icon is gone.
- Cart drawer: product names wrap to 2 lines instead of "Olmeca ...".

## 2026-11-22: 50% headline, quick links, conversion pack phase 2

- `upto_min_products` = 1, so "Up to X% off" = the highest discount (50%,
  13 wine accessory variants; checked with the admin simulation).
- Quick links (`bf_settings.quick_links`, shown during the sale above the
  grid, `src/components/grid/QuickLinks.tsx`): Wine, Spirits, Cigars,
  Accessories, Under 20 JOD, "Up to 50% off: wine accessories" (sale only).
  A link with "mains" works like a header section (`bf_group_mains` also
  looks in quick_links), "band" is a price band. Editable on /admin/sale.
- Klaviyo list "Fyxx Friday 2026 - Cart reminder" created: id **Wwe9ax**,
  single opt-in. Stored in `bf_settings.reminder` with all form texts.
- Reminder form (`src/components/reminder/ReminderForm.tsx`,
  `src/lib/reminder.ts`): in the cart drawer before the sale ("Send me my cart
  at 10:00 on Friday") and as "Remind me at 10:00" under the hero countdown.
  On submit: klaviyo identify (email) -> the current cart re-sent as
  "Added to Cart" -> client subscription API (company XuTPpc, revision
  2024-10-15, marketing consent SUBSCRIBED) to list Wwe9ax -> thank-you;
  localStorage "fyxx:reminder" so it isn't shown again.
- Klaviyo event on every add to cart: **"Added to Cart"** (src/lib/analytics.ts,
  with Items, ItemNames, $value, CheckoutURL, AddedItem* fields).
- "Add to calendar" next to it: Google Calendar link and an .ics (data URL),
  from sale_start to sale_end minus 1 minute, title "Fyxx Friday", link
  tagged utm_source=calendar&utm_medium=reminder&utm_campaign=fyxx-friday-2026-11-27.
- `bf_settings.no_code_note` "Prices drop automatically. No code needed." in
  the cart note and under the price on product pages (not after the sale).
- Tested with Klaviyo mocked (no real profile created).

## 2026-11-22: Klaviyo 10:00 cart email (template) and phase 3 (Friday version)

Klaviyo: template **TtqUgk** "Fyxx Friday 2026 - Cart reminder 10:00 (flow)"
(CODE). Shows {{ event.Items }} (name, size, qty, photo; no prices: they are
from before the sale), "Your cart from this week", button "Fill your cart" to
event.CheckoutURL + utm_source=klaviyo&utm_medium=email&utm_campaign=
fyxx-friday-2026-11-27&utm_content=fri-27-cart-reminder, or to
friday.myfyxx.com when there is no cart. The flow itself must be built in the
Klaviyo UI (no API tool for flows here). Account timezone Asia/Amman.

Phase 3 (switches on at sale_start; see with ?preview=friday, admins see the
planned prices):
- Prices: thousands separators (formatJod, "JOD 1,715.000"). Cards and
  product pages: price in red, compare-at crossed out, real "-X%" badge
  (discountBadge is always -X% now). Cart and floating bar: "You're saving
  JOD X.XXX". After the sale: no crossed-out prices, badges or savings.
- Category circles say "Marked down" (only the headline says "Up to X% off").
- Sort label "Biggest markdown first" (default during the sale).
- Top deals mix (bf_catalog_facets): half biggest JOD saving, half biggest %
  under bf_settings.top_deals_cheap_under (50), max 2 per category, alternating.
- Stock: bf-products-sync (v9, auto-deployed by Lovable) reads units left per
  card variant from the Shopify Admin API (read only, Pulse's app like
  bf-admin) into bf_products.stock. "Only X left" during the sale when
  1..bf_settings.low_stock_max (5). 493 of 1,026 sale products have 5 or
  fewer today.
- Sold out during the sale: bf_products.last_in_stock_at (trigger) + 8-arg
  bf_visible; bf_catalog lists sale products seen in stock in the last 24 h at
  the end with "Sold out" and no add button (901 long-out-of-stock sale-list
  products are not shown). Filters, counts, top deals, "up to" stay in-stock.
- Product pages: -X% badge on the photo; "Goes well with" (bf_settings.
  goes_well_with: wine and spirits -> up to 4 in-stock Wine accessories from
  the sale, as specified); phone sticky Add to cart bar once the main button
  scrolls away (scroll check, not IntersectionObserver).
- "Ends at midnight" + countdown to sale_end under the headline
  (bf_settings.sale_end_label).
- After sale_end: "Fyxx Friday is over. Thank you!" + "Shop at myfyxx.com"
  (bf_settings.ended_copy).
- bf_teaser returns low_stock_max, ended, goes_well_with, copy.sale_end_label.
- AGENTS.md: checkout opens in the same tab (owner's decision).

## 2026-11-22: Phase 3 changes, cart restore link, admin preview fix, phase 4

- low_stock_max = 3. goes_well_with: wine -> Wine accessories, spirits ->
  Bar accessories.
- Cart restore link for the 10:00 email: `friday.myfyxx.com/?cart=<CartID>`
  (`src/lib/cart-restore.ts`, `src/lib/cart-token.ts`). Loads that Shopify cart
  (Storefront API) into this browser and opens the cart drawer; unknown or
  empty carts are ignored; once per tab (sessionStorage); UTMs captured as
  usual; the address bar is not changed (that broke hydration).
  Klaviyo "Added to Cart" now has **CartID** (URL-safe token). Template
  **TtqUgk** button: https://friday.myfyxx.com/?cart={{ event.CartID }}&utm_source=
  klaviyo&utm_medium=email&utm_campaign=fyxx-friday-2026-11-27&utm_content=
  fri-27-cart-reminder (plain site link with the same UTMs when no cart).
- **Note for the email session (owner's decision, 22 Nov):** people on the
  reminder list Wwe9ax ("Fyxx Friday 2026 - Cart reminder") SKIP both Friday
  launch emails (09:00 and 10:00). They still get the 17:00 resend and pushes.
  Flow for the 10:00 cart email: trigger "Added to Cart" (API metric S3AtNP);
  filters: in list Wwe9ax, and Added to Cart zero times since starting this
  flow; delay until 10:00 Friday (account timezone Asia/Amman); template
  TtqUgk; Klaviyo UTM tracking off; Smart Sending off; go live now; switch off
  Saturday. List members with no cart event: a 10:00 campaign with the same
  template (shows the no-cart version).
- Admin preview bug (shop showed 29 Shopify markdowns, "Up to 29%"): the admin
  facets call took 7.4 s and hit the 8 s API timeout after phase 3 added
  more passes (Top deals). Fixed with a primary-key lookup in bf_visible
  (0.24 s, migration bf_sim_lookup_indexed). Admin calls now retry once
  before falling back.
- Sticky Add to cart bar: scroll check (live site verified at 390 px).
- Phase 4 (tracking): checkout click sends GA4 begin_checkout (currency JOD,
  value, items) and Meta InitiateCheckout (value, currency JOD, content_ids,
  num_items). Same-tab checkout now waits for GA4 to send begin_checkout
  (beacon, event_callback, max ~1.2 s) before leaving. GA4 add_to_cart and
  Meta AddToCart unchanged.

## 2026-11-22: GA4 parameters

- No GA4 event sends campaign_name any more (it could override the real UTM
  campaign in GA4 reports). The label is `promo_name: "fyxx-friday-2026-11-27"`
  (gtag set + every event: campaign_view, view_item, add_to_cart,
  begin_checkout, js_error, came_from_app, scroll_depth). `GA_PROMO_NAME` in
  src/lib/analytics.ts. Klaviyo events and the Clarity tag keep their own
  campaign label (not GA4).
- GA4 item_id is the plain variant number (e.g. 43189192786167), like Meta and
  Shopify's own GA4 data.

## 2026-11-22: Final QA round + "Most added to cart"

Migration bf_final_qa (`docs/sql/2026-11-22-bf-final-qa.sql`):
- Default sale sort rotates category groups (bf_settings.discount_sort_groups:
  Wine, Spirits, Cigars, Accessories; `bf_sort_group`), each in biggest-%
  order with lower price first at the same %. Sold out still last. Other
  sorts unchanged. Admin preview still ~0.3 s.
- Ticker texts per state: ticker_preview / ticker_sale / ticker_ended
  ("|"-separated; empty hides the bar). Cart bar hidden after the sale.
- Cart note during the sale: sale_cart_note "Fyxx Friday prices are live
  until midnight. No code needed." (before the sale unchanged).
- Hero pop-up title: reminder.title_empty "Remind me at 10:00 on Friday" when
  the cart is empty, reminder.title otherwise.
- All editable on /admin/sale (ticker fields, cart note during the sale,
  reminder JSON title_empty).
- /admin (Sources page): "Most added to cart" table from bf_events
  (event add_to_cart): product, adds, people (distinct session_id), value,
  top first-touch utm_source; Today (Amman) / Since launch (CAMPAIGN_START).
  `bf_top_added(p_since, p_until)` (service role only), `getTopAdded`.
  Excludes bf_settings.test_utm_sources (claude-qa, test).

## 2026-11-22: Hydration (#418) hardening, Outlook scanner errors

- 10 x React #418 on "/" (16:30 to 17:03 UTC, from 2 phones: one iPhone,
  one Android, repeated within minutes). Not reproducible here: production
  builds of the old and new code, iPhone/Android, Amman time zone, Arabic
  locale, empty/full cart, reminder signed up or not, ?preview=friday and the
  admin preview (faked admin) all hydrate without errors.
- Hardening anyway: `src/hooks/useMounted.ts`. Drawn only after the page has
  loaded, with same-size placeholders (0 px shift measured): hero countdown,
  "Ends at midnight" countdown, "Remind me / Add to calendar" row, preview
  strip. Cart badge and cart bar already were.
- Every client error now stores a context in bf_error_log.detail.context:
  preview cookie, cart item count, reminder signed up, page translated by the
  browser (html class/lang), time zone, query string. Next #418 will say why.
- "Object Not Found Matching Id:*, MethodName:update" (Microsoft Outlook /
  Defender link scanners) is never logged (browser and server both drop it),
  the /admin/errors page filters it, and the 49 existing rows were deleted.

## 2026-11-22: Referrer for untagged visits, internal visits excluded

Migration bf_events_referrer_internal (`docs/sql/2026-11-22-bf-events-referrer-internal.sql`):
- bf_events.referrer: first-touch referring site (hostname, or "direct"),
  kept in localStorage "fyxx:ref_first" (captureReferrer in
  utm-attribution.ts), stored only when there is no utm_source.
- bf_events.internal: set on the server in recordEvent when the browser has
  the bf_preview cookie or an /admin session. Stored but excluded from
  bf_source_funnel, bf_activity_daily, bf_top_added and the AI report.
- Sources: untagged sessions show the referrer in the Medium column
  ("(none)" for visits before this change). Note on /admin explains it.
- Team phones not signed in to /admin and without a preview link still
  count: sign in to /admin once on each (session lasts 400 days).
- Orders follow the same rule: untagged carts get a hidden `_bf_referrer`
  attribute (CART_ATTR.referrer), and bf-admin uses it as the order's medium
  when there is no _utm_source, so untagged orders land on the same Sources
  row as their visits. Orders placed before this change stay on "(none)".

## 2026-11-22: What goes out (clicks to myfyxx.com / the app, website orders)

- `src/lib/outbound.ts`: one page-wide click listener. Links to myfyxx.com
  (not /checkouts or /cart) or the app (onelink.to, App Store, Google Play)
  get utm_source=fyxx-friday-site&utm_medium=referral&utm_campaign=
  fyxx-friday-2026-11-27&utm_content=<link text> and are logged: bf_events
  event "outbound" (destination website|app, link text in product_title) and
  GA4 outbound_click. Migration bf_events_outbound (`docs/sql/2026-11-22-bf-outbound.sql`).
- Cookie `fyxx_friday` on .myfyxx.com (30 days, not for preview browsers):
  session id, first-touch source/medium (or referrer), campaign, first/last visit.
- myfyxx.com theme snippet (`docs/shopify-theme-fyxx-friday.md`, NOT installed
  by us) copies it onto the website cart as _bf_visit, _bf_visit_source,
  _bf_visit_medium, _bf_visit_campaign, _bf_visit_first.
- bf-admin "orders" now also returns `afterVisit` (orders with _bf_visit and
  no _bf_session); existing Friday-site order numbers unchanged.
- /admin Sources page: "After the Friday site" section (clicks to website /
  app by link, website orders after a visit and revenue by first source),
  `getLeaving`, `bf_outbound`. App orders can't be linked (no shared browser).

- Update (same day): outbound links are NOT given UTM tags any more. Both
  sites send to the same GA4 property (G-N6PW62SXRQ) and Meta pixel
  (1207780626389959) with the same visitor cookies (_ga, _fbp on
  .myfyxx.com, checked live), so GA4 and Meta already follow a visitor from
  friday.myfyxx.com to a purchase on myfyxx.com; tags would have replaced the
  real source (e.g. an Instagram ad) with "fyxx-friday-site". Clicks are
  still logged and the fyxx_friday cookie is still written.

## 2026-11-22 late: Klaviyo bugs
- Reminder sign-up: the client subscriptions call now sends `revision: 2025-01-15` (KLAVIYO_REVISION in campaign-config.ts). Without it Klaviyo returns 400. This is the only direct Klaviyo API call the site makes. Events and identify go through klaviyo.js, which sets its own revision.
- Klaviyo only accepts client calls from the myfyxx.com origins (localhost gets 403), so real tests must run on friday.myfyxx.com.
- klaviyo.js: the loader has not changed since 11 Nov. It loads on every page after the first tap or after 3 seconds, so a check made in the first 3 seconds shows window.klaviyo undefined. Live test 20:36 UTC: identify 202, 2 Added to Cart (S3AtNP) events with CartID landed on the profile.

## 2026-11-22 late: ?cart= link merges instead of replacing
- Before: opening the email cart link swapped this browser's cart for the email cart, so items already in this browser disappeared.
- Now (src/lib/cart-restore.ts):
  - This browser has no cart, an empty cart, or the same cart ID: the email cart is used, as before.
  - This browser has a different cart with items: it is kept, and the email cart's lines are added to it with cartLinesAdd.
  - A variant already in this browser's cart keeps the higher of the two quantities, not the sum.
  - The drawer still opens, it still runs once per link per tab, and UTMs are still written to the cart at checkout.
- Tested locally against real Shopify carts: same device (no change), second browser with its own items (all items in one cart, cart ID kept, Olmeca 1 vs 3 became 3), fresh browser (takes the email cart). Live test pending Publish.

## 2026-11-22 late: cart value on /admin
- "Most added to cart" now has four tiles above the table: Cart value (full price), Add to carts, People, Average per person. The table's Value column is now "Full value".
- Full value = quantity x the regular price from bf_products (the higher of price and compare-at), so it stays at full price after Pulse sets the sale prices. Removals are not subtracted. SQL: docs/sql/2026-11-22-bf-cart-value.sql.
- Next (later conversation): full value vs discounted value vs margin once prices are set. Cost stays server-side.
- Live retests after Publish passed: reminder form shows "Done" (subscriptions 202), cart link merge (same device unchanged, second browser keeps its cart and gets all lines, higher quantity wins, runs once per tab).

## 2026-11-22 late: theme snippet live on myfyxx.com
- Shipped by the theme session (Fyxx-Store-Website, layout/theme.liquid). It is a sturdier version of docs/shopify-theme-fyxx-friday.md: the Tabarnapp app wipes cart attributes on every page load, so the block re-applies the five _bf_visit* attributes after load, after cart changes and right before checkout.
- Tested live: Friday visitor's cart keeps all five attributes through a /cart reload; fresh visitors get none; Tabarnapp, the drawer and checkout still work.
- The attribute names match what bf-admin's orders action reads (_bf_visit, _bf_visit_source/_medium/_campaign/_first), so "After the Friday site" on /admin will fill as orders come in.
- Remove the block from the theme after 1 December 2026. The unpublished test theme "Fyxx Friday tracking TEST" can be deleted in Shopify admin.

## 2026-11-22 late: /admin easy to read for the whole team
Display only: nothing tracked, calculated, priced or tagged changed (utm_campaign values untouched). No database changes.
- `src/lib/source-labels.ts`: one mapping from tracking values to plain names with a Paid / Free / Unknown tag (ig + paid-social = Instagram ads, Paid; klaviyo + email = Email (Klaviyo), Free; fyxx-app + app-banner = Fyxx app banner; instagram + story / social = our own page; no source = "Direct or unknown", or "From <site>" when the referring site is known). Unknown values show as they are, e.g. "snippet_test (qa)". Also `describeSourceText` for the report's "source / medium / campaign" strings and Google Analytics "source / medium", `describeCampaign` (anything with fyxx-friday reads "Fyxx Friday"), `describeChannel` (Mobile App = Fyxx app, POS = Shops (POS)...). Tests: `src/test/source-labels.test.ts`. Add new tags there.
- `AdminUi.tsx`: `Section` (title + one grey line), `Note`, `Toggle`, `KindTag`, `SourceName` (name, tag, raw tag in grey), shared table styles `TH/THR/TD/TDR/TR`, `fmtNum`; money is now "JOD 1,482" (en-US separators); ranges read "Nov 20 to Nov 30"; range picker says "Whole campaign".
- Tabs: Overview (was Sources), Day by day (Activity), All Fyxx sales (Customers), Report, Sale & products, Spin & win, Tracking, Errors.
- Overview: five main numbers first (visits, added to cart, went to checkout, cart value at full price since launch, orders on myfyxx.com = this site's checkout + later website orders, with the split), then Paid ads or free, Where visitors came from (cards on phones, table on desktop), Most added to cart, After visiting this site.
- Words used everywhere: Visits, Added to cart, Went to checkout, Orders, Sales (not revenue), New customers.
- Note: `session_id` lives in sessionStorage, so it is one browser TAB SESSION, not one person. The old "People" column (Most added to cart, clicks out) counts visits, so it is now labelled "Visits". A real visitor count would need a per-browser id (bf_events change, not done).
- Checked locally at 390 px and 1366 px on every admin page with sample data served from Playwright (local has no service-role key, so the admin server functions can't run; the browser test fakes their answers, no app code involved).

## 2026-11-22 late: tracking only on the real site, Viewed Product, sales forecast
- Tracking (Meta, GA4, Klaviyo onsite, Clarity, bf_events) runs only on hosts in bf_settings.tracking_hosts (["friday.myfyxx.com"]). Lovable previews, the Lovable editor and localhost get the no-op stubs; recordEvent also drops events whose Origin isn't a tracked host. Locally: run with __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=friday.myfyxx.com and map the host to test tracking.
- Klaviyo "Viewed Product" (+ trackViewedItem) on product pages, Shopify format, only when klaviyo.isIdentified() is true.
- /admin "Sales forecast" box above Most added to cart (src/lib/forecast.ts, getSalesForecast):
  - before sale_start: "Online, estimate from carts" (bf_cart_forecast) with 20/35/50% lines (forecast_buy_rates) and last year (forecast_last_year);
  - from sale_start: "So far today" (bf-admin day_sales: all Shopify orders, cancelled/test left out, online vs Point of Sale) refreshing every 5 min, and "At this pace by midnight" = so far / last year's share by that time; "Too early to tell" before forecast_too_early_before_hour (13).
  - day_sales on 28 Nov 2025 gives 155 orders / JOD 14,268.564 vs Shopify analytics 158 / 14,245.769 (analytics counts returns and edits slightly differently).
- My 7 live test carts from tonight are in bf_settings.test_sessions (forecast only).

## 2026-11-22 late: banner, preview tracking, channels
- Ticker: "UP TO 50% OFF" removed from bf_settings.ticker_preview and ticker_sale.
- Tracking on previews: checked by running the site under the preview hostnames (id-preview--8fb79741-...lovable.app, 8fb79741-...lovableproject.com, localhost): no Meta, GA4, Clarity or Klaviyo requests and no bf_events, even after add to cart; friday.myfyxx.com loads all of them. The real preview URLs need a Lovable login, so they could not be opened directly.
- bf_events.host (new column): the event's hostname. recordEvent drops any host not in tracking_hosts. Rows before 22 Nov 22:00 UTC have no host and can't be told apart from preview traffic.
- Sales forecast now compares Fyxx Friday 2025 vs 2026 by channel, whole day 00:00 to midnight Amman: Total, Digital (website + app), Website, Mobile app, In store (Point of Sale), Staff orders (draft orders and Shopify phone app). Channel comes from the order's Shopify app (bf-admin day_sales, deployed v18 by MCP because the auto-deploy didn't pick it up).
- Last year by this method: 155 orders, JOD 14,268.564 (website 7 / 646.130, app 55 / 4,162.180, in store 65 / 3,983.020, staff 28 / 5,477.234). Pace uses whole-day hourly shares (forecast_last_year.share_by_hour).
- "So far today" now counts from 00:00 Amman on Friday (same window as last year). Cart estimate label: "Digital, estimate from carts". Odoo in-store data: later.

## 2026-11-22 late: Fyxx first, product type on cards, Fyxx photos in circles
- Category circle photos: each category now uses a product whose vendor contains "Fyxx" (category_mapping[].image_handle). Live immediately (looked up at query time).
- Default product order: vendor contains Fyxx, then UMG, then Zumot, then the rest (bf_settings.vendor_priority). Only when the shopper hasn't picked a sort.
- Product type (Shopify) under the title on every catalog card.
- Default order (sort "featured", shown as "Fyxx picks first" in Filter & sort): Fyxx selection first, then everything else; each block cheapest band first, categories taking turns. Grid shows sticky headings "Fyxx selection / More from our shelves" + price band (GridHeading in src/routes/index.tsx; FilterBar sets --ff-filter-bottom).
- "Your usual" shelf (src/components/grid/YourUsual.tsx): visitors arriving from a Klaviyo email carry _kx; lookupUsual -> bf-admin "usual" (Klaviyo private key, read only) -> product IDs from their "Ordered Product" events (most ordered first). Only product IDs reach the browser (localStorage fyxx:usual, 60 days); cards come from bf_usual_items (anon RPC, visible + available only). Needs KLAVIYO_PRIVATE_KEY (or KLAVIYO_API_KEY) in the Supabase edge function secrets.
- Default order changed (owner, 22 Nov late): by category (circle order), Fyxx selection first inside each category, then the rest, each cheapest first. Grid headings: "<Category> Fyxx selection" / "<Category> More to choose from".
- Category order (category_mapping, so circles + grid): wines, spirits, then Cigars, then Accessories (owner, 23 Nov).
- Grid headings: category name only (no Fyxx / "more" split shown); the order still puts Fyxx first inside each category. Default sort label "Recommended" (owner, 23 Nov).
- /admin "Carts" section (above Most added to cart): one row per shopper's cart (browser session), biggest first: source, last active, went to checkout, items (first 3 + "and N more"), value at full price and at Friday prices; tiles with totals. RPC bf_carts_list (service role only, same cart rules as bf_cart_forecast).
