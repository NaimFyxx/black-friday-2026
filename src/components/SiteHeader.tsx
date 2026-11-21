import { Link } from "@tanstack/react-router";

import { CartDrawer } from "@/components/CartDrawer";

// The one site header (every shop page): burgundy with the cream Fyxx Friday
// logo, per the brand guide. Links go to the homepage sections so they also
// work from a product page.
const HOME = { to: "/", search: {} } as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-ff-burgundy text-ff-cream">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3 md:gap-6 md:px-10 md:py-4">
        <Link {...HOME} hash="top" aria-label="Fyxx Friday home" className="block shrink-0">
          <img
            src="/brand/fyxx-friday-logo-cream.svg"
            alt="Fyxx Friday"
            width={2587}
            height={1446}
            className="h-10 w-auto md:h-14"
          />
        </Link>

        <nav className="hidden items-center gap-7 text-[11px] font-semibold tracking-wide uppercase md:flex">
          <Link {...HOME} hash="top" className="transition-colors hover:text-ff-red">
            Home
          </Link>
          <Link {...HOME} hash="catalog" className="transition-colors hover:text-ff-red">
            The Cellar
          </Link>
          <Link {...HOME} hash="footer" className="transition-colors hover:text-ff-red">
            About us
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <CartDrawer />
        </div>
      </div>
    </header>
  );
}
