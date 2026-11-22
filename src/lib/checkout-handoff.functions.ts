// Checkout that stays in the browser when the Fyxx app (Shopney) is installed.
//
// Why: the Fyxx app claims myfyxx.com links on phones (universal links /
// Android App Links) EXCEPT checkout pages (/checkouts/...). Shopify's cart
// checkout link is www.myfyxx.com/cart/c/..., which the app grabs, so app users
// landed in the app with an empty cart. That link only forwards to
// /checkouts/cn/... and sets one cookie (_shopify_essential) the checkout needs.
//
// What this does: our server opens the cart link itself (no forwarding), reads
// the real checkout address and that cookie, and gives the cookie to the
// shopper's browser for myfyxx.com, limited to /checkouts pages and 2 hours
// (the more specific path makes browsers send it before any older Shopify
// cookie). The shopper then goes straight to /checkouts/..., which the app
// ignores. Any failure returns null and the site falls back to the normal
// checkout link, so checkout never breaks because of this.
// Nothing here changes the cart or prices; the checkout address comes from
// Shopify's own response.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_CART_HOSTS = new Set(["www.myfyxx.com", "myfyxx.com", "drynksapp.myshopify.com"]);
const COOKIE = "_shopify_essential";

export const prepareCheckout = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data }): Promise<{ url: string } | null> => {
    try {
      const { getRequestHost, setCookie } = await import("@tanstack/react-start/server");
      // The cookie can only be handed over when the site itself runs on a
      // myfyxx.com address (friday.myfyxx.com); previews use the normal link.
      const host = (getRequestHost() ?? "").split(":")[0] ?? "";
      if (!(host === "myfyxx.com" || host.endsWith(".myfyxx.com"))) return null;

      const cart = new URL(data.url);
      if (!ALLOWED_CART_HOSTS.has(cart.host) || !cart.pathname.startsWith("/cart/c/")) return null;

      const res = await fetch(cart.toString(), {
        redirect: "manual",
        headers: { "user-agent": "Mozilla/5.0 (FyxxFriday checkout handoff)" },
      });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) return null;
      const target = new URL(location, cart);
      if (target.host !== "www.myfyxx.com" || !target.pathname.startsWith("/checkouts/"))
        return null;

      const setCookies =
        typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie ===
        "function"
          ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
          : [res.headers.get("set-cookie") ?? ""];
      const value = setCookies
        .map((c) => c.split(";")[0] ?? "")
        .find((c) => c.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1);
      if (!value) return null;

      setCookie(COOKIE, value, {
        // keep Shopify's value byte for byte
        encode: (v: string) => v,
        domain: "myfyxx.com",
        path: "/checkouts",
        maxAge: 2 * 60 * 60,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      });
      return { url: target.toString() };
    } catch {
      return null;
    }
  });
