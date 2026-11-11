import { Link } from "@tanstack/react-router";

import { CartDrawer } from "@/components/CartDrawer";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/shopify";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-primary px-6 py-2 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-[10px] tracking-[0.22em] uppercase">
            Get Your Fyxx Daily from 10 AM till Midnight
          </p>
          <p className="hidden text-[10px] tracking-[0.22em] uppercase sm:block">
            Wine · Spirits · Cigars — Amman
          </p>
        </div>
      </div>

      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <Link
            to="/"
            search={{ q: undefined, category: "all" }}
            className="font-display text-2xl leading-none italic"
          >
            fyxx
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                to="/"
                search={{ q: undefined, category }}
                className="rounded-full px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors hover:bg-secondary"
              >
                {CATEGORY_LABELS[category]}
              </Link>
            ))}
          </nav>

          <CartDrawer />
        </div>
      </div>
    </header>
  );
}
