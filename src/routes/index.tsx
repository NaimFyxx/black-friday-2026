import { useEffect, useRef, useState } from "react";
import {
  dehydrate,
  hydrate,
  infiniteQueryOptions,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  catalogSource,
  CATEGORY_LABELS,
  CATEGORIES,
  getProducts,
  isCategory,
  PRODUCTS_PER_PAGE,
  type Category,
} from "@/lib/shopify";
import { cn } from "@/lib/utils";

const catalogQueryOptions = (deps: { category: Category; q: string | undefined }) =>
  infiniteQueryOptions({
    queryKey: ["catalog", deps.category, deps.q ?? ""],
    queryFn: ({ pageParam }) =>
      getProducts({
        first: PRODUCTS_PER_PAGE,
        after: pageParam ?? null,
        ...catalogSource({ category: deps.category, search: deps.q }),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    staleTime: 60_000,
  });

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const rawQuery = search["q"];
    const rawCategory = search["category"];

    return {
      q: typeof rawQuery === "string" && rawQuery.trim() ? rawQuery : undefined,
      category: isCategory(rawCategory) ? rawCategory : ("all" as Category),
    };
  },
  loaderDeps: ({ search }) => ({ q: search.q, category: search.category }),
  // Prime the cache for this shelf, then hand the cache to the browser so the
  // first client render matches the server instead of refetching from empty.
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureInfiniteQueryData(catalogQueryOptions(deps));
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
  const { q, category } = Route.useSearch();
  const { queryClient } = Route.useRouteContext();
  const dehydratedState = Route.useLoaderData();
  const hasHydrated = useRef(false);

  if (!hasHydrated.current) {
    hasHydrated.current = true;
    hydrate(queryClient, dehydratedState);
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    catalogQueryOptions({ q, category }),
  );

  const products = (data?.pages ?? []).flatMap((page) => page.products);

  const heroProducts = products.slice(0, 4);

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
          {/* Fyxx Friday logo + the four campaign bottles, centred (no text). The
              category name stays available to screen readers. */}
          <div className="flex flex-col items-center gap-6 border-b border-ff-black/15 pb-6">
            <h2 className="sr-only">{CATEGORY_LABELS[category]}</h2>
            <div aria-hidden="true" className="flex items-end justify-center">
              <img src="/brand/fyxx-friday-logo-red.svg" alt="" width={2587} height={1446} fetchPriority="high" className="h-16 w-auto md:h-24" />
              <img src="/brand/fyxx-friday-bottles.webp" alt="" width={942} height={1202} fetchPriority="high" className="-ml-4 h-24 w-auto md:-ml-6 md:h-36" />
            </div>
            <div className="w-full max-w-sm">
              <CatalogSearch value={q} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => <CategoryChip key={item} category={item} active={item === category} search={q} />)}
          </div>

          {products.length === 0 ? (
            <p className="py-24 text-center text-sm text-ff-black">No products found</p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => <ProductCard key={product.node.id} product={product} />)}
            </div>
          )}

          {hasNextPage && <div className="mt-14 flex justify-center">
            <Button variant="outline" size="lg" className="rounded-full border-ff-red px-8 text-ff-red hover:bg-ff-red hover:text-ff-cream" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : "Load more"}
            </Button>
          </div>}
        </div>
      </section>

      <footer id="footer" className="bg-ff-burgundy text-ff-cream">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-10 text-[11px] tracking-[0.18em] text-ff-cream uppercase">
          <img src="/brand/fyxx-friday-logo-cream.svg" alt="Fyxx Friday" width={2587} height={1446} loading="lazy" className="mb-2 h-12 w-auto self-start" />
          <span>Wine · spirits · cigars</span>
          <span>Amman · Jordan</span>
        </div>
      </footer>
    </main>
  );
}

function CategoryChip({
  category,
  active,
  search,
}: {
  category: Category;
  active: boolean;
  search: string | undefined;
}) {
  return (
    <Link
      to="/"
      search={{ q: undefined, category }}
      className={cn(
        "rounded-full border px-4 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors",
        active
          ? "border-ff-red bg-ff-red text-ff-cream"
          : "border-ff-red text-ff-black hover:border-ff-red hover:text-ff-red",
      )}
    >
      {CATEGORY_LABELS[category]}
    </Link>
  );
}

function CatalogSearch({ value }: { value: string | undefined }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(value ?? "");

  useEffect(() => {
    setTerm(value ?? "");
  }, [value]);

  useEffect(() => {
    if (term === (value ?? "")) return;
    const timer = setTimeout(() => {
      navigate({
        to: "/",
        search: (prev) => ({
          q: term.trim() || undefined,
          // Search covers the whole shop, so the "All products" chip lights up.
          category: term.trim() ? "all" : (prev.category ?? "all"),
        }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, value, navigate]);

  return (
    <label className="relative w-full max-w-sm">
      <span className="sr-only">Search the catalog</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search wine, spirits, cigars…"
        className="rounded-full border-border bg-background pl-9"
      />
    </label>
  );
}
