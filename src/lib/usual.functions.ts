// "Your usual" shelf: products this shopper has ordered before.
//
// A visitor who opens the site from one of our Klaviyo emails carries Klaviyo's
// `_kx` link parameter. The server swaps it (through bf-admin, with the Klaviyo
// private key) for the Shopify product IDs they ordered most. Only those
// product IDs go back to the browser, never the email or profile; the browser
// keeps them (localStorage) so the shelf is still there on the next visit.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const lookupUsual = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ kx: z.string().regex(/^[A-Za-z0-9_\-.=]{6,200}$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ids: string[] }> => {
    try {
      const { callBfAdmin } = await import("./bf-edge.server");
      const r = await callBfAdmin<{ status: string; products?: unknown[] }>({
        action: "usual",
        kx: data.kx,
      });
      if (r.status !== "ok" || !Array.isArray(r.products)) return { ids: [] };
      return {
        ids: r.products
          .map(String)
          .filter((s) => /^\d+$/.test(s))
          .slice(0, 40),
      };
    } catch {
      return { ids: [] };
    }
  });
