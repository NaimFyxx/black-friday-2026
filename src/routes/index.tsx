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
  buildCatalogQuery,
  CATEGORY_LABELS,
  CATEGORIES,
  getProducts,
  isCategory,
  PRODUCTS_PER_PAGE,
  primaryImage,
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
        query: buildCatalogQuery({ category: deps.category, search: deps.q }),
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
      { title: "Black Friday 2026 — Fyxx Wine, Spirits & Cigars in Amman" },
      {
        name: "description",
        content:
          "Black Friday 2026 at Fyxx: browse every wine, spirit and cigar in our Amman cellar and check out securely with Shopify.",
      },
      { property: "og:title", content: "Black Friday 2026 — Fyxx" },
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

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <section className="border-b border-yellow-400/30 bg-black">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="mb-5 inline-flex items-center rounded-full border border-yellow-400/50 bg-yellow-400/10 px-4 py-2 text-[10px] font-black tracking-[0.2em] text-yellow-300 uppercase">BLACK FRIDAY EVENT · 2026</div>
          <p className="text-[11px] font-bold tracking-[0.3em] text-yellow-400 uppercase">
            Black Friday 2026 · Amman, Jordan
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-6xl font-black leading-[0.88] tracking-tight text-white md:text-8xl">
            Black Friday 2026
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            THE BIGGEST DEALS OF THE YEAR. Explore the Fyxx collection and shop your favourites.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#catalog"
              className="inline-flex items-center rounded-full bg-yellow-400 px-8 py-3 text-xs font-black tracking-[0.18em] text-black uppercase transition-transform hover:scale-[1.03]"
            >
              SHOP ALL
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-9 md:px-6 md:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-bold tracking-[0.25em] text-yellow-400 uppercase">Find your favourites</p><h2 className="mt-2 font-display text-3xl font-bold uppercase md:text-4xl">Shop by category</h2></div>
          <span className="hidden text-xs tracking-widest text-white/50 uppercase sm:block">12 collections</span>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6 md:gap-5">
          {CATEGORIES.filter((item) => item !== "all").map((item) => {
            const keyword = item === "tequila-mezcal" ? "tequila" : CATEGORY_LABELS[item].split(" ")[0].toLowerCase();
            const match = products.find((product) => product.node.productType.toLowerCase().includes(keyword));
            const image = match ? primaryImage(match.node) : null;
            return <Link key={item} to="/" search={{ q: undefined, category: item }} className="group flex flex-col items-center text-center">
              <div className="aspect-square w-full max-w-[132px] overflow-hidden rounded-full border border-yellow-400/30 bg-white/5 p-1 transition-all group-hover:border-yellow-400 group-hover:shadow-[0_0_24px_rgba(250,204,21,0.18)]">
                <div className="h-full w-full overflow-hidden rounded-full bg-white/10">
                  {image ? <img src={image.url} alt={CATEGORY_LABELS[item]} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" /> : <div className="flex h-full items-center justify-center px-2 text-[10px] font-bold tracking-wider text-yellow-300 uppercase">{CATEGORY_LABELS[item]}</div>}
                </div>
              </div>
              <span className="mt-2 text-[11px] font-bold tracking-wide text-white uppercase md:text-xs">{CATEGORY_LABELS[item]}</span>
            </Link>;
          })}
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-6xl px-5 py-12 md:px-6 md:py-16">
        <div className="flex flex-col gap-6 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-yellow-400 uppercase">The Fyxx Black Friday edit</p><h2 className="mt-2 font-display text-3xl font-bold uppercase">{CATEGORY_LABELS[category]}</h2>
            <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Showing {products.length} item{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <CatalogSearch value={q} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <CategoryChip key={item} category={item} active={item === category} search={q} />
          ))}
        </div>

        {products.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">No products found</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.node.id} product={product} />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="mt-14 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          <span>fyxx — wine, spirits &amp; cigars</span>
          <span>Amman · open daily 10 AM till midnight</span>
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
      search={{ q: search, category }}
      className={cn(
        "rounded-full border px-4 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors",
        active
          ? "border-yellow-400 bg-yellow-400 text-black"
          : "border-white/20 text-white/65 hover:border-yellow-400 hover:text-yellow-300",
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
          category: prev.category ?? "all",
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
