import { useEffect } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { getShortLinkTarget } from "@/lib/short-links.functions";
import { redirectPageMeta } from "@/lib/redirect-paths";

// Catch-all short-link route: friday.myfyxx.com/<slug>
//
// Ranked below every real route (TanStack matches static paths like /admin,
// /pairings, /product/x and / first), so nothing current breaks. If the slug is
// a live short link it serves the landing page's link preview and redirects to
// the destination (with UTMs) using window.location.replace. Otherwise it is a
// normal 404, exactly as before this route existed.
//
// Tracking is handled in __root.tsx: a live slug is flagged as a redirect page
// (no GA4, Meta Pixel or Supabase visit), so the single page view fires on the
// final URL. An unknown slug tracks like any 404 did before.
export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const { target } = await getShortLinkTarget({ data: { slug: params.slug } });
    if (!target) throw notFound();
    return { target };
  },
  head: () => ({ meta: redirectPageMeta() }),
  component: SlugRedirect,
});

function SlugRedirect() {
  const { target } = Route.useLoaderData();
  useEffect(() => {
    // replace, not assign/push: the slug never becomes a back-button step.
    window.location.replace(target);
  }, [target]);

  // Shown only for the moment before the redirect, and for the rare visitor
  // with JavaScript off (a crawler reads the og: tags above and ignores this).
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm text-muted-foreground">Taking you to Fyxx Friday.</p>
        <p className="mt-4">
          <a
            href={target}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-[11px] tracking-[0.18em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Continue
          </a>
        </p>
      </div>
    </main>
  );
}
