import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useCanGoBack, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Award,
  ChevronDown,
  Loader2,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Store,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { trackAddToCart, trackKlaviyoViewedProduct, trackViewItem } from "@/lib/analytics";
import {
  firstVariant,
  formatPrice,
  getProductByHandle,
  primaryImage,
  stripHtml,
  type ShopifyProductNode,
  type ShopifyVariant,
} from "@/lib/shopify";
import { sizedImage } from "@/lib/catalog";
import { parseDescription } from "@/lib/product-description";
import { onlySaleVariants } from "@/lib/sale-variants.functions";
import { simVariantPrices } from "@/lib/preview-sim.functions";
import { usePreview, useSim } from "@/lib/preview";
import { GoesWellWith } from "@/components/grid/GoesWellWith";
import { MembersRewards } from "@/components/members/MembersRewards";
import { FreeBottlesBox } from "@/components/rewards/FreeBottlesBox";
import { teaserQueryOptions } from "@/lib/teaser";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/stores/cartStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ params, context }) => {
    const product = await getProductByHandle(params.handle);
    if (!product) throw notFound();
    // Start downloading the photo now (also when a card is only touched or
    // hovered), so it is ready when the page shows.
    const url = primaryImage(product)?.url;
    if (url && typeof window !== "undefined") {
      const img = new Image();
      img.sizes = productImage(url).sizes;
      img.srcset = productImage(url).srcSet;
    }
    // Only sizes on the Fyxx Friday sale list can be chosen and added.
    const shown = await onlySaleVariants(product);
    // Admin on ?preview=friday: planned Friday prices (display only).
    return context.sim ? withSimPrices(shown) : shown;
  },
  // A card touched a moment ago already loaded this: don't fetch it twice.
  preloadStaleTime: 30_000,
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} | Fyxx` : "Product | Fyxx";
    const description = loaderData
      ? stripHtml(loaderData.descriptionHtml).slice(0, 180) ||
        `${loaderData.title} from the Fyxx cellar in Amman.`
      : "A bottle from the Fyxx cellar in Amman.";
    const image = loaderData ? primaryImage(loaderData)?.url : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [{ property: "og:image", content: image }] : []),
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      // Main photo: fetch it straight away, before the page scripts run.
      links: image
        ? [
            {
              rel: "preload",
              as: "image",
              href: productImage(image).src,
              imageSrcSet: productImage(image).srcSet,
              imageSizes: productImage(image).sizes,
              fetchPriority: "high",
            },
          ]
        : [],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <p className="text-sm text-muted-foreground">No products found</p>
      <Link
        to="/"
        search={{}}
        className="mt-6 inline-flex items-center rounded-full border border-border px-5 py-2 text-[11px] tracking-[0.18em] uppercase"
      >
        Back to the catalog
      </Link>
    </main>
  ),
  errorComponent: () => (
    <div role="alert" className="mx-auto max-w-6xl px-6 py-24 text-sm text-muted-foreground">
      This product could not be loaded. Please refresh the page or try again in a moment.
    </div>
  ),
});

/** Planned Friday prices on the sale-list sizes (admin preview only). */
async function withSimPrices(product: ShopifyProductNode): Promise<ShopifyProductNode> {
  const prices = await simVariantPrices({ data: { productId: product.id } }).catch(() => null);
  if (!prices) return product;
  const money = (n: number) => ({ amount: Number(n).toFixed(3), currencyCode: "JOD" });
  return {
    ...product,
    variants: {
      ...product.variants,
      edges: product.variants.edges.map((e) => {
        const p = prices[e.node.id];
        return p
          ? { node: { ...e.node, price: money(p.price), compareAtPrice: money(p.compare_at) } }
          : e;
      }),
    },
  };
}

/** Main product photo from the Shopify CDN at the size the screen needs. */
function productImage(url: string) {
  const widths = [400, 600, 800, 1000, 1200];
  return {
    src: sizedImage(url, 800)!,
    srcSet: widths.map((w) => `${sizedImage(url, w)} ${w}w`).join(", "),
    // The photo fills 88% of a full-width box on phones, half the page on desktop.
    sizes: "(min-width: 1152px) 500px, (min-width: 768px) 44vw, 88vw",
  };
}

// Small promises under the button, same as the myfyxx.com product page.
const PERKS = [
  { icon: Truck, text: "Delivery in under an hour" },
  { icon: Store, text: "Collect in Swefieh within the hour" },
  { icon: RotateCcw, text: "Free 7 day returns" },
  { icon: Award, text: "Earns Fyxx Points" },
  { icon: Lock, text: "Secure online payment" },
];

/** "Beronia | Reserva" -> brand "Beronia", name "Reserva". */
function splitTitle(title: string) {
  const i = title.indexOf("|");
  if (i < 0) return { brand: null, name: title.trim() };
  return { brand: title.slice(0, i).trim(), name: title.slice(i + 1).trim() };
}

const tagValue = (tags: string[] | undefined, prefix: string) =>
  tags
    ?.find((t) => t.startsWith(prefix))
    ?.slice(prefix.length)
    .trim() || null;

/** "Red Wine · Spain · Rioja · 75cl" from Shopify tags and the chosen size. */
function metaLine(product: ShopifyProductNode, variant: ShopifyVariant | null) {
  const style = tagValue(product.tags, "WineStyle_");
  const kind =
    product.productType === "Wine" && style ? `${style} Wine` : product.productType || null;
  const size = variant && variant.title !== "Default Title" ? variant.title : null;
  return [kind, tagValue(product.tags, "Country_"), tagValue(product.tags, "Region_"), size]
    .filter(Boolean)
    .join(" · ");
}

function ProductPage() {
  const product = Route.useLoaderData();
  const preview = usePreview();
  const sim = useSim();
  const { data: teaser } = useQuery(teaserQueryOptions(preview));
  // Stock left (bf_stock, synced from Shopify every 15 min), for "Last piece".
  const { data: stockLeft } = useQuery({
    queryKey: ["bf-stock", product.handle],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "bf_stock" as never,
        {
          p_handle: product.handle,
        } as never,
      );
      if (error) return null;
      const n: unknown = data;
      return typeof n === "number" ? n : null;
    },
    staleTime: 60_000,
    enabled: teaser?.last_piece === true,
  });
  // Sticky phone bar: shown once the main Add to cart button has scrolled up out of view.
  const mainAdd = useRef<HTMLButtonElement>(null);
  const [stickyBar, setStickyBar] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = mainAdd.current;
      setStickyBar(!!el && el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const variants = product.variants.edges.map((edge) => edge.node);
  const [selected, setSelected] = useState<ShopifyVariant | null>(
    () => variants.find((variant) => variant.availableForSale) ?? firstVariant(product),
  );
  const [qty, setQty] = useState(1);
  const image = primaryImage(product);
  const addItem = useCartStore((state) => state.addItem);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { brand, name } = splitTitle(product.title);
  const description = useMemo(
    () => parseDescription(product.descriptionHtml),
    [product.descriptionHtml],
  );
  // Bottles say "bottle" (or "wine"); cigars and accessories say "product".
  const aboutTitle =
    product.productType === "Wine"
      ? "About this wine"
      : product.productType === "Cigars" || /accessor/i.test(product.productType)
        ? "About this product"
        : "About this bottle";

  // Product view -> GA4 view_item + Meta ViewContent (once per product).
  useEffect(() => {
    // The variant the page starts on (first available), same as `selected`.
    const variant =
      product.variants.edges.map((e) => e.node).find((v) => v.availableForSale) ??
      firstVariant(product);
    if (!variant) return;
    trackViewItem({
      id: variant.id,
      name: product.title,
      handle: product.handle,
      variant: variant.title,
      price: Number(variant.price.amount),
      currency: variant.price.currencyCode,
      quantity: 1,
    });
    trackKlaviyoViewedProduct(product, variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const handleAdd = async () => {
    if (!selected) return;
    setPending(true);
    try {
      await addItem({
        product: { node: product },
        variantId: selected.id,
        variantTitle: selected.title,
        price: selected.price,
        compareAtPrice: selected.compareAtPrice ?? null,
        quantity: qty,
        selectedOptions: selected.selectedOptions,
      });
      trackAddToCart({
        id: selected.id,
        name: product.title,
        handle: product.handle,
        variant: selected.title,
        price: Number(selected.price.amount),
        currency: selected.price.currencyCode,
        quantity: qty,
      });
      toast.success("Added to cart", { description: product.title });
    } finally {
      setPending(false);
    }
  };

  // Planned Friday % for the selected size, before 10:00 only.
  const plannedVariant = selected?.id ?? null;
  const { data: plannedPct } = useQuery({
    queryKey: ["bf-planned-percent", plannedVariant],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "bf_planned_percent" as never,
        { p_variant: plannedVariant } as never,
      );
      if (error) return null;
      const n: unknown = data;
      return typeof n === "number" && n > 0 ? n : null;
    },
    staleTime: 60_000,
    enabled: !!plannedVariant && teaser?.state === "preview",
  });
  const price = selected?.price ?? product.priceRange.minVariantPrice;
  const was = selected?.compareAtPrice;
  // After the sale: no crossed-out price or badge, whatever Shopify still says.
  const ended = teaser?.state === "ended";
  const discounted = !ended && !!was && Number(was.amount) > Number(price.amount);
  const pct = discounted
    ? Math.floor(((Number(was!.amount) - Number(price.amount)) / Number(was!.amount)) * 100)
    : 0;
  const meta = metaLine(product, variants.length > 1 ? selected : (variants[0] ?? null));
  // Before 10:00: the planned Friday % for this size (bf_planned_percent; null when
  // the /admin switch is off or the size has no planned discount).
  const beforeSale = teaser?.state === "preview";
  const badgePct = beforeSale ? (plannedPct ?? (discounted ? pct : 0)) : pct;
  const badgeLabel =
    beforeSale || (teaser?.state === "sale" && teaser?.sale_extras !== true)
      ? (teaser?.copy.sale_label_preview ?? "off")
      : "";

  return (
    <main className="bg-ff-cream text-ff-black">
      <div className="mx-auto max-w-6xl px-5 pt-6 pb-16 md:px-10 md:pt-10">
        <Link
          to="/"
          search={{}}
          onClick={(event) => {
            // Came from the catalog: go back, so filters, sort, search and the
            // scroll position are restored.
            if (canGoBack) {
              event.preventDefault();
              router.history.back();
            }
          }}
          className="ff-small inline-flex items-center gap-1.5 text-xs tracking-[0.14em] text-ff-burgundy uppercase hover:text-ff-red"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the shop
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-14">
          {/* Photo */}
          <div className="md:sticky md:top-[112px] md:self-start">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-ff-black/10 bg-ff-cream">
              {(teaser?.state === "sale" || beforeSale) && badgePct > 0 && (
                <span className="ff-num absolute top-3 left-3 z-10 rounded-full bg-ff-red px-3 py-1 text-sm text-ff-cream">
                  -{badgePct}%{badgeLabel && <span className="ff-subline"> {badgeLabel}</span>}
                </span>
              )}
              {image ? (
                <img
                  {...productImage(image.url)}
                  loading="eager"
                  decoding="async"
                  alt={image.altText ?? product.title}
                  width={900}
                  height={900}
                  fetchPriority="high"
                  className="h-[88%] w-[88%] object-contain mix-blend-multiply"
                />
              ) : (
                <span className="ff-small text-xs text-ff-black/50 uppercase">No photo</span>
              )}
            </div>
          </div>

          {/* Buy box */}
          <div>
            {brand && (
              <p className="ff-headline text-xs tracking-[0.16em] text-ff-red uppercase md:text-sm md:tracking-[0.18em]">
                {brand}
              </p>
            )}
            <h1 className="ff-headline mt-1 text-2xl leading-tight md:mt-2 md:text-5xl md:leading-[1.05]">
              {name}
            </h1>
            {meta && (
              <p className="ff-small mt-1.5 text-xs text-ff-black/70 md:mt-3 md:text-sm">{meta}</p>
            )}

            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 md:mt-6">
              <span className={cn("ff-num text-2xl md:text-3xl", discounted && "text-ff-red")}>
                {formatPrice(price)}
              </span>
              {discounted && (
                <s className="ff-small text-base text-ff-black/55 tabular-nums md:text-lg">
                  {formatPrice(was!)}
                </s>
              )}
            </p>
            {teaser && teaser.state !== "ended" && teaser.copy.no_code_note && (
              <p className="ff-small mt-1 text-xs text-ff-burgundy md:mt-1.5 md:text-sm">
                {teaser.copy.no_code_note}
              </p>
            )}

            {variants.length > 1 && (
              <fieldset className="mt-6">
                <legend className="ff-headline mb-2.5 text-xs tracking-[0.14em] text-ff-black/70 uppercase">
                  {product.options[0]?.name && product.options[0].name !== "Title"
                    ? product.options[0].name
                    : "Option"}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={selected?.id === variant.id}
                      disabled={!variant.availableForSale}
                      onClick={() => setSelected(variant)}
                      className={cn(
                        "ff-subline h-10 rounded-full border px-4 text-sm transition-colors",
                        selected?.id === variant.id
                          ? "border-ff-red bg-ff-red text-ff-cream"
                          : "border-ff-black/30 hover:border-ff-red",
                        !variant.availableForSale && "line-through opacity-40",
                      )}
                    >
                      {variant.title}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="mt-6 flex items-stretch gap-3">
              <div className="flex h-12 items-center rounded-full border border-ff-black/30">
                <button
                  type="button"
                  aria-label="One less"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-12 w-11 items-center justify-center"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="ff-num w-6 text-center text-base" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="One more"
                  onClick={() => setQty((q) => Math.min(24, q + 1))}
                  className="flex h-12 w-11 items-center justify-center"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                ref={mainAdd}
                type="button"
                onClick={handleAdd}
                disabled={!selected?.availableForSale || pending}
                className="ff-subline flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ff-red text-base text-ff-cream transition-colors hover:bg-ff-burgundy disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : selected?.availableForSale ? (
                  "Add to cart"
                ) : variants.length === 0 ? (
                  "Not available right now"
                ) : (
                  "Sold out"
                )}
              </button>
            </div>

            {/* Only one left (single-option products only: the count is per product). */}
            {teaser?.last_piece === true &&
              stockLeft === 1 &&
              variants.length <= 1 &&
              selected?.availableForSale && (
                <p className="ff-subline mt-3 text-sm text-ff-red">Last piece</p>
              )}

            <FreeBottlesBox className="mt-4" />

            {/* Fyxx Rewards: one thin line, "See tiers" opens the tiers. */}
            <MembersRewards
              where="product"
              className="mt-6 overflow-hidden rounded-xl border border-ff-black/10"
            />
          </div>
        </div>

        {/* Delivery promises and the full description in one dropdown, closed at
            first, so "What goes well" is right below. */}
        <details className="group mx-auto mt-10 max-w-3xl border-y border-ff-black/15 md:mt-14">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="ff-headline block text-xl md:text-2xl">{aboutTitle}</span>
              <span className="ff-small block text-sm text-ff-black/60">
                Delivery, returns and product details
              </span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pb-8">
            <ul className="ff-small space-y-2.5 text-sm text-ff-black/80">
              {PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-ff-red" />
                  {text}
                </li>
              ))}
            </ul>
            {(description.intro.length > 0 || description.sections.length > 0) && (
              <div className="mt-7 border-t border-ff-black/15 pt-6">
                <article>
                  {description.intro.length > 0 && (
                    <section>
                      <div className="mt-2 space-y-3">
                        {description.intro.map((p, i) => (
                          <p
                            key={i}
                            className={
                              i === 0
                                ? "ff-subline text-lg leading-relaxed text-ff-burgundy md:text-xl"
                                : "ff-small text-base leading-relaxed text-ff-black/80"
                            }
                          >
                            {p}
                          </p>
                        ))}
                      </div>
                    </section>
                  )}

                  {description.sections.map((s, i) => (
                    <section
                      key={`${s.title}-${i}`}
                      className={cn(
                        "mt-8 pt-7",
                        s.kind === "producer"
                          ? "border-t-2 border-ff-black"
                          : "border-t border-ff-black/15",
                      )}
                    >
                      <h2
                        className={
                          s.kind === "producer"
                            ? "ff-headline text-sm tracking-[0.18em] uppercase"
                            : "ff-headline text-xl md:text-2xl"
                        }
                      >
                        {s.title}
                      </h2>
                      {s.lines.length > 0 && (
                        <div className="ff-small mt-3 space-y-2 text-base leading-relaxed text-ff-black/85">
                          {s.lines.map((l, k) => (
                            <p key={k}>{l}</p>
                          ))}
                        </div>
                      )}
                      {s.bullets.length > 0 && (
                        <ul className="ff-small mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-ff-black/85 marker:text-ff-red">
                          {s.bullets.map((b, k) => (
                            <li key={k}>{b}</li>
                          ))}
                        </ul>
                      )}
                      {s.facts.length > 0 && (
                        <dl className="mt-3 divide-y divide-ff-black/10">
                          {s.facts.map((f, k) => (
                            <div
                              key={k}
                              className="grid grid-cols-[7.5rem_1fr] gap-4 py-3 md:grid-cols-[10rem_1fr]"
                            >
                              <dt className="ff-headline pt-0.5 text-xs tracking-[0.12em] text-ff-black/55 uppercase">
                                {f.label}
                              </dt>
                              <dd className="ff-small text-base text-ff-black">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </section>
                  ))}
                </article>
              </div>
            )}
          </div>
        </details>

        <GoesWellWith
          productType={product.productType}
          productId={product.id}
          teaser={teaser}
          preview={preview}
          sim={sim}
        />
      </div>

      {/* Phones: Add to cart stays at hand once the main button scrolls away. */}
      {stickyBar && selected?.availableForSale && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-ff-black/15 bg-ff-cream px-4 py-3 md:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0 flex-1">
            <p className="ff-subline truncate text-sm">{product.title}</p>
            <p className="flex items-baseline gap-2">
              <span className={cn("ff-num text-base", discounted && "text-ff-red")}>
                {formatPrice(price)}
              </span>
              {discounted && (
                <s className="ff-small text-xs text-ff-black/55">{formatPrice(was!)}</s>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="ff-subline flex h-11 shrink-0 items-center justify-center rounded-full bg-ff-red px-6 text-sm text-ff-cream disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to cart"}
          </button>
        </div>
      )}
    </main>
  );
}
