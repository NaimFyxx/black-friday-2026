import { useEffect, useState } from "react";

import { HeroReminder } from "@/components/reminder/HeroReminder";
import { formatCountdown, type TeaserInfo } from "@/lib/teaser";

/**
 * Teaser hero (only before the sale starts). Burgundy like Andrea's Post-01 and
 * Story-01: the cream "fyxx Friday" logo SVG, the campaign bottles, the red
 * headline, a countdown to sale_start and a button that scrolls to the filters.
 * Every text comes from bf_settings (editable on /admin).
 */
export function TeaserHero({
  info,
  onStart,
  onSaleStarted,
}: {
  info: TeaserInfo;
  onStart: () => void;
  onSaleStarted: () => void;
}) {
  const { copy } = info;
  return (
    <section aria-labelledby="teaser-headline" className="bg-ff-burgundy text-ff-cream">
      <div className="mx-auto grid max-w-[1320px] items-center gap-5 px-5 pt-6 pb-8 md:px-10 md:py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:py-16">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/* Logo and bottles side by side on phones, so the button stays on the first
              screen. On phones the bottles sit next to the logo, not over "Friday". */}
          <div className="flex items-end justify-center lg:justify-start">
            <img
              src="/brand/fyxx-friday-logo-cream.svg"
              alt="Fyxx Friday"
              width={2587}
              height={1446}
              fetchPriority="high"
              className="h-auto w-[50vw] max-w-[380px] lg:w-[420px] lg:max-w-none"
            />
            <img
              src="/brand/fyxx-friday-bottles-360.webp"
              srcSet="/brand/fyxx-friday-bottles-360.webp 360w, /brand/fyxx-friday-bottles-600.webp 600w"
              sizes="(min-width: 1024px) 1px, 30vw"
              alt=""
              aria-hidden="true"
              width={360}
              height={459}
              fetchPriority="high"
              className="ml-1 h-auto w-[28vw] max-w-[220px] md:-ml-[4vw] lg:hidden"
            />
          </div>

          <h2
            id="teaser-headline"
            className="ff-headline mt-5 max-w-[16ch] text-[2rem] leading-[1.05] text-ff-red md:text-5xl lg:max-w-[14ch] lg:text-6xl"
          >
            {copy.teaser_headline}
          </h2>
          {copy.teaser_subline && (
            <p className="ff-subline mt-3 max-w-[34ch] text-base text-ff-cream md:text-xl">
              {copy.teaser_subline}
            </p>
          )}
          {info.updating ? (
            <p className="ff-subline mt-4 text-base text-ff-cream md:text-lg" role="status">
              {copy.teaser_updating_note || "Prices are updating, refresh in a few minutes"}
            </p>
          ) : (
            info.sale_start && (
              <Countdown
                target={info.sale_start}
                label={copy.teaser_countdown_label ?? ""}
                onDone={onSaleStarted}
              />
            )
          )}
          {!info.updating && <HeroReminder info={info} />}
          {copy.teaser_button && (
            <button
              id="hero-cta"
              type="button"
              onClick={onStart}
              className="ff-subline mt-5 inline-flex h-12 items-center justify-center rounded-full bg-ff-red px-8 text-base text-ff-cream transition-colors hover:bg-ff-cream hover:text-ff-burgundy"
            >
              {copy.teaser_button}
            </button>
          )}
        </div>

        <div className="hidden justify-center lg:flex">
          <img
            src="/brand/fyxx-friday-bottles-600.webp"
            srcSet="/brand/fyxx-friday-bottles-600.webp 600w, /brand/fyxx-friday-bottles.webp 942w"
            sizes="460px"
            alt=""
            aria-hidden="true"
            width={600}
            height={766}
            loading="lazy"
            className="h-auto max-h-[70vh] w-auto max-w-[460px]"
          />
        </div>
      </div>
    </section>
  );
}

function Countdown({
  target,
  label,
  onDone,
}: {
  target: string;
  label: string;
  onDone: () => void;
}) {
  const end = new Date(target).getTime();
  // null until the page has loaded in the browser: the server's clock and the
  // visitor's differ, so the digits are drawn only after hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : end - now;
  useEffect(() => {
    if (left !== null && left <= 0) onDone();
  }, [left !== null && left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <p className="ff-subline mt-4 text-base text-ff-cream md:text-lg" aria-live="off">
      {label}{" "}
      {left === null ? (
        // Same width as the digits, so nothing moves when they appear.
        <span className="ff-num invisible text-ff-red" aria-hidden>
          0d 00h 00m 00s
        </span>
      ) : (
        <span className="ff-num text-ff-red">{formatCountdown(left)}</span>
      )}
    </p>
  );
}
