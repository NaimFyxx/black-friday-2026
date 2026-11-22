// Hidden preview: ?preview=friday shows the sale version, ?preview=ended the
// after-sale page, ?preview=updating the "prices are updating" safety-net
// state, ?preview=off goes back to normal. With an admin login, the Friday
// preview shows the planned Friday prices (see preview-sim.functions.ts). Display only: the
// database functions use it to pick the sale state; prices are only ever read
// from Shopify, never changed. Kept in a session cookie (ends when the browser
// closes) so every page follows it. Never linked; preview pages are noindex.

import { useRouteContext } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestUrl, setCookie } from "@tanstack/react-start/server";

export type Preview = "friday" | "ended" | "updating";
const COOKIE = "bf_preview";

const parse = (v: string | null | undefined): Preview | "off" | null =>
  v === "friday" || v === "ended" || v === "updating" || v === "off" ? v : null;

export const readPreview = createIsomorphicFn()
  .server((): Preview | null => {
    try {
      const fromUrl = parse(getRequestUrl().searchParams.get("preview"));
      if (fromUrl === "off") {
        setCookie(COOKIE, "", { path: "/", maxAge: 0 });
        return null;
      }
      if (fromUrl) {
        setCookie(COOKIE, fromUrl, { path: "/", sameSite: "lax" });
        return fromUrl;
      }
      const c = parse(getCookie(COOKIE));
      return c === "off" ? null : c;
    } catch {
      return null;
    }
  })
  .client((): Preview | null => {
    try {
      const fromUrl = parse(new URLSearchParams(window.location.search).get("preview"));
      if (fromUrl === "off") {
        document.cookie = `${COOKIE}=; path=/; max-age=0`;
        return null;
      }
      if (fromUrl) {
        document.cookie = `${COOKIE}=${fromUrl}; path=/; samesite=lax`;
        return fromUrl;
      }
      const m = document.cookie.match(/(?:^|;\s*)bf_preview=(friday|ended|updating)/);
      return (m?.[1] as Preview | undefined) ?? null;
    } catch {
      return null;
    }
  });

/** The current preview (null = normal site), from the root route context. */
export function usePreview(): Preview | null {
  return useRouteContext({ from: "__root__" }).preview ?? null;
}

/** True when an admin is viewing ?preview=friday: planned Friday prices. */
export function useSim(): boolean {
  return useRouteContext({ from: "__root__" }).sim === true;
}
