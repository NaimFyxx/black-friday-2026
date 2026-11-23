/**
 * "Members earn more" section in the Fyxx Rewards look (palette from
 * FYXX_Web-Rewards: warm black #231F20, cream #FBF5F2, sand #F1E3DB, gold
 * #9C7C3E, muted #8A8175, Baskervville serif, the membership-card tier
 * gradients and the orange tier-progress bar). The four tiers sit on a
 * progress-style bar with their Black Friday points multipliers.
 * Visual only for now: not connected to LoyaltyLion or Shopify.
 */

/** Where "Log in to collect your points" goes. */
const LOGIN_URL = "https://www.myfyxx.com/account/login";

const C = {
  ink: "#231F20",
  cream: "#FBF5F2",
  sand: "#F1E3DB",
  gold: "#9C7C3E",
  muted: "#8A8175",
  line: "#E5DDD4",
  barTrack: "#F9B5A5",
  barFill: "#F26424",
  dot: "#FBF4F3",
};
const SERIF = { fontFamily: '"Baskervville", "Times New Roman", Georgia, serif' };

const TIERS: Array<{
  name: string;
  multiplier: string;
  from: string;
  to: string;
  bonus?: boolean;
}> = [
  { name: "Blue", multiplier: "1.25x", from: "#C2C9E2", to: "#97A2CA" },
  { name: "Silver", multiplier: "1.5x", from: "#C9CACD", to: "#9A9CA0" },
  { name: "Gold", multiplier: "1.75x", from: "#F2E8BF", to: "#E2C98E" },
  { name: "Platinum", multiplier: "2x", from: "#D2B6EE", to: "#B387CF", bonus: true },
];

export function MembersRewards() {
  return (
    <section aria-labelledby="members-rewards" style={{ background: C.cream, color: C.ink }}>
      <div className="mx-auto max-w-[1100px] px-5 py-10 md:px-10 md:py-14">
        <img
          src="/brand/fyxx-rewards-logo-black.svg"
          alt="Fyxx Rewards"
          width={746}
          height={392}
          loading="lazy"
          className="mx-auto h-10 w-auto md:h-12"
        />
        <h2
          id="members-rewards"
          style={SERIF}
          className="mt-4 text-center text-[1.75rem] leading-tight md:text-[2.75rem]"
        >
          Members earn more this Black Friday
        </h2>
        <p
          className="mx-auto mt-2 max-w-[44ch] text-center text-sm md:text-base"
          style={{ color: C.muted }}
        >
          Every order earns points. On Friday, every tier earns faster.
        </p>

        {/* Tier bar, left to right. Decorative: it doesn't fill or respond. */}
        <div className="mt-9 md:mt-11">
          <div className="relative mx-[12.5%]">
            <div className="h-2.5 rounded-full" style={{ background: C.barTrack }}>
              <div className="h-full w-full rounded-full" style={{ background: C.barFill }} />
            </div>
            {TIERS.map((t, i) => (
              <span
                key={t.name}
                aria-hidden="true"
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full md:h-5 md:w-5"
                style={{
                  left: `${(i / (TIERS.length - 1)) * 100}%`,
                  background: C.dot,
                  border: `3px solid ${C.barFill}`,
                  boxShadow: "0 1px 4px rgba(0,0,0,.18)",
                }}
              />
            ))}
          </div>

          {/* One membership card per tier, in the tier's card gradient. */}
          <ol className="mt-5 grid grid-cols-4 gap-2 md:gap-4">
            {TIERS.map((t) => (
              <li
                key={t.name}
                className="flex flex-col items-center rounded-xl px-1 pt-2.5 pb-3 text-center shadow-[0_2px_10px_rgba(35,31,32,0.08)] md:rounded-2xl md:pt-4 md:pb-5"
                style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
              >
                <span
                  className="rounded-[3px] px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase md:text-[10px]"
                  style={{ background: "rgba(35,31,32,.12)" }}
                >
                  {t.name}
                </span>
                <span style={SERIF} className="mt-1.5 text-2xl leading-none md:mt-2 md:text-5xl">
                  {t.multiplier}
                </span>
                <span className="mt-1 text-[10px] md:text-xs" style={{ color: C.ink }}>
                  points
                </span>
                {t.bonus && (
                  <span
                    className="mt-1.5 rounded-lg px-1.5 py-0.5 text-[9px] leading-tight font-semibold md:rounded-full md:px-2 md:text-[11px]"
                    style={{ background: C.cream, color: C.gold }}
                  >
                    on Black Friday
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex justify-center md:mt-10">
          <a
            href={LOGIN_URL}
            className="inline-flex h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: C.ink }}
          >
            Log in to collect your points
          </a>
        </div>
      </div>
    </section>
  );
}
