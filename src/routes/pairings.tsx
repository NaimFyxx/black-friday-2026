import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { trackAddToCart } from "@/lib/analytics";
import { sizedImage, toCartProduct } from "@/lib/catalog";
import { PAIRINGS_LABEL, pairingsQueryOptions, setTotals, type PairingSet } from "@/lib/pairings";
import { usePreview } from "@/lib/preview";
import { formatJod } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { useCartUi } from "@/stores/cartUiStore";

export const Route = createFileRoute("/pairings")({
  head: () => ({
    meta: [
      { title: `${PAIRINGS_LABEL} | Fyxx Friday` },
      {
        name: "description",
        content: "Ready-made wine, spirits and cigar sets from Fyxx. Ready to pour, easy to gift.",
      },
    ],
  }),
  component: PairingsPage,
});

function PairingsPage() {
  const { data, isLoading, error } = useQuery(pairingsQueryOptions(usePreview()));
  const sets = data?.sets ?? [];
  return (
    <main className="bg-ff-cream">
      <div className="mx-auto max-w-[1320px] px-5 pt-8 pb-16 md:px-10 md:pt-12">
        <h1 className="ff-headline text-3xl text-ff-red uppercase md:text-5xl">
          {data?.title ?? PAIRINGS_LABEL}
        </h1>
        <p className="ff-subline mt-2 max-w-[48ch] text-base text-ff-black md:text-lg">
          {data?.intro ?? "Sets put together by the Fyxx team. Ready to pour, easy to gift."}
        </p>

        {error ? (
          <p className="py-20 text-center text-sm text-ff-black">
            The sets can&apos;t be shown right now. Please try again in a moment.
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-ff-black/50" />
          </div>
        ) : sets.length === 0 ? (
          <p className="py-20 text-center text-sm text-ff-black">
            New sets are on their way.{" "}
            <Link to="/" className="underline">
              See all products
            </Link>
          </p>
        ) : (
          <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => (
              <SetCard key={s.id} set={s} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SetCard({ set }: { set: PairingSet }) {
  const addItem = useCartStore((st) => st.addItem);
  const openCart = useCartUi((st) => st.setOpen);
  const [pending, setPending] = useState(false);
  const { price, compare } = setTotals(set.items);
  const money = (n: number) => ({ amount: n.toFixed(3), currencyCode: "JOD" });

  const addSet = async () => {
    setPending(true);
    try {
      for (const item of set.items) {
        await addItem({
          product: toCartProduct(item),
          variantId: item.variant_id,
          variantTitle:
            item.variant_title && item.variant_title !== "Default Title" ? item.variant_title : "",
          price: money(item.price),
          compareAtPrice:
            item.compare_at_price && item.compare_at_price > item.price
              ? money(item.compare_at_price)
              : null,
          quantity: 1,
          selectedOptions: [],
        });
        trackAddToCart({
          id: item.variant_id,
          name: item.title,
          handle: item.handle,
          variant: item.variant_title ?? "",
          price: item.price,
          currency: "JOD",
          quantity: 1,
        });
      }
      toast.success("Set added to cart", { description: set.name });
      openCart(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-ff-black/10 bg-white">
      {/* The bottles side by side */}
      <div className="flex h-52 items-end justify-center gap-0 bg-ff-warm-cream px-3 pt-3 md:h-64">
        {set.items.map((i) => (
          <img
            key={i.variant_id}
            src={sizedImage(i.image_url, 300)}
            alt=""
            loading="lazy"
            className="h-full min-w-0 flex-1 scale-110 object-contain object-bottom mix-blend-multiply"
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col p-4 md:p-5">
        <h2 className="ff-headline text-lg text-ff-black md:text-xl">{set.name}</h2>
        <p className="ff-small mt-1 text-sm text-ff-black/70">{set.blurb}</p>
        <ul className="mt-3 space-y-1 text-sm text-ff-black">
          {set.items.map((i) => (
            <li key={i.variant_id} className="flex justify-between gap-3">
              <Link
                to="/product/$handle"
                params={{ handle: i.handle }}
                className="min-w-0 truncate hover:underline"
              >
                {i.title}
              </Link>
              <span className="shrink-0 text-ff-black/60 tabular-nums">{formatJod(i.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="ff-num text-xl text-ff-black">{formatJod(price)}</span>
            {compare > price && (
              <s className="ff-small text-sm text-ff-black/55 tabular-nums">{formatJod(compare)}</s>
            )}
            <span className="ff-small text-xs text-ff-black/60">{set.items.length} items</span>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void addSet()}
            className="ff-subline mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-ff-red text-sm text-ff-cream hover:bg-ff-burgundy disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add set to cart
          </button>
        </div>
      </div>
    </li>
  );
}
