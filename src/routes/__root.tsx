import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { Toaster } from "../components/ui/sonner";
import { useCartSync } from "../hooks/useCartSync";
import { useKlaviyoFormsOff } from "../hooks/useKlaviyoFormsOff";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CAMPAIGN_NAME, trackCampaignView, trackPixelPageView } from "../lib/analytics";
import { captureUtmFromUrl } from "../lib/utm-attribution";
import { getTrackingState, reportClientError } from "../lib/track.functions";

// Send a client error to the /admin error log. Deduped per page load so one
// crash loop can't spam it, and capped at 5 reports per page.
const reportedErrors = new Set<string>();
function logClientError(area: string, message: string, stack?: string) {
  if (typeof window === "undefined") return;
  const key = `${area}:${message}`.slice(0, 200);
  if (reportedErrors.has(key) || reportedErrors.size >= 5) return;
  reportedErrors.add(key);
  reportClientError({
    data: {
      area,
      message: message.slice(0, 1000) || "Unknown error",
      stack: stack?.slice(0, 2000),
      path: window.location.pathname.slice(0, 300),
    },
  }).catch(() => {});
}

// Tracking IDs — the same accounts the Christmas, Valentine's and Fyxx Cup
// campaign sites use, so all campaigns can be compared side by side.
const GA_ID = "G-N6PW62SXRQ";
// "FYXX | Main pixel (Shopify)": the only Meta pixel Fyxx uses. The Shopify
// Facebook & Instagram app fires Purchase on checkout with this same ID, so this
// site must NEVER fire Purchase (it would double count).
export const META_PIXEL_ID = "1207780626389959";
const KLAVIYO_COMPANY_ID = "XuTPpc";
// Microsoft Clarity project for the Black Friday site only (its own project,
// not shared with the Christmas / Valentine's / Fyxx Cup pages).
const CLARITY_ID = "zep1cjcaqz";

// Used instead of TRACKING_SNIPPET when tracking is switched off in /admin
// (site-wide, or for this device): silent no-op stubs so the app's tracking
// calls do nothing, and no third-party script is loaded at all.
const NO_TRACKING_SNIPPET = `
window.__bfTrackingOff = true;
window.dataLayer = [];
window.gtag = function(){};
window.fbq = function(){};
window.clarity = function(){};
`.trim();

// Runs before the app hydrates. The Meta Pixel loads immediately with Meta's
// standard base code (PageView on load; later client-side route changes fire
// PageView from RootComponent). GA/Klaviyo/Clarity are stubbed now and loaded
// on first interaction or after 3s to keep the page fast (Fyxx Cup pattern).
// Not used at all when tracking is switched off (see NO_TRACKING_SNIPPET).
const TRACKING_SNIPPET = `
(function(){
  // Run once per page load. The router can re-insert head scripts on
  // client-side navigation; without this guard that re-ran init/PageView
  // and added duplicate listeners. Later PageViews come from RootComponent.
  if (window.__bfTrackingLoaded) return;
  window.__bfTrackingLoaded = true;
  var CAMPAIGN = '${CAMPAIGN_NAME}';

  // Meta Pixel base code (standard), skipped on the private /admin pages.
  var onAdmin = location.pathname === '/admin' || location.pathname.indexOf('/admin/') === 0;
  if (!onAdmin) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${META_PIXEL_ID}');
    fbq('track', 'PageView');
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
  // Tag EVERY GA event with the campaign so Black Friday data is easy to filter
  // out of the shared GA4 property.
  gtag('set', { campaign_name: CAMPAIGN });

  // Forward uncaught JS errors to GA4 so we can see when a release breaks the
  // page for real users.
  window.__errorLog = window.__errorLog || [];
  window.addEventListener('error', function(e){
    var entry = { msg: e.message || 'Script error', src: e.filename || 'unknown', line: e.lineno || 0, col: e.colno || 0, ts: Date.now() };
    window.__errorLog.push(entry);
    gtag('event', 'js_error', { error_message: String(entry.msg).substring(0,150), error_source: entry.src, error_line: entry.line, campaign_name: CAMPAIGN });
  });
  window.addEventListener('unhandledrejection', function(e){
    var reason = e.reason ? (e.reason.message || String(e.reason)).substring(0,150) : 'unknown';
    window.__errorLog.push({ msg: reason, src: 'unhandled_promise', ts: Date.now() });
    gtag('event', 'js_error', { error_message: reason, error_source: 'unhandled_promise', campaign_name: CAMPAIGN });
  });

  // Did the visitor arrive from the FYXX app? (?from=app)
  var fromApp = new URLSearchParams(location.search).get('from') === 'app';

  var gaLoaded = false, kvLoaded = false, clLoaded = false;

  function loadGA(){
    if (gaLoaded) return; gaLoaded = true;
    var s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
    document.head.appendChild(s);
    gtag('config', '${GA_ID}', { page_path: location.pathname + location.search });
    if (fromApp) {
      gtag('event', 'came_from_app', { source: 'app', destination: CAMPAIGN, campaign_name: CAMPAIGN });
      gtag('set', 'user_properties', { traffic_source: 'app' });
    }
  }
  function loadKV(){
    if (kvLoaded) return; kvLoaded = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}';
    document.head.appendChild(s);
  }
  function loadClarity(){
    if (clLoaded) return; clLoaded = true;
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, 'clarity', 'script', '${CLARITY_ID}');
    window.clarity('set', 'campaign_name', CAMPAIGN);
    if (fromApp) window.clarity('set', 'traffic_source', 'app');
  }

  // Scroll-depth milestones -> GA (25 / 50 / 75 / 90%)
  (function(){
    var thresholds = [25,50,75,90], fired = {}, ticking = false;
    function pct(){
      var dh = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      var wh = window.innerHeight, st = window.scrollY || document.documentElement.scrollTop;
      return dh > wh ? Math.round((st / (dh - wh)) * 100) : 0;
    }
    window.addEventListener('scroll', function(){
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function(){
        var p = pct();
        thresholds.forEach(function(th){
          if (p >= th && !fired[th]) {
            fired[th] = true;
            gtag('event', 'scroll_depth', { percent_scrolled: th, page_path: location.pathname, campaign_name: CAMPAIGN });
          }
        });
        ticking = false;
      });
    }, { passive: true });
  })();

  // Defer all SDK loads until first interaction (or 3s) to keep the page fast.
  var events = ['scroll','click','touchstart','mousemove','keydown'];
  function go(){
    loadGA(); loadKV(); loadClarity();
    events.forEach(function(e){ document.removeEventListener(e, go); });
  }
  events.forEach(function(e){ document.addEventListener(e, go, { passive: true, once: true }); });
  setTimeout(go, 3000);
})();
`.trim();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            search={{}}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-[11px] tracking-[0.18em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    const err = error as { message?: string; stack?: string } | null;
    logClientError("page_crash", err?.message ?? String(error), err?.stack);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-[11px] tracking-[0.18em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input px-5 py-2 text-[11px] tracking-[0.18em] uppercase transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Ask the server once per full page load whether to track this visitor
  // (the /admin Tracking switches). Fails open: an error means "track".
  loader: async () => {
    try {
      return await getTrackingState();
    } catch {
      return { enabled: true };
    }
  },
  shouldReload: false,
  head: ({ loaderData }) => ({
    // Each content route, / included, sets its own head(). No og:image here on purpose:
    // every page without its own would inherit this one.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fyxx: Wine, Spirits & Cigars in Amman" },
      {
        name: "description",
        content:
          "Fyxx Black Friday 2026: browse the full Amman cellar of wine, spirits and cigars and check out in a few taps.",
      },
      { property: "og:title", content: "Fyxx: Wine, Spirits & Cigars in Amman" },
      {
        property: "og:description",
        content:
          "Browse every wine, spirit and cigar in the Fyxx cellar and check out securely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Fyxx Friday logo icon (cream on burgundy), generated from public/brand logo SVG.
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      // Fyxx Friday font: Aktiv Grotesk from the Fyxx Adobe Fonts kit (xse1zxg,
      // same kit as the Christmas / Valentine's sites).
      { rel: "preconnect", href: "https://use.typekit.net", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://p.typekit.net", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://use.typekit.net/xse1zxg.css" },
      { rel: "preconnect", href: "https://www.googletagmanager.com" },
      { rel: "preconnect", href: "https://static.klaviyo.com" },
      { rel: "preconnect", href: "https://connect.facebook.net" },
      { rel: "preconnect", href: "https://www.clarity.ms" },
    ],
    // Marketing + analytics stack shared with the Christmas, Valentine's and
    // Fyxx Cup campaign sites: GA4, Meta Pixel, Klaviyo, Microsoft Clarity,
    // JS-error forwarding, ?from=app detection and scroll-depth milestones.
    scripts: [{ children: loaderData?.enabled === false ? NO_TRACKING_SNIPPET : TRACKING_SNIPPET }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Meta Pixel <noscript> fallback: only when tracking is on, never on /admin.
  const trackingEnabled = Route.useLoaderData()?.enabled !== false;
  const isAdmin = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin"),
  });
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {trackingEnabled && !isAdmin && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        )}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useCartSync();
  useKlaviyoFormsOff();
  // Capture utm_* / ?from=app on landing (any page), first-touch, then tag the
  // session in GA with that source.
  const isAdminPage = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin"),
  });
  const router = useRouter();
  // Meta Pixel: PageView on every client-side page change (the first one fires
  // from the base code). Counts real navigations only: a new history entry or
  // back/forward. The search box's live "replace" URL updates don't count.
  useEffect(() => {
    const index = (state: unknown) => (state as { __TSR_index?: number } | undefined)?.__TSR_index;
    return router.subscribe("onLoad", (event) => {
      if (!event.hrefChanged || !event.fromLocation) return;
      const from = index(event.fromLocation.state);
      const to = index(event.toLocation.state);
      const isReplace = from !== undefined && to !== undefined && from === to;
      if (isReplace) return;
      if (event.toLocation.pathname.startsWith("/admin")) return;
      trackPixelPageView();
    });
  }, [router]);
  useEffect(() => {
    captureUtmFromUrl();
    // Admin visits aren't shoppers: keep them out of the visit counts.
    if (!window.location.pathname.startsWith("/admin")) trackCampaignView();
  }, []);
  // Uncaught JS errors and failed promises -> /admin error log.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // "Script error." with no detail comes from cross-origin third-party
      // scripts (GA, Pixel, Clarity): undiagnosable noise, so keep it out of
      // the admin log (it still goes to GA as js_error).
      if (!e.error && /^Script error\.?$/i.test(e.message || "Script error.")) return;
      logClientError("js_error", e.message, e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      logClientError("unhandled_promise", r?.message ?? String(e.reason), r?.stack);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!isAdminPage && <SiteHeader />}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {!isAdminPage && <SiteFooter />}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
