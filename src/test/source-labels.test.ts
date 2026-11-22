import { describe, expect, it } from "vitest";

import { describeCampaign, describeSource, describeSourceText } from "@/lib/source-labels";

describe("describeSource", () => {
  it("names the sources the team uses", () => {
    expect(describeSource("ig", "paid-social")).toMatchObject({
      name: "Instagram ads",
      kind: "paid",
    });
    expect(describeSource("fb", "paid-social")).toMatchObject({
      name: "Facebook ads",
      kind: "paid",
    });
    expect(describeSource("klaviyo", "email")).toMatchObject({
      name: "Email (Klaviyo)",
      kind: "free",
    });
    expect(describeSource("fyxx-app", "app-banner")).toMatchObject({
      name: "Fyxx app banner",
      kind: "free",
    });
    expect(describeSource("instagram", "story")).toMatchObject({
      name: "Instagram story (our page)",
      kind: "free",
    });
    expect(describeSource("instagram", "social")).toMatchObject({
      name: "Instagram post or bio (our page)",
      kind: "free",
    });
  });

  it("handles visits with no source", () => {
    expect(describeSource(null, null)).toMatchObject({
      name: "Direct or unknown",
      kind: "unknown",
    });
    expect(describeSource(null, "direct").name).toBe("Direct or unknown");
    expect(describeSource(null, "(none)").name).toBe("Direct or unknown");
    expect(describeSource(null, "l.instagram.com").name).toBe("From instagram.com");
  });

  it("never hides an unknown value", () => {
    expect(describeSource("snippet_test", "qa")).toMatchObject({
      name: "snippet_test (qa)",
      kind: "unknown",
      raw: "snippet_test / qa",
    });
    expect(describeSource("newsletter-x", "cpc")).toMatchObject({ kind: "paid" });
    expect(describeSource("IG", "Paid-Social").name).toBe("Instagram ads");
  });
});

describe("describeSourceText", () => {
  it("reads report and Google Analytics strings", () => {
    expect(describeSourceText("ig / paid-social / fyxx-friday-2026-11-27").name).toBe(
      "Instagram ads",
    );
    expect(describeSourceText("(direct / none)").name).toBe("Direct or unknown");
    expect(describeSourceText("(direct / none) / instagram.com").name).toBe("From instagram.com");
    expect(describeSourceText("(direct) / (none)").name).toBe("Direct or unknown");
    expect(describeSourceText("google / organic").name).toBe("Google search");
    expect(describeSourceText("l.instagram.com / referral").name).toBe("From instagram.com");
  });
});

describe("describeCampaign", () => {
  it("shows both Fyxx Friday tags the same", () => {
    expect(describeCampaign("fyxx-friday")).toBe("Fyxx Friday");
    expect(describeCampaign("fyxx-friday-2026-11-27")).toBe("Fyxx Friday");
    expect(describeCampaign(null)).toBe("");
  });
});
