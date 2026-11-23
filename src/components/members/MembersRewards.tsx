import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Thin "Members earn up to 2x points" line under the hero; tap to open the
 * tiers. Compact Fyxx Rewards strip in the Fyxx Rewards look
 * (FYXX_Web-Rewards palette: warm black #231F20, cream #FBF5F2, muted #8A8175,
 * Baskervville serif, the membership-card tier colours). One bar blending the
 * four tier colours, a bubble per tier with its points multiplier, and a
 * small login button. Visual only: not connected to LoyaltyLion or Shopify.
 */

/** Where "Log in to collect your points" goes. */
const LOGIN_URL = "https://www.myfyxx.com/account/login";

const INK = "#231F20";
const CREAM = "#FBF5F2";
const MUTED = "#8A8175";
const SERIF = { fontFamily: '"Baskervville", "Times New Roman", Georgia, serif' };

/** Tier card colours (light to dark) and Black Friday points multipliers. */
const TIERS = [
  { name: "Blue", points: "1.25x", from: "#C2C9E2", to: "#97A2CA" },
  { name: "Silver", points: "1.5x", from: "#C9CACD", to: "#9A9CA0" },
  { name: "Gold", points: "1.75x", from: "#F2E8BF", to: "#E2C98E" },
  { name: "Platinum", points: "2x", from: "#D2B6EE", to: "#B387CF" },
];

export function MembersRewards() {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="members-rewards" style={{ background: CREAM, color: INK }}>
      {/* One thin line; tap to see the tiers. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="members-rewards-tiers"
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex w-full max-w-[1320px] items-center justify-center gap-2 px-5 py-2 text-left md:px-10"
      >
        <img
          src="/brand/fyxx-rewards-logo-black.svg"
          alt="Fyxx Rewards"
          width={746}
          height={392}
          loading="lazy"
          className="h-6 w-auto shrink-0"
        />
        <h2 id="members-rewards" style={SERIF} className="min-w-0 text-sm md:text-base">
          Members earn up to 2x points<span className="hidden sm:inline"> this Friday</span>
        </h2>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold underline underline-offset-2">
          {open ? "Hide" : "See tiers"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div id="members-rewards-tiers" hidden={!open} className="mx-auto max-w-[640px] px-5 pb-5">
        {/* One bar in the four tier colours, a bubble per tier with its points.
            Each tier is a column; the bar runs between the first and last bubble. */}
        <div className="relative mx-auto mt-2 max-w-[520px]">
          <div
            aria-hidden="true"
            className="absolute top-[22px] right-[12.5%] left-[12.5%] h-2 -translate-y-1/2 rounded-full md:top-6"
            style={{
              background: `linear-gradient(90deg, ${TIERS.map((t) => t.to).join(", ")})`,
            }}
          />
          <ol className="relative grid grid-cols-4">
            {TIERS.map((t) => (
              <li key={t.name} className="flex flex-col items-center text-center">
                <span
                  style={{
                    ...SERIF,
                    background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                    border: `2px solid ${CREAM}`,
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm shadow-[0_2px_6px_rgba(35,31,32,0.18)] md:h-12 md:w-12 md:text-base"
                >
                  {t.points}
                </span>
                <span className="mt-1.5 text-[11px] leading-tight" style={{ color: MUTED }}>
                  <span className="font-semibold" style={{ color: INK }}>
                    {t.name}
                  </span>
                  <br />
                  {t.points} points
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 flex justify-center">
          <a
            href={LOGIN_URL}
            className="inline-flex h-9 items-center justify-center rounded-full px-5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: INK }}
          >
            Log in to collect your points
          </a>
        </div>
      </div>
    </section>
  );
}
