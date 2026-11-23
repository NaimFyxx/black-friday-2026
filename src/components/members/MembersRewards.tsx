/**
 * "Members earn more" section: the four Fyxx Rewards tiers on a progress-style
 * bar with their Black Friday points multipliers, and a login button.
 * Visual only for now: tiers, multipliers and the link are set here (not
 * connected to LoyaltyLion or Shopify yet).
 */

/** Where "Log in to collect your points" goes. */
const LOGIN_URL = "https://www.myfyxx.com/account/login";

const TIERS: Array<{ name: string; multiplier: string; color: string; bonus?: boolean }> = [
  { name: "Blue", multiplier: "1.25x", color: "#2f6fd6" },
  { name: "Silver", multiplier: "1.5x", color: "#a9adb3" },
  { name: "Gold", multiplier: "1.75x", color: "#c9a227" },
  { name: "Platinum", multiplier: "2x", color: "#e3e1dc", bonus: true },
];

export function MembersRewards() {
  return (
    <section
      aria-labelledby="members-rewards"
      className="border-b border-ff-cream/10 bg-ff-black text-ff-cream"
    >
      <div className="mx-auto max-w-[1100px] px-5 py-10 md:px-10 md:py-14">
        <p className="ff-small text-center text-[11px] tracking-[0.25em] text-ff-cream/60 uppercase">
          Fyxx Rewards
        </p>
        <h2
          id="members-rewards"
          className="ff-headline mt-2 text-center text-2xl text-ff-cream md:text-4xl"
        >
          Members earn more this Black Friday
        </h2>
        <p className="ff-subline mx-auto mt-2 max-w-[44ch] text-center text-sm text-ff-cream/75 md:text-base">
          Every order earns points. On Friday, every tier earns faster.
        </p>

        {/* The tiers on one bar, left to right. Decorative: it doesn't fill. */}
        <div className="mt-8 md:mt-10">
          <div className="relative mx-[12.5%]">
            <div
              aria-hidden="true"
              className="h-2 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${TIERS.map((t) => t.color).join(", ")})`,
              }}
            />
            {TIERS.map((t, i) => (
              <span
                key={t.name}
                aria-hidden="true"
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ff-black shadow-[0_0_0_2px_rgba(243,239,234,0.25)]"
                style={{ left: `${(i / (TIERS.length - 1)) * 100}%`, background: t.color }}
              />
            ))}
          </div>
          <ol className="mt-4 grid grid-cols-4">
            {TIERS.map((t) => (
              <li key={t.name} className="flex flex-col items-center text-center">
                <span className="ff-subline text-xs text-ff-cream/70 md:text-sm">{t.name}</span>
                <span
                  className="ff-headline mt-0.5 text-xl md:text-3xl"
                  style={{ color: t.bonus ? "var(--color-ff-red, #f61d2f)" : undefined }}
                >
                  {t.multiplier}
                </span>
                <span className="ff-small text-[10px] text-ff-cream/60 md:text-xs">
                  points{t.bonus ? " on Black Friday" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex justify-center md:mt-10">
          <a
            href={LOGIN_URL}
            className="ff-subline inline-flex h-12 items-center justify-center rounded-full bg-ff-red px-8 text-base text-ff-cream transition-colors hover:bg-ff-cream hover:text-ff-black"
          >
            Log in to collect your points
          </a>
        </div>
      </div>
    </section>
  );
}
