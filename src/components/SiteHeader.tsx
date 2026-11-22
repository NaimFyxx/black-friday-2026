import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "@tanstack/react-router";

import { CartDrawer } from "@/components/CartDrawer";
import { usePreview } from "@/lib/preview";
import { teaserQueryOptions } from "@/lib/teaser";
import { cn } from "@/lib/utils";

// The one site header (every shop page): burgundy with the cream Fyxx Friday
// logo, per the brand guide, and the shop sections (The Cellar, The Bar, The
// Humidor; bf_settings.nav_groups, editable on /admin). A section shows only
// its products on the landing page. Phones get the sections as a slim second
// row (fixed height, so nothing moves while the names load).
export function SiteHeader() {
  const { data } = useQuery(teaserQueryOptions(usePreview()));
  // Drawn after the page loads (server and first paint match); the rows keep
  // their height, so nothing shifts.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const groups = mounted ? (data?.nav_groups ?? []) : [];
  const search = useSearch({ strict: false }) as { group?: string };
  const active = search.group;

  const onHome = useLocation({ select: (l) => l.pathname }) === "/" && !active;
  const linkClass = (on: boolean) =>
    cn(
      "whitespace-nowrap border-b-2 pb-0.5 transition-colors",
      on ? "border-ff-red text-ff-cream" : "border-transparent hover:text-ff-red",
    );

  // "Home" first (top of the landing page, no section), then the sections.
  const home = groups.length > 0 && (
    <Link
      key="~home"
      to="/"
      search={{}}
      hash="top"
      aria-current={onHome ? "page" : undefined}
      className={linkClass(onHome)}
    >
      Home
    </Link>
  );

  const links = groups.map((g) => (
    <Link
      key={g}
      to="/"
      search={{ group: g }}
      hash="shop"
      aria-current={active === g ? "page" : undefined}
      className={linkClass(active === g)}
    >
      {g}
    </Link>
  ));

  return (
    <header className="sticky top-0 z-40 bg-ff-burgundy text-ff-cream">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 md:h-[88px] md:gap-6 md:px-10">
        <Link
          to="/"
          search={{}}
          hash="top"
          aria-label="Fyxx Friday home"
          className="block shrink-0"
        >
          <img
            src="/brand/fyxx-friday-logo-cream.svg"
            alt="Fyxx Friday"
            width={2587}
            height={1446}
            className="h-10 w-auto md:h-14"
          />
        </Link>

        <nav
          aria-label="Shop sections"
          className="ff-subline hidden items-center gap-9 text-sm tracking-wide uppercase md:flex"
        >
          {home}
          {links}
        </nav>

        <div className="flex items-center gap-3">
          <CartDrawer />
        </div>
      </div>

      {/* Phones: the sections on their own row */}
      <nav
        aria-label="Shop sections"
        className="ff-subline flex h-9 items-center justify-center gap-4 border-t px-3 min-[380px]:gap-6 border-ff-cream/15 text-xs tracking-wide uppercase md:hidden"
      >
        {home}
        {links}
      </nav>
    </header>
  );
}
