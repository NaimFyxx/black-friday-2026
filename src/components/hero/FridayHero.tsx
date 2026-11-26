import { useEffect } from "react";

import { GiftCardSticker } from "@/components/hero/GiftCardSticker";
import { HeroFreeBottles } from "@/components/rewards/FreeBottlesStrip";
import type { TeaserInfo } from "@/lib/teaser";

/**
 * The opening block of the home page (before and during the sale): burgundy,
 * like Andrea's Post-01. The cream "fyxx Friday" logo with the four campaign
 * bottles, the floating gift card, and the free gift progress folded in below
 * (no separate section). Replaced the teaser hero (headline, countdown,
 * reminder, button) on 27 Nov.
 */
export function FridayHero({
  info,
  onSaleStarted,
}: {
  info: TeaserInfo;
  onSaleStarted: () => void;
}) {
  // The countdown used to refresh the page at 10:00; keep that without showing it.
  useEffect(() => {
    if (info.state !== "preview" || !info.sale_start) return;
    const ms = new Date(info.sale_start).getTime() - Date.now();
    if (ms <= 0 || ms > 2_147_000_000) return;
    const t = window.setTimeout(onSaleStarted, ms + 1000);
    return () => window.clearTimeout(t);
  }, [info.state, info.sale_start, onSaleStarted]);

  return (
    <section aria-label="Fyxx Friday" className="relative bg-ff-burgundy text-ff-cream">
      <GiftCardSticker />
      <div className="mx-auto max-w-[1100px] px-4 pt-2.5 pb-3 md:px-10 md:pt-10 md:pb-10">
        <div className="flex items-end justify-center">
          <img
            src="/brand/fyxx-friday-logo-cream.svg"
            alt="Fyxx Friday"
            width={2587}
            height={1446}
            fetchPriority="high"
            className="h-auto w-[31vw] max-w-[420px] md:w-[50vw]"
          />
          <img
            src="/brand/fyxx-friday-bottles-360.webp"
            srcSet="/brand/fyxx-friday-bottles-360.webp 360w, /brand/fyxx-friday-bottles-600.webp 600w"
            sizes="(min-width: 768px) 260px, 30vw"
            alt=""
            aria-hidden="true"
            width={360}
            height={459}
            fetchPriority="high"
            className="-ml-[2vw] h-auto w-[15vw] max-w-[260px] md:-ml-6 md:w-[30vw]"
          />
        </div>
        {info.updating && (
          <p className="ff-subline mt-4 text-center text-sm text-ff-cream" role="status">
            {info.copy.teaser_updating_note || "Prices are updating, refresh in a few minutes"}
          </p>
        )}
        <HeroFreeBottles className="mt-2.5 md:mt-7" />
      </div>
    </section>
  );
}
