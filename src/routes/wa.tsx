import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

// Short link: friday.myfyxx.com/wa
//
// Opens the landing page with the WhatsApp UTM tags added, using
// window.location.replace so the back button does not loop back here.
//
// Why this is a real 200 page (not a server redirect): the link is shared on
// WhatsApp, Instagram and Facebook, whose preview crawlers must read the og:
// tags straight from /wa. So /wa serves the same preview as the landing page
// and only real browsers run the redirect.
//
// Tracking: /wa is flagged as a redirect page in __root.tsx, so GA4, the Meta
// Pixel and the Supabase visit log are all switched off here. The single page
// view (with the UTMs) fires on the final URL after the replace, never on /wa.
const WA_TARGET = "/?utm_source=whatsapp&utm_medium=social&utm_campaign=fyxx-friday-2026-11-27";

// The landing page's link preview (same og: title, description and image), so
// a shared friday.myfyxx.com/wa link unfurls exactly like friday.myfyxx.com/.
const OG_IMAGE = "https://friday.myfyxx.com/brand/og-fyxx-friday.jpg";
const OG_TITLE = "Fyxx Friday | 27 November";
const OG_DESCRIPTION =
  "Fyxx Friday. One day only, Friday 27 November from 10:00. Up to 50% off. Wine, spirits, cigars and accessories marked down, delivered in Amman.";

export const Route = createFileRoute("/wa")({
  head: () => ({
    meta: [
      { title: OG_TITLE },
      { name: "description", content: OG_DESCRIPTION },
      // A redirect page: let crawlers read the preview and follow, but keep it
      // out of the search index.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: OG_TITLE },
      { property: "og:description", content: OG_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://friday.myfyxx.com/" },
      { property: "og:site_name", content: "Fyxx" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Fyxx Friday, Friday 27 November from 10:00. One day only.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: OG_TITLE },
      { name: "twitter:description", content: OG_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
  }),
  component: WaRedirect,
});

function WaRedirect() {
  useEffect(() => {
    // replace, not assign/push: /wa never becomes a back-button step.
    window.location.replace(WA_TARGET);
  }, []);

  // Shown only for the moment before the redirect, and for the rare visitor
  // with JavaScript off (a crawler reads the og: tags above and ignores this).
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm text-muted-foreground">Taking you to Fyxx Friday.</p>
        <p className="mt-4">
          <a
            href={WA_TARGET}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-[11px] tracking-[0.18em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Continue
          </a>
        </p>
      </div>
    </main>
  );
}
