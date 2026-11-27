import { useEffect } from "react";

import { SaleEndCountdown } from "@/components/hero/SaleEndCountdown";
import { GiftCardSticker } from "@/components/hero/GiftCardSticker";
import { FreeBottlesStrip } from "@/components/rewards/FreeBottlesStrip";
import type { TeaserInfo } from "@/lib/teaser";

/**
 * The opening block of the home page (before and during the sale): cream, the
 * small red "fyxx Friday" logo with the four campaign bottles, the floating gift
 * card, and the free gift progress in the same red box as the cart. A thin
 * line separates it from the products. Replaced the teaser hero (headline, countdown,
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
    <section
      aria-label="Fyxx Friday"
      className="relative border-b border-ff-black/10 bg-ff-cream text-ff-black"
    >
      <GiftCardSticker />
      <div className="mx-auto max-w-[1100px] px-4 pt-3 pb-4 md:px-10 md:pt-6 md:pb-7">
        {/* Small red logo with the four bottles (Andrea's pairing for cream). */}
        <div className="flex items-end justify-center">
          <img
            src="/brand/fyxx-friday-logo-red.svg"
            alt="Fyxx Friday"
            width={2587}
            height={1446}
            fetchPriority="high"
            className="h-auto w-[24vw] max-w-[220px]"
          />
          <img
            src="/brand/fyxx-friday-bottles-360.webp"
            alt=""
            aria-hidden="true"
            width={360}
            height={459}
            fetchPriority="high"
            className="-ml-[1vw] h-auto w-[11vw] max-w-[110px] md:-ml-3"
          />
        </div>
        {info.updating && (
          <p className="ff-subline mt-3 text-center text-sm" role="status">
            {info.copy.teaser_updating_note || "Prices are updating, refresh in a few minutes"}
          </p>
        )}
        {/* The free gift progress: the same red box as in the cart. */}
        <FreeBottlesStrip className="mx-auto mt-3 max-w-md md:mt-4" />
        {/* During the sale: "Ends at midnight 13h 59m 59s", right under the progress box. */}
        {info.state === "sale" && info.sale_end && (
          <div className="mt-2 text-center md:mt-3">
            <SaleEndCountdown
              end={info.sale_end}
              label={info.copy.sale_end_label ?? "Ends at midnight"}
              onDone={onSaleStarted}
            />
          </div>
        )}
      </div>
    </section>
  );
}
