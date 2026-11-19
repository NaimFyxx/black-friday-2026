import { useCallback, useEffect, useRef, useState } from "react";
import { dehydrate, hydrate, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";

import { BackToTop } from "@/components/grid/BackToTop";
import { CatalogCard } from "@/components/grid/CatalogCard";
import { FilterBar } from "@/components/grid/FilterBar";
import { FloatingCart } from "@/components/grid/FloatingCart";
import { TopDeals } from "@/components/grid/TopDeals";
import { Input } from "@/components/ui/input";
import {
  catalogQueryOptions,
  facetsQueryOptions,
  type CatalogFilters,
  type SortKey,
} from "@/lib/catalog";
import { selectCartCount, useCartStore } from "@/stores/cartStore";

const SORTS: SortKey[] = ["discount", "price_asc", "price_desc", "newest"];
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);

export const Route = createFileRoute("/")({
  // Filters, sort and search live in the URL, so "back" from a product
  // returns to the same view (and the router restores the scroll position).
  validateSearch: (search: Record<string, unknown>): CatalogFilters => {
    const band = Number(search["band"]);
    const sort = search["sort"];
    const main = text(search["main"]);
    return {
      main,
      sub: main ? text(search["sub"]) : undefined,
      band: Number.isInteger(band) && band >= 0 && band < 10 ? band : undefined,
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
      context.queryClient.ensureInfiniteQueryData(catalogQueryOptions(deps)),
    ]);
    return dehydrate(context.queryClient);
  },
  head: () => ({
    meta: [
      { title: "Fyxx Friday: Black Friday 2026 at Fyxx, Wine, Spirits & Cigars in Amman" },
      {
        name: "description",
        content:
          "Black Friday 2026 at Fyxx: browse every wine, spirit and cigar in our Amman cellar and check out securely with Shopify.",
      },
      { property: "og:title", content: "Fyxx Friday: Black Friday 2026" },
      {
        property: "og:description",
        content:
          "Every wine, spirit and cigar from our Amman cellar, in one browsable list. Add to cart and check out with Shopify.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Storefront,
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto max-w-6xl px-6 py-24 text-sm text-muted-foreground">
      The catalog could not be loaded. {error instanceof Error ? error.message : String(error)}
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
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useInfiniteQuery(
    catalogQueryOptions(filters),
  );
  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const total = data?.pages[0]?.total ?? 0;
  const state = facets?.state ?? data?.pages[0]?.state ?? "preview";
  const sale = state === "sale";
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

      <section id="catalog" className="scroll-mt-16 bg-ff-cream md:scroll-mt-24">
        <div className="mx-auto max-w-[1320px] px-5 pt-8 pb-12 md:px-10 md:pt-10 md:pb-16">
          {/* Fyxx Friday logo + the four campaign bottles, centred. During the
              sale the headline "Up to X% off" sits under them. */}
          <div className="flex flex-col items-center gap-4 pb-5">
            <div aria-hidden="true" className="flex items-end justify-center">
              <img src="/brand/fyxx-friday-logo-red.svg" alt="" width={2587} height={1446} fetchPriority="high" className="h-16 w-auto md:h-24" />
              <img src="/brand/fyxx-friday-bottles.webp" alt="" width={942} height={1202} fetchPriority="high" className="-ml-4 h-24 w-auto md:-ml-6 md:h-36" />
            </div>
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

              {facets && <FilterBar facets={facets} filters={filters} onChange={setFilters} />}

              <div ref={gridTop} className="ff-small mt-4 flex items-center gap-2 text-xs text-ff-black/70">
                <span className="tabular-nums">{total} products</span>
                {isFetching && !isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>

              {items.length === 0 ? (
                <p className="ff-subline py-24 text-center text-sm text-ff-black">No products found</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
                  {items.map((item, i) => (
                    <CatalogCard key={item.product_id} item={item} threshold={threshold} eager={i < 4} />
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

      <footer id="footer" className={sale || cartCount > 0 ? "bg-ff-burgundy pb-20 text-ff-cream" : "bg-ff-burgundy text-ff-cream"}>
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-10 text-[11px] tracking-[0.18em] text-ff-cream uppercase">
          <img src="/brand/fyxx-friday-logo-cream.svg" alt="Fyxx Friday" width={2587} height={1446} loading="lazy" className="mb-2 h-12 w-auto self-start" />
          <span>Wine · spirits · cigars</span>
          <span>Amman · Jordan</span>
        </div>
      </footer>

      <FloatingCart sale={sale} />
      <BackToTop raised={mounted && cartCount > 0} />
    </main>
  );
}

function CatalogSearch({ value, onSearch }: { value: string | undefined; onSearch: (q: string | undefined) => void }) {
  const [term, setTerm] = useState(value ?? "");

  useEffect(() => {
    setTerm(value ?? "");
  }, [value]);

  // Search works together with the category, price and sort filters.
  useEffect(() => {
    if (term.trim() === (value ?? "")) return;
    const timer = setTimeout(() => onSearch(term.trim() || undefined), 300);
    return () => clearTimeout(timer);
  }, [term, value, onSearch]);

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
