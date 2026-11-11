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
import { SiteHeader } from "../components/SiteHeader";
import { Toaster } from "../components/ui/sonner";
import { useCartSync } from "../hooks/useCartSync";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CAMPAIGN_NAME, trackCampaignView } from "../lib/analytics";
import { captureUtmFromUrl } from "../lib/utm-attribution";
import { reportClientError } from "../lib/track.functions";

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
const META_PIXEL_ID = "298343128719993";
const KLAVIYO_COMPANY_ID = "XuTPpc";
// Clarity project shared by the Christmas + Valentine's landing pages.
const CLARITY_ID = "l993kg87k8";

// Runs before the app hydrates. Stubs gtag/fbq immediately (so early events
// queue), then loads the real SDKs on first interaction or after 3s to keep
// the page fast — the same pattern as the Fyxx Cup site.
const TRACKING_SNIPPET = `
(function(){
  var CAMPAIGN = '${CAMPAIGN_NAME}';
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

  // Meta Pixel stub — queues fbq() calls until the SDK finishes loading.
  window.fbq = window.fbq || function(){ (window.fbq.q = window.fbq.q || []).push(arguments); };
  window._fbq = window.fbq;

  var gaLoaded = false, kvLoaded = false, pxLoaded = false, clLoaded = false;

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
  function loadPixel(){
    if (pxLoaded) return; pxLoaded = true;
    // init + PageView go into the queue first; the SDK replays it on load.
    fbq('init', '${META_PIXEL_ID}');
    fbq('track', 'PageView');
    fbq('trackCustom', 'CampaignView', { content_name: 'fyxx_' + CAMPAIGN, content_category: 'seasonal_campaign', content_type: 'landing_page' });
    if (fromApp) fbq('trackCustom', 'FromApp', { campaign_name: CAMPAIGN });
    var t = document.createElement('script');
    t.async = true; t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(t);
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
    loadGA(); loadKV(); loadPixel(); loadClarity();
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
            search={{ q: undefined, category: "all" }}
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
  head: () => ({
    // Each content route, / included, sets its own head(). No og:image here on purpose:
    // every page without its own would inherit this one.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fyxx — Wine, Spirits & Cigars in Amman" },
      {
        name: "description",
        content:
          "Fyxx Black Friday 2026: browse the full Amman cellar of wine, spirits and cigars and check out with Shopify.",
      },
      { property: "og:title", content: "Fyxx — Wine, Spirits & Cigars in Amman" },
      {
        property: "og:description",
        content:
          "Browse every wine, spirit and cigar in the Fyxx cellar and check out securely through Shopify.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300;400;500;600&display=swap",
      },
      { rel: "preconnect", href: "https://www.googletagmanager.com" },
      { rel: "preconnect", href: "https://static.klaviyo.com" },
      { rel: "preconnect", href: "https://connect.facebook.net" },
      { rel: "preconnect", href: "https://www.clarity.ms" },
    ],
    // Marketing + analytics stack shared with the Christmas, Valentine's and
    // Fyxx Cup campaign sites: GA4, Meta Pixel, Klaviyo, Microsoft Clarity,
    // JS-error forwarding, ?from=app detection and scroll-depth milestones.
    scripts: [{ children: TRACKING_SNIPPET }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useCartSync();
  // Capture utm_* / ?from=app on landing (any page), first-touch, then tag the
  // session in GA with that source.
  const isAdminPage = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin"),
  });
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
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
