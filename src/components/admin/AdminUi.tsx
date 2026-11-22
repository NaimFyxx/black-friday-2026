// Small shared pieces for the /admin pages (same look as the Fyxx Cup admin).

import type { ReactNode } from "react";

import { CAMPAIGN_END, CAMPAIGN_START } from "@/lib/campaign-config";
import { describeSource, KIND_LABEL, type SourceKind, type SourceLabel } from "@/lib/source-labels";
import { cn } from "@/lib/utils";

export const AMMAN = "Asia/Amman";

export type RangeKey = "campaign" | "7d" | "30d";
export type Range = { since: string; until: string };

export function rangeFor(key: RangeKey): Range {
  if (key === "campaign") {
    return {
      since: new Date(CAMPAIGN_START).toISOString(),
      until: new Date(CAMPAIGN_END).toISOString(),
    };
  }
  const days = key === "7d" ? 7 : 30;
  // Round to the hour so the query key (and cache) is stable for a while.
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const until = new Date(now.getTime() + 3_600_000);
  return {
    since: new Date(until.getTime() - days * 86_400_000).toISOString(),
    until: until.toISOString(),
  };
}

const RANGE_LABELS: Record<RangeKey, string> = {
  campaign: "Whole campaign",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export function RangePicker({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (k: RangeKey) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
      {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition",
            value === k
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {RANGE_LABELS[k]}
        </button>
      ))}
    </div>
  );
}

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    timeZone: AMMAN,
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function fmtRange(r: Range): string {
  // `until` is exclusive, so show the day before it.
  return `${fmtDate(r.since)} to ${fmtDate(new Date(new Date(r.until).getTime() - 1).toISOString())}`;
}

/** Whole number with thousands separators: 1,482 */
export function fmtNum(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Money for dashboards, whole amounts: "JOD 1,482". */
export function fmtMoney(v: number, currency = "JOD"): string {
  return `${currency} ${fmtNum(v)}`;
}

export function fmtPct(part: number, whole: number): string {
  if (!whole) return "–";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      {children && <div className="max-w-3xl text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** One block of a page: title, one grey line on what it shows and why it matters, then content. */
export function Section({
  title,
  intro,
  actions,
  children,
  className,
}: {
  title: string;
  intro: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-10 space-y-3 first:mt-0", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Small grey footnote under a table or set of cards. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-xs text-muted-foreground">{children}</p>;
}

/** Two- or three-way switch (Today / Since launch...). */
export function Toggle<K extends string>({
  value,
  options,
  onChange,
}: {
  value: K;
  options: Array<{ key: K; label: string }>;
  onChange: (k: K) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition",
            value === o.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const KIND_CLASS: Record<SourceKind, string> = {
  paid: "bg-primary/10 text-primary",
  free: "bg-green-100 text-green-800",
  unknown: "bg-secondary text-muted-foreground",
};

/** "Paid" / "Free" / "Unknown" pill next to a source. */
export function KindTag({ kind }: { kind: SourceKind }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-1.5 py-px text-[10px] leading-4 font-semibold whitespace-nowrap",
        KIND_CLASS[kind],
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

/**
 * A source in plain words with its Paid / Free / Unknown tag. `showRaw` adds
 * the tracking value in small grey underneath (for whoever set up the link).
 */
export function SourceName({
  source,
  medium,
  label,
  showRaw = false,
  extra,
}: {
  source?: string | null;
  medium?: string | null;
  /** Use an already described label instead of source / medium. */
  label?: SourceLabel;
  showRaw?: boolean;
  /** Extra grey text after the raw value, e.g. the campaign. */
  extra?: string;
}) {
  const l = label ?? describeSource(source, medium);
  const rawLine = [l.raw, extra].filter(Boolean).join(" · ");
  return (
    <span className="inline-block min-w-0 align-top">
      <span className="font-medium" title={l.raw || undefined}>
        {l.name}
      </span>{" "}
      <KindTag kind={l.kind} />
      {showRaw && rawLine && (
        <span className="block text-[11px] leading-snug break-words text-muted-foreground">
          {rawLine}
        </span>
      )}
    </span>
  );
}

/** Table header and cell styles, the same on every admin page. */
export const TH = "px-3 py-2.5 text-xs font-medium text-muted-foreground first:pl-4 last:pr-4";
export const THR = `${TH} text-right`;
export const TD = "px-3 py-2.5 align-top first:pl-4 last:pr-4";
export const TDR = `${TD} text-right tabular-nums whitespace-nowrap`;
export const TR = "border-b border-border/60 last:border-0";

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Yellow "this part isn't set up yet" box. */
export function SetupNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-amber-800">{children}</div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>{children}</div>
  );
}

export function Loading() {
  return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

/** Shared explanation for missing pieces, reused across pages. */
export function SourceSetupNotices({
  events,
  eventsError,
  shopify,
  shopifyError,
}: {
  events: string;
  eventsError: string | null;
  shopify: string;
  shopifyError: string | null;
}) {
  return (
    <>
      {events === "missing" && (
        <SetupNotice title="Visits aren't being saved yet">
          The table that stores visits, carts and checkouts (<code>bf_events</code>) doesn't exist
          in the database yet. Paste the prompt from <code>docs/LOVABLE-SETUP.md</code> into
          Lovable.
        </SetupNotice>
      )}
      {events === "error" && (
        <SetupNotice title="Couldn't read the visits">{eventsError}</SetupNotice>
      )}
      {shopify === "not_configured" && (
        <SetupNotice title="Orders from Shopify can't be read yet">
          Orders and sales show as 0 until the site can read Shopify orders (the{" "}
          <code>bf-admin</code> function needs Pulse's <code>SHOPIFY_CLIENT_ID</code> and{" "}
          <code>SHOPIFY_CLIENT_SECRET</code>). See <code>docs/LOVABLE-SETUP.md</code>.
        </SetupNotice>
      )}
      {shopify === "error" && (
        <SetupNotice title="Couldn't read the orders from Shopify">{shopifyError}</SetupNotice>
      )}
    </>
  );
}
