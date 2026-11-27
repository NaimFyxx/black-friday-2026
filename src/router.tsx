import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
    // Hand the server's query cache to the browser at the router level, BEFORE
    // anything renders there. It used to be restored inside the home page
    // component, after the header (and anything above the page) had already
    // asked for the same data from an empty cache, so a slow page-code load
    // could make the first browser render differ from the server HTML (#418).
    // (Cast: the router's serializable type check can't see into Query's
    // DehydratedState; the home loader returned this same object before.)
    dehydrate: () => ({ queryState: dehydrate(queryClient) as unknown as Record<string, never> }),
    hydrate: (d: { queryState: Record<string, never> }) => {
      hydrate(queryClient, d.queryState as unknown as DehydratedState);
    },
  });

  return router;
};
