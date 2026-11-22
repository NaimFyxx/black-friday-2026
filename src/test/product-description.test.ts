import { describe, expect, it } from "vitest";

import { parseDescription } from "@/lib/product-description";

import fixtures from "./fixtures-descriptions.json";

const titles = (h: string) => parseDescription(h).sections.map((s) => s.title);

describe("parseDescription", () => {
  it("splits a structured wine description into sections and facts", () => {
    const d = parseDescription(fixtures["beronia-reserva"]);
    expect(d.intro[0]).toMatch(/^Beronia Reserva from Rioja/);
    expect(titles(fixtures["beronia-reserva"])).toEqual([
      "Tasting notes",
      "The facts",
      "Goes with",
      "Serving",
      "The producer",
    ]);
    const facts = d.sections.find((s) => s.title === "The facts")!.facts;
    expect(facts[0]).toEqual({ label: "Grapes", value: "Tempranillo, Graciano, Mazuelo" });
    expect(facts.map((f) => f.label)).toEqual(["Grapes", "Origin", "Style", "Winemaking"]);
  });

  it("cleans an older pasted whisky description", () => {
    const d = parseDescription(fixtures["glenfiddich-special-reserve-single-malt-12yo"]);
    expect(d.intro).toHaveLength(2);
    expect(titles(fixtures["glenfiddich-special-reserve-single-malt-12yo"])).toEqual([
      "Awards",
      "Tasting notes",
      "The facts",
    ]);
    const facts = d.sections.find((s) => s.title === "The facts")!.facts;
    expect(facts).toEqual([{ label: "Origin", value: "Scotland" }]);
    expect(JSON.stringify(d)).not.toMatch(/data-mce|<|\*\*/);
  });

  it("reads cigar details as facts", () => {
    const d = parseDescription(fixtures["plasencia-robusto-reserva-original"]);
    const facts = d.sections.find((s) => s.title === "The facts")!.facts;
    expect(facts.map((f) => f.label)).toEqual(
      expect.arrayContaining(["Shape", "Wrapper", "Filler", "Binder"]),
    );
    expect(facts.find((f) => f.label === "Shape")!.value).toBe("Robusto");
    expect(facts.some((f) => /Smoking Time/.test(f.label))).toBe(true);
  });

  it("handles empty input", () => {
    expect(parseDescription("")).toEqual({ intro: [], sections: [] });
    expect(parseDescription("<p>Just text.</p>")).toEqual({ intro: ["Just text."], sections: [] });
  });
});
