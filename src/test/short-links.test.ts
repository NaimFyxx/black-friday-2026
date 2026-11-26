import { describe, expect, it } from "vitest";

import {
  buildShortLinkTarget,
  normalizeSlug,
  shortLinkUrl,
  slugError,
  validateDestination,
} from "@/lib/short-links";
import { redirectPageMeta, slugFromPath } from "@/lib/redirect-paths";

const WA_UTM = {
  utm_source: "whatsapp",
  utm_medium: "social",
  utm_campaign: "fyxx-friday-2026-11-27",
};

describe("short link slugs", () => {
  it("normalizes case, spaces and stray slashes", () => {
    expect(normalizeSlug("  /WA/ ")).toBe("wa");
    expect(normalizeSlug("Promo-1")).toBe("promo-1");
  });

  it("accepts plain slugs and rejects bad or reserved ones", () => {
    expect(slugError("wa")).toBeNull();
    expect(slugError("promo-1")).toBeNull();
    expect(slugError("")).not.toBeNull();
    expect(slugError("Has Space")).not.toBeNull();
    expect(slugError("a_b")).not.toBeNull();
    expect(slugError("admin")).not.toBeNull();
    expect(slugError("product")).not.toBeNull();
  });

  it("builds the full short URL", () => {
    expect(shortLinkUrl("wa")).toBe("https://friday.myfyxx.com/wa");
  });
});

describe("destination safety", () => {
  it("allows paths on the Friday site", () => {
    expect(validateDestination("/")).toEqual({ ok: true, value: "/" });
    expect(validateDestination("/product/x")).toEqual({ ok: true, value: "/product/x" });
  });

  it("allows full links only on the main store", () => {
    expect(validateDestination("https://myfyxx.com/collections/sale").ok).toBe(true);
    expect(validateDestination("https://www.myfyxx.com/").ok).toBe(true);
  });

  it("blocks other sites, other schemes and protocol-relative links", () => {
    expect(validateDestination("https://evil.com/").ok).toBe(false);
    expect(validateDestination("http://myfyxx.com/").ok).toBe(false);
    expect(validateDestination("//evil.com").ok).toBe(false);
    expect(validateDestination("javascript:alert(1)").ok).toBe(false);
    expect(validateDestination("").ok).toBe(false);
  });
});

describe("final redirect URL", () => {
  it("builds the /wa target exactly", () => {
    expect(buildShortLinkTarget("/", WA_UTM)).toBe(
      "/?utm_source=whatsapp&utm_medium=social&utm_campaign=fyxx-friday-2026-11-27",
    );
  });

  it("keeps Friday paths relative and merges onto existing query params", () => {
    expect(buildShortLinkTarget("/product/x?variant=1", { utm_source: "insta" })).toBe(
      "/product/x?variant=1&utm_source=insta",
    );
  });

  it("keeps allowed full links absolute", () => {
    expect(buildShortLinkTarget("https://myfyxx.com/sale", { utm_source: "insta" })).toBe(
      "https://myfyxx.com/sale?utm_source=insta",
    );
  });

  it("skips empty UTM values", () => {
    expect(buildShortLinkTarget("/", { utm_source: "wa", utm_content: "" })).toBe(
      "/?utm_source=wa",
    );
  });

  it("returns null for a disallowed destination", () => {
    expect(buildShortLinkTarget("https://evil.com", WA_UTM)).toBeNull();
  });
});

describe("redirect-page detection", () => {
  it("treats a bare single segment as a possible slug", () => {
    expect(slugFromPath("/wa")).toBe("wa");
    expect(slugFromPath("/WA")).toBe("wa");
    expect(slugFromPath("/promo-1")).toBe("promo-1");
  });

  it("ignores the home page, real routes, multi-segment and asset paths", () => {
    expect(slugFromPath("/")).toBeNull();
    expect(slugFromPath("/admin")).toBeNull();
    expect(slugFromPath("/pairings")).toBeNull();
    expect(slugFromPath("/product/x")).toBeNull();
    expect(slugFromPath("/favicon.svg")).toBeNull();
  });

  it("serves the landing preview image on redirect pages", () => {
    const og = redirectPageMeta().find((m) => "property" in m && m.property === "og:image") as
      { content?: string } | undefined;
    expect(og?.content).toContain("og-fyxx-friday.jpg");
  });
});
