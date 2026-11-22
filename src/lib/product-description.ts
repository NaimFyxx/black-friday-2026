// Turns a Shopify product description (descriptionHtml) into clean sections,
// like the myfyxx.com product page: an intro, then "Tasting notes", "The facts"
// (label / value rows), "Goes with", "Serving", "Awards", "The producer".
//
// Works on both description styles in the store:
// - newer ones: <p><strong>Tasting Notes</strong><br>...</p>, a "Quick Facts"
//   list of "Label: value" items, "Food Pairing", "Serving", "About the Producer"
// - older pasted ones: headings like "Tasting's Notes", "Awards & Press Review",
//   "Country & Region", inline "<strong>Shape:</strong> Robusto" lines, and
//   leftover <div>/<span>/<meta> markup.
// Pure string work (no DOM), so it runs the same on the server and in the browser.

export interface Fact {
  label: string;
  value: string;
}
export interface DescriptionSection {
  title: string;
  kind: "text" | "facts" | "producer";
  lines: string[];
  bullets: string[];
  facts: Fact[];
}
export interface ParsedDescription {
  intro: string[];
  sections: DescriptionSection[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  deg: "°",
  eacute: "é",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML -> plain lines; bold kept as **...**, list items start with "• ". */
function toLines(html: string): string[] {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(meta|img|iframe|video|source)[^>]*>/gi, "")
    .replace(/<br(\s[^>]*)?\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?(p|div|ul|ol|h[1-6]|table|tr|section|blockquote)(\s[^>]*)?>/gi, "\n\n")
    .replace(/<\/?(strong|b)(\s[^>]*)?>/gi, "**")
    .replace(/<[^>]+>/g, "");
  return decode(text)
    .replace(/ /g, " ")
    .split("\n")
    .map((l) =>
      l
        .replace(/\*\*\s*\*\*/g, "") // empty or split bold runs
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((l) => l && l !== "**" && l !== "•");
}

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** Friendly, consistent section names. */
function sectionTitle(raw: string): { title: string; kind: DescriptionSection["kind"] } {
  const t = clean(raw).replace(/:$/, "");
  const l = t.toLowerCase();
  if (/quick facts|details|composition|specification|the facts/.test(l))
    return { title: "The facts", kind: "facts" };
  if (/country|region|origin/.test(l)) return { title: "Origin", kind: "facts" };
  if (/producer|distillery|about the (brand|maker)|the house/.test(l))
    return { title: "The producer", kind: "producer" };
  if (/tasting/.test(l)) return { title: "Tasting notes", kind: "text" };
  if (/pairing|goes with|food/.test(l)) return { title: "Goes with", kind: "text" };
  if (/serv/.test(l)) return { title: "Serving", kind: "text" };
  if (/award|press|review/.test(l)) return { title: "Awards", kind: "text" };
  // Product-name headings ("Drew Estate | Liga Privada No. 9") keep their capitals.
  if (t.includes("|")) return { title: t, kind: "text" };
  return { title: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(), kind: "text" };
}

const MAIN_SECTIONS = new Set(["Tasting notes", "Goes with", "Serving", "Awards", "The producer"]);

const HEADING = /^\*\*([^*]{2,60}?)\*\*:?$/;
const BOLD_FACT = /^(?:•\s*)?\*\*([^*:]{1,40}?):?\*\*:?\s*(.+)$/;
const PLAIN_FACT = /^(?:•\s*)?([A-Za-z][A-Za-z &/()-]{0,30}):\s+(.+)$/;

export function parseDescription(html: string | null | undefined): ParsedDescription {
  const lines = toLines(html ?? "");
  const intro: string[] = [];
  const sections: DescriptionSection[] = [];
  let current: DescriptionSection | null = null;

  for (const line of lines) {
    const heading = line.match(HEADING);
    if (heading) {
      const { title, kind } = sectionTitle(heading[1]!);
      current = { title, kind, lines: [], bullets: [], facts: [] };
      sections.push(current);
      continue;
    }
    const boldFact = line.match(BOLD_FACT);
    if (boldFact && current) {
      current.facts.push({ label: clean(boldFact[1]!), value: clean(boldFact[2]!) });
      continue;
    }
    if (current?.kind === "facts") {
      const plain = line.match(PLAIN_FACT);
      if (plain) {
        current.facts.push({ label: clean(plain[1]!), value: clean(plain[2]!) });
        continue;
      }
    }
    const text = clean(line.replace(/^•\s*/, ""));
    if (!text) continue;
    if (!current) intro.push(text);
    else if (line.startsWith("•")) current.bullets.push(text);
    else current.lines.push(text);
  }

  // "Country & Region: Scotland" style sections become an Origin fact; all
  // fact sections merge into one "The facts" table where the first one was.
  const merged: DescriptionSection[] = [];
  let facts: DescriptionSection | null = null;
  for (const s of sections) {
    if (s.kind === "facts") {
      if (s.title === "Origin" && s.facts.length === 0 && s.lines.length) {
        s.facts.push({ label: "Origin", value: s.lines.join(", ") });
        s.lines = [];
      }
      if (!facts) {
        facts = { ...s, title: "The facts" };
        merged.push(facts);
      } else {
        facts.facts.push(...s.facts);
        facts.lines.push(...s.lines);
        facts.bullets.push(...s.bullets);
      }
      continue;
    }
    // A short heading with one short value under it ("ABV" / "40%", "Weight" /
    // "50g", "Smoking time" / "45-60 minutes") is a fact, not a section.
    if (
      !MAIN_SECTIONS.has(s.title) &&
      s.title.length <= 28 &&
      s.lines.length === 1 &&
      s.bullets.length === 0 &&
      s.lines[0]!.length <= 60
    ) {
      s.facts.push({ label: s.title, value: s.lines[0]! });
      s.lines = [];
    }
    // Label / value lines under other headings (e.g. "Smoking time") join the facts table.
    if (s.facts.length) {
      if (!facts) {
        facts = { title: "The facts", kind: "facts", lines: [], bullets: [], facts: [] };
        merged.push(facts);
      }
      facts.facts.push(...s.facts);
      s.facts = [];
    }
    if (s.lines.length || s.bullets.length) merged.push(s);
  }
  // "Nicaragua." -> "Nicaragua" (a lone full stop at the end of a short value).
  for (const s of merged)
    for (const f of s.facts)
      if (/^[^.]+\.$/.test(f.value) && f.value.length <= 40) f.value = f.value.slice(0, -1);
  // Drop a facts table that ended up empty.
  return {
    intro,
    sections: merged.filter((s) => s.lines.length || s.bullets.length || s.facts.length),
  };
}
