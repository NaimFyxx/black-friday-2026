// Short-link redirect pages (e.g. /wa).
//
// These pages serve the landing page's link preview (so WhatsApp, Instagram
// and Facebook unfurl them), then window.location.replace to the real URL with
// UTMs. No tracking runs on them: GA4, the Meta Pixel and the Supabase visit
// all fire once on the final URL instead, never on the redirect path itself.
//
// __root.tsx reads isRedirectPath() to swap in the no-tracking snippet and to
// drop the <noscript> pixel for these paths.

/** Static redirect paths that always exist in the app (not database slugs). */
export const STATIC_REDIRECT_PATHS = new Set(["/wa"]);

/** True when this path is a short-link redirect page, so tracking must be off. */
export function isRedirectPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return STATIC_REDIRECT_PATHS.has(clean);
}
