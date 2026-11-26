// Short-link redirect pages (e.g. friday.myfyxx.com/wa).
//
// A redirect page serves the landing page's link preview (so WhatsApp,
// Instagram and Facebook unfurl it), then window.location.replace to the real
// URL with UTMs. No tracking runs on them: GA4, the Meta Pixel and the Supabase
// visit all fire once on the final URL instead, never on the redirect path.
//
// Short links live in the short_links table and are served by the /:slug route.
// __root.tsx asks isActiveShortLink() whether the current path is a live slug;
// if so it swaps in the no-tracking snippet and drops the <noscript> pixel.

// Real single-segment routes that must never be treated as a short-link slug.
const KNOWN_SINGLE_SEGMENT_ROUTES = new Set(["admin", "pairings"]);

// One bare segment of slug characters (letters, numbers, dashes), 1-64 long.
const SLUG_PATH_RE = /^[a-z0-9-]{1,64}$/;

/**
 * The slug a bare single-segment path could be, or null. Returns null for the
 * home page, multi-segment paths (e.g. /product/x), asset paths with a dot, and
 * the app's own single-segment routes. Lets __root.tsx decide whether to run a
 * short-link lookup without touching the database for ordinary pages.
 */
export function slugFromPath(pathname: string): string | null {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("/")) return null;
  const seg = clean.toLowerCase();
  if (!SLUG_PATH_RE.test(seg)) return null;
  if (KNOWN_SINGLE_SEGMENT_ROUTES.has(seg)) return null;
  return seg;
}

// The landing page's link preview, reused on every short-link redirect page so
// a shared friday.myfyxx.com/<slug> unfurls exactly like friday.myfyxx.com/.
const OG_IMAGE = "https://friday.myfyxx.com/brand/og-fyxx-friday.jpg";
const OG_TITLE = "Fyxx Friday | 27 November";
const OG_DESCRIPTION =
  "Fyxx Friday. One day only, Friday 27 November from 10:00. Up to 50% off. Wine, spirits, cigars and accessories marked down, delivered in Amman.";

/** <head> meta for a short-link redirect page: the landing preview, noindex. */
export function redirectPageMeta() {
  return [
    { title: OG_TITLE },
    { name: "description", content: OG_DESCRIPTION },
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
  ];
}
