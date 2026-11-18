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

  const heroProducts = products.slice(0, 4);
  const categoryKeywords: Record<string, string[]> = {
    cigars: ["cigar"], "red-wine": ["red wine", "red"], "white-wine": ["white wine", "white"],
    beer: ["beer"], whisky: ["whisky", "whiskey"], vodka: ["vodka"],
    "tequila-mezcal": ["tequila", "mezcal"], sake: ["sake"], arak: ["arak"],
    gin: ["gin"], rum: ["rum"], dukkan: ["dukkan", "accessor", "snack"],
  };

  return (
    <main className="min-h-screen bg-[#f6f0e9] text-[#4b0719]">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-4 md:px-10">
          <Link to="/" search={{ q: undefined, category: "all" }} className="font-serif text-4xl italic tracking-[-0.08em] text-[#f51d32] md:text-5xl">fyxx</Link>
          <nav className="hidden items-center gap-7 text-[11px] font-semibold tracking-wide uppercase md:flex">
            <a href="#top" className="transition-colors hover:text-[#ff263b]">Home</a>
            <a href="#catalog" className="transition-colors hover:text-[#ff263b]">The Cellar</a>
            <a href="#categories" className="transition-colors hover:text-[#ff263b]">Shop by category</a>
            <a href="#footer" className="transition-colors hover:text-[#ff263b]">About us</a>
          </nav>
          <a href="#catalog" className="border border-white/70 px-4 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors hover:bg-white hover:text-black">Shop now</a>
        </div>
      </header>

      <div className="bg-[#f51d32] px-3 py-2 text-center text-xs font-semibold tracking-[0.08em] text-white md:text-lg">
        <span className="mr-2">ϟ</span> BLACK FRIDAY 2026 <span className="mx-2">|</span> 25–30 NOVEMBER
      </div>

      <section id="top" className="bg-[#f4eee8]">
        <div className="mx-auto flex w-full justify-center">
          <a href="#catalog" aria-label="Shop Fyxx Friday special offers" className="block w-full max-w-[760px]">
            <img
              src="https://cdn.shopify.com/s/files/1/0108/6328/0224/files/fyxx-friday-hero.jpg?v=1795017522"
              alt="Fyxx Friday — November 27 special offers"
              fetchPriority="high"
              className="block h-auto w-full"
            />
          </a>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-[1320px] px-5 pb-10 pt-2 md:px-10 md:pb-16">
        <div className="mb-7 flex items-center gap-5">
          <span className="h-px flex-1 bg-[#f51d32]" />
          <h2 className="text-center text-xl font-black tracking-tight text-[#ed1c32] md:text-3xl">SHOP BY CATEGORY</h2>
          <span className="h-px flex-1 bg-[#f51d32]" />
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6 md:gap-x-7 md:gap-y-8">
          {CATEGORIES.filter((item) => item !== "all").map((item) => {
            const keywords = categoryKeywords[item] ?? [CATEGORY_LABELS[item].toLowerCase()];
            const match = products.find((product) => keywords.some((keyword) => product.node.productType.toLowerCase().includes(keyword)));
            const image = match ? primaryImage(match.node) : null;
            return <Link key={item} to="/" search={{ q: undefined, category: item }} className="group flex flex-col items-center text-center">
              <div className="aspect-square w-full max-w-[142px] overflow-hidden rounded-full bg-[#b20d24] shadow-sm transition-transform duration-300 group-hover:scale-105">
                {image ? <img src={image.url} alt={CATEGORY_LABELS[item]} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-2 text-[10px] font-bold text-white uppercase">{CATEGORY_LABELS[item]}</div>}
              </div>
              <span className="mt-2 text-[10px] font-black tracking-tight text-[#4b0719] uppercase md:text-xs">{CATEGORY_LABELS[item]}</span>
            </Link>;
          })}
        </div>
      </section>

      <section id="catalog" className="bg-[#fffdfa]">
        <div className="mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-16">
          <div className="flex flex-col gap-6 border-b border-[#eadde0] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-[#ed1c32] uppercase">The Fyxx Black Friday edit</p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase text-[#4b0719]">{CATEGORY_LABELS[category]}</h2>
              <p className="mt-1 text-xs tracking-[0.18em] text-[#805d66] uppercase">Showing {products.length} item{products.length !== 1 ? "s" : ""}</p>
            </div>
            <CatalogSearch value={q} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => <CategoryChip key={item} category={item} active={item === category} search={q} />)}
          </div>

          {products.length === 0 ? (
            <p className="py-24 text-center text-sm text-[#805d66]">No products found</p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => <ProductCard key={product.node.id} product={product} />)}
            </div>
          )}

          {hasNextPage && <div className="mt-14 flex justify-center">
            <Button variant="outline" size="lg" className="rounded-full border-[#ed1c32] px-8 text-[#ed1c32] hover:bg-[#ed1c32] hover:text-white" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading</> : "Load more"}
            </Button>
          </div>}
        </div>
      </section>

      <footer id="footer" className="bg-black text-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-6 py-10 text-[11px] tracking-[0.18em] text-white/65 uppercase">
          <span className="font-serif text-3xl italic tracking-tight text-[#f51d32]">fyxx</span>
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
      search={{ q: search, category }}
      className={cn(
        "rounded-full border px-4 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors",
        active
          ? "border-[#ed1c32] bg-[#ed1c32] text-white"
          : "border-[#ed1c32]/25 text-[#4b0719]/75 hover:border-[#ed1c32] hover:text-[#ed1c32]",
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
