import { useCallback, useEffect, useRef, useState } from "react";
import { dehydrate, hydrate, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";

import { BackToTop } from "@/components/grid/BackToTop";
import { CatalogCard } from "@/components/grid/CatalogCard";
import { CategoryCircles } from "@/components/grid/CategoryCircles";
import { FilterBar } from "@/components/grid/FilterBar";
import { FloatingCart } from "@/components/grid/FloatingCart";
import { TopDeals } from "@/components/grid/TopDeals";
import { TeaserHero } from "@/components/hero/TeaserHero";
import { SpinWidget } from "@/components/spin/SpinWidget";
import { Input } from "@/components/ui/input";
import {
  catalogQueryOptions,
  facetsQueryOptions,
  type CatalogFacets,
  type CatalogFilters,
  type SortKey,
} from "@/lib/catalog";
import { teaserQueryOptions } from "@/lib/teaser";
import { selectCartCount, useCartStore } from "@/stores/cartStore";

const SORTS: SortKey[] = ["discount", "price_asc", "price_desc", "newest"];
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);

export const Route = createFileRoute("/")({
  // Filters, sort and search live in the URL, so "back" from a product
  // returns to the same view (and the router restores the scroll position).
  validateSearch: (search: Record<string, unknown>): CatalogFilters => {
    const band = Number(search["band"]);
    const disc = Number(search["disc"]);
    const sort = search["sort"];
    const main = text(search["main"]);
    return {
      group: text(search["group"]),
      main,
      sub: main ? text(search["sub"]) : undefined,
      band: Number.isInteger(band) && band >= 0 && band < 10 ? band : undefined,
      disc: Number.isInteger(disc) && disc > 0 && disc < 100 ? disc : undefined,
      q: text(search["q"]),
      sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  // Prime the cache, then hand it to the browser so the first client render
  // matches the server instead of refetching from empty.
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(facetsQueryOptions(deps)),
      context.queryClient.ensureQueryData(teaserQueryOptions()),
      context.queryClient.ensureInfiniteQueryData(catalogQueryOptions(deps)),
    ]);
    return dehydrate(context.queryClient);
  },
  // Link preview (WhatsApp, Instagram, Facebook): image public/brand/og-fyxx-friday.jpg
  // (1200 x 630, option A chosen 21 Nov). Shared links need the full address.
  head: () => ({
    meta: [
      { title: "Fyxx Friday | 27 November" },
      {
        name: "description",
        content: "One day. The biggest deals of the year on wine, spirits and cigars. Delivered in Amman.",
      },
      { property: "og:title", content: "Fyxx Friday | 27 November" },
      {
        property: "og:description",
        content: "One day. The biggest deals of the year on wine, spirits and cigars. Delivered in Amman.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://friday.myfyxx.com/" },
      { property: "og:site_name", content: "Fyxx" },
      { property: "og:image", content: "https://friday.myfyxx.com/brand/og-fyxx-friday.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Fyxx Friday, November 27: one day only, special offers, best deals" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Fyxx Friday | 27 November" },
      {
        name: "twitter:description",
        content: "One day. The biggest deals of the year on wine, spirits and cigars. Delivered in Amman.",
      },
      { name: "twitter:image", content: "https://friday.myfyxx.com/brand/og-fyxx-friday.jpg" },
    ],
  }),
  component: Storefront,
  errorComponent: () => (
    <div role="alert" className="mx-auto max-w-6xl px-6 py-24 text-sm text-muted-foreground">
      The shop could not be loaded. Please refresh the page or try again in a moment.
    </div>
  ),
});

function Storefront() {
  const filters = Route.useSearch();
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const dehydratedState = Route.useLoaderData();
  const hasHydrated = useRef(false);

  if (!hasHydrated.current) {
    hasHydrated.current = true;
    hydrate(queryClient, dehydratedState);
  }

  const { data: facets } = useQuery(facetsQueryOptions(filters));
  const { data: teaser } = useQuery(teaserQueryOptions());
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useInfiniteQuery(
    catalogQueryOptions(filters),
  );
  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const state = facets?.state ?? data?.pages[0]?.state ?? "preview";
  const sale = state === "sale";
  // Teaser phase (before sale_start): the big hero replaces the small logo banner.
  const showHero = state === "preview" && !!teaser && teaser.state === "preview";
  const filtersAnchor = useRef<HTMLDivElement>(null);
  const scrollToFilters = useCallback(() => {
    const el = filtersAnchor.current;
    if (!el) return;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - header,
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);
  const threshold = Number(facets?.badge_amount_threshold ?? 100);
  const cartCount = useCartStore(selectCartCount);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const gridTop = useRef<HTMLDivElement>(null);
  const setFilters = useCallback(
    (patch: Partial<CatalogFilters>) => {
      navigate({ to: "/", search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false });
      // If the shopper is down the grid, bring them back to the top of the results.
      const el = gridTop.current;
      if (el && el.getBoundingClientRect().top < 0) {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 200 });
      }
    },
    [navigate],
  );

  // Load the next batch before the shopper reaches the end.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <main className="min-h-screen bg-ff-cream text-ff-black">
      <h1 className="sr-only">Fyxx Friday: Black Friday 2026, November 27, special offers and best deals</h1>
      {/* Moving ticker: the message scrolls right to left on a loop. Pauses on
          hover; stays still for visitors who ask for reduced motion. */}
      <div id="top" className="ff-ticker overflow-hidden bg-ff-red py-2 text-xs font-semibold tracking-[0.08em] text-ff-cream md:text-lg">
        <span className="sr-only">Black Friday 2026, November 27: special offers, best deals</span>
        <div aria-hidden="true" className="ff-ticker-track flex w-max whitespace-nowrap">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0">
              {Array.from({ length: 4 }, (_, k) => (
                <span key={k} className="flex shrink-0 items-center">
                  <span className="px-4 md:px-6">BLACK FRIDAY 2026</span>
                  <span>|</span>
                  <span className="px-4 md:px-6">NOVEMBER 27</span>
                  <span>|</span>
                  <span className="px-4 md:px-6">SPECIAL OFFERS. BEST DEALS</span>
                  <span>|</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {showHero && (
        <TeaserHero
          info={teaser}
          onStart={scrollToFilters}
          onSaleStarted={() => queryClient.invalidateQueries()}
        />
      )}

      <section id="catalog" className="scroll-mt-16 bg-ff-cream md:scroll-mt-24">
        <div className="mx-auto max-w-[1320px] px-5 pt-8 pb-12 md:px-10 md:pt-10 md:pb-16">
          {/* Fyxx Friday logo + the four campaign bottles, centred. During the
              sale the headline "Up to X% off" sits under them. */}
          <div className="flex flex-col items-center gap-4 pb-5">
            {!showHero && <div aria-hidden="true" className="flex items-end justify-center">
              <img src="/brand/fyxx-friday-logo-red.svg" alt="" width={2587} height={1446} fetchPriority="high" className="h-16 w-auto md:h-24" />
              <img src="/brand/fyxx-friday-bottles.webp" alt="" width={942} height={1202} fetchPriority="high" className="-ml-4 h-24 w-auto md:-ml-6 md:h-36" />
            </div>}
            {sale && facets?.headline_upto ? (
              <p className="ff-headline text-3xl text-ff-red uppercase md:text-5xl">Up to {facets.headline_upto}% off</p>
            ) : null}
            {state !== "ended" && (
              <div className="w-full max-w-sm">
                <CatalogSearch value={filters.q} onSearch={(q) => setFilters({ q })} />
              </div>
            )}
          </div>

          {state === "ended" ? (
            <div className="py-20 text-center">
              <p className="ff-headline text-3xl text-ff-red uppercase md:text-4xl">Fyxx Friday is over</p>
              <p className="ff-subline mt-3 text-base text-ff-black">Thank you for shopping with us. See you next year.</p>
            </div>
          ) : (
            <>
              {sale && facets && <TopDeals items={facets.top_deals} threshold={threshold} />}

              {/* "shop": where the header sections (The Cellar...) and the hero button land. */}
              <div id="shop" ref={filtersAnchor} aria-hidden="true" className="scroll-mt-[100px] md:scroll-mt-[88px]" />
              {facets && (
                <div className="pt-4 pb-2">
                  <CategoryCircles
                    mains={groupMains(facets, filters.group)}
                    active={filters.main}
                    sale={sale}
                    allUpto={facets.headline_upto}
                    layout="row"
                    onPick={(main) => setFilters({ main, sub: undefined })}
                  />
                </div>
              )}
              {facets && <FilterBar facets={facets} filters={filters} onChange={setFilters} />}

              {/* Product count and sort live in the filter bar; this marks the top of the grid. */}
              <div ref={gridTop} className="flex h-4 items-center justify-center">
                {isFetching && !isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin text-ff-black/50" />}
              </div>

              {items.length === 0 ? (
                <p className="ff-subline py-24 text-center text-sm text-ff-black">No products found</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
                  {items.map((item, i) => (
                    <CatalogCard key={item.product_id} item={item} threshold={threshold} eager={i < 4} preSaleLabel={state === "preview" ? (teaser?.copy.sale_label_preview ?? null) : null} />
                  ))}
                </div>
              )}

              <div ref={sentinel} aria-hidden="true" />
              {hasNextPage && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    className="ff-subline inline-flex h-11 items-center gap-2 rounded-full border border-ff-red px-8 text-sm text-ff-red"
                  >
                    {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>


      <FloatingCart sale={sale} />
      <BackToTop raised={mounted && cartCount > 0} />
      {state !== "ended" && <SpinWidget raised={mounted && cartCount > 0} />}
    </main>
  );
}

/** Inside a section (The Cellar...), only that section's category circles show. */
function groupMains(facets: CatalogFacets, group: string | undefined) {
  const g = group ? facets.groups.find((x) => x.name === group) : undefined;
  return g ? facets.mains.filter((m) => g.mains.includes(m.name)) : facets.mains;
}

function CatalogSearch({ value, onSearch }: { value: string | undefined; onSearch: (q: string | undefined) => void }) {
  const [term, setTerm] = useState(value ?? "");
  // The last search we sent. When the page's search changes to that value it
  // is our own search coming back: never write it into the box, or letters
  // typed while it was loading would be wiped (felt like lag on phones).
  const sent = useRef(value ?? "");

  // Only a change from elsewhere (removing the search tag, "Clear all", going
  // back) updates the box.
  useEffect(() => {
    const v = value ?? "";
    if (v === sent.current) return;
    sent.current = v;
    setTerm(v);
  }, [value]);

  // Search works together with the category, price and sort filters.
  useEffect(() => {
    const t = term.trim();
    if (t === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = t;
      onSearch(t || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [term, onSearch]);

  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">Search by name or brand</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ff-black/60" />
      <Input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search by name or brand"
        className="ff-small h-10 rounded-full border-ff-black/25 bg-ff-cream pl-9"
      />
    </label>
  );
}
