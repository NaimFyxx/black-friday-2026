import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("ranks the short-link catch-all below every real route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const leaf = (path: string) => router.matchRoutes(path).at(-1)?.routeId;

    // Real routes always win over /$slug.
    expect(leaf("/")).toBe("/");
    expect(leaf("/pairings")).toBe("/pairings");
    expect(leaf("/admin")).toBe("/admin/");
    expect(leaf("/product/some-handle")).toBe("/product/$handle");

    // A bare word that is not a real route falls through to the short-link route.
    expect(leaf("/wa")).toBe("/$slug");
    expect(leaf("/anything-else")).toBe("/$slug");
  });
});
