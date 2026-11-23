import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackAddToCart } from "@/lib/analytics";
import { formatJod, getProductByHandle, type ShopifyProductNode } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { cn } from "@/lib/utils";

/**
 * "10% OFF GIFT CARDS" sticker in the hero, styled like the Fyxx gift card
 * (black card, cream serif type, italic fyxx).
 * Prices shown and the discount are set here. "Add to cart" adds the real
 * Shopify gift card ("fyxx-gift-card", the variant with that face value) at its
 * Shopify price; the 10% comes off at checkout through a Shopify discount.
 */

/** Where the sticker sits inside the hero. Change these to move it. */
const GIFT_STICKER_POSITION = {
  mobile: "top-3 right-3",
  desktop: "md:top-6 md:right-8 lg:top-8 lg:right-10",
};

const DISCOUNT = 0.1; // 10% off
const FACE_VALUES = [25, 50, 100, 200]; // JOD
const GIFT_CARD_HANDLE = "fyxx-gift-card";

const SERIF = { fontFamily: '"Times New Roman", Georgia, "Iowan Old Style", serif' };

export function GiftCardSticker({ className }: { className?: string }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const sticker = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="10% off gift cards: see the gift cards"
      className={cn(
        "group absolute z-10 block w-[92px] rotate-[6deg] transition-transform duration-200 ease-out",
        "hover:-translate-y-1 hover:rotate-0 focus-visible:-translate-y-1 focus-visible:rotate-0 focus-visible:outline-none",
        "md:w-[136px]",
        GIFT_STICKER_POSITION.mobile,
        GIFT_STICKER_POSITION.desktop,
        className,
      )}
    >
      <GiftCardFace />
    </button>
  );

  const panel = <GiftCardList onAdded={() => setOpen(false)} />;

  if (isMobile) {
    return (
      <>
        {sticker}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border-ff-black/15 bg-ff-cream p-5">
            <DialogTitle className="ff-headline text-lg text-ff-black">
              10% off gift cards
            </DialogTitle>
            <DialogDescription className="ff-small -mt-1 text-sm text-ff-black/70">
              Give the gift of Fyxx for less.
            </DialogDescription>
            {panel}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{sticker}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] rounded-2xl border-ff-black/15 bg-ff-cream p-5 shadow-xl"
      >
        <p className="ff-headline text-lg text-ff-black">10% off gift cards</p>
        <p className="ff-small mb-3 text-sm text-ff-black/70">Give the gift of Fyxx for less.</p>
        {panel}
      </PopoverContent>
    </Popover>
  );
}

/** The sticker face: a small black Fyxx gift card with the offer. */
function GiftCardFace() {
  return (
    <span
      className={cn(
        "relative block aspect-[1.586] w-full overflow-hidden rounded-[10px] bg-ff-black text-ff-cream",
        "shadow-[0_6px_14px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.4)] ring-1 ring-white/10",
        "transition-shadow duration-200 group-hover:shadow-[0_12px_24px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.4)]",
      )}
    >
      {/* Soft sheen, like a printed card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_40%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.06)_100%)]"
      />
      <span className="relative flex h-full flex-col items-center justify-center px-2 text-center">
        <span style={SERIF} className="text-[17px] leading-none md:text-[25px]">
          10% OFF
        </span>
        <span
          style={SERIF}
          className="mt-0.5 text-[7.5px] tracking-[0.18em] md:mt-1 md:text-[10.5px]"
        >
          GIFT CARDS
        </span>
        <span style={SERIF} className="mt-1 text-[11px] italic leading-none md:mt-1.5 md:text-sm">
          fyxx
        </span>
      </span>
    </span>
  );
}

function GiftCardList({ onAdded }: { onAdded: () => void }) {
  const addItem = useCartStore((st) => st.addItem);
  const [pending, setPending] = useState<number | null>(null);
  const { data: product } = useQuery({
    queryKey: ["gift-card-product"],
    queryFn: () => getProductByHandle(GIFT_CARD_HANDLE),
    staleTime: 10 * 60_000,
  });

  const add = async (face: number, node: ShopifyProductNode | null | undefined) => {
    const v = node?.variants.edges
      .map((e) => e.node)
      .find((x) => Math.abs(Number(x.price.amount) - face) < 0.001 && x.availableForSale);
    if (!node || !v) {
      toast.error("This gift card isn't available right now");
      return;
    }
    setPending(face);
    try {
      await addItem({
        product: { node },
        variantId: v.id,
        variantTitle: `${face} JOD`,
        price: v.price,
        compareAtPrice: null,
        quantity: 1,
        selectedOptions: v.selectedOptions.filter((o) => o.name !== "Title"),
      });
      trackAddToCart({
        id: v.id,
        name: node.title,
        handle: node.handle,
        variant: v.title,
        price: Number(v.price.amount),
        currency: v.price.currencyCode,
        quantity: 1,
      });
      toast.success("Added to cart", { description: `Fyxx Gift Card ${face} JOD` });
      onAdded();
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <ul className="space-y-2.5">
        {FACE_VALUES.map((face) => {
          const now = Math.round(face * (1 - DISCOUNT) * 1000) / 1000;
          return (
            <Row key={face}>
              <MiniCard face={face} />
              <div className="min-w-0 flex-1">
                <p className="ff-subline text-sm leading-tight text-ff-black">
                  Fyxx Gift Card {face} JOD
                </p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                  <s className="ff-small text-xs text-ff-black/55 tabular-nums">
                    {formatJod(face)}
                  </s>
                  <span className="ff-num text-sm font-bold text-ff-red tabular-nums">
                    {formatJod(now)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void add(face, product)}
                className="ff-subline inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-ff-red px-3 text-xs text-ff-cream hover:bg-ff-burgundy disabled:opacity-60"
              >
                {pending === face ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add to cart
              </button>
            </Row>
          );
        })}
      </ul>
      <p className="ff-small mt-3 text-xs text-ff-black/60">The 10% comes off at checkout.</p>
    </>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-ff-black/10 bg-white/60 p-2.5">
      {children}
    </li>
  );
}

function MiniCard({ face }: { face: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex aspect-[1.586] w-14 shrink-0 flex-col items-center justify-center rounded-md bg-ff-black text-ff-cream shadow-sm"
    >
      <span style={SERIF} className="text-[11px] leading-none">
        {face}
      </span>
      <span style={SERIF} className="text-[7px] italic leading-none">
        fyxx
      </span>
    </span>
  );
}
