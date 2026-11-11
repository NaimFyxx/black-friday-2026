// Small shared pieces for the /admin pages (same look as the Fyxx Cup admin).

import type { ReactNode } from "react";

import { CAMPAIGN_END, CAMPAIGN_LABEL, CAMPAIGN_START } from "@/lib/campaign-config";
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
  campaign: CAMPAIGN_LABEL,
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
  return `${fmtDate(r.since)} – ${fmtDate(new Date(new Date(r.until).getTime() - 1).toISOString())}`;
}

export function fmtMoney(v: number, currency = "JOD"): string {
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

export function fmtPct(part: number, whole: number): string {
  if (!whole) return "–";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h1 className="font-display text-3xl">{title}</h1>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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
        <SetupNotice title="Visit tracking isn't switched on yet">
          The <code>bf_events</code> table hasn't been created in Supabase, so visits, carts and
          checkouts aren't being saved. Paste the prompt from <code>docs/LOVABLE-SETUP.md</code>{" "}
          into Lovable.
        </SetupNotice>
      )}
      {events === "error" && (
        <SetupNotice title="Couldn't read visit data">{eventsError}</SetupNotice>
      )}
      {shopify === "not_configured" && (
        <SetupNotice title="Shopify orders aren't connected yet">
          Add the <code>SHOPIFY_ADMIN_TOKEN</code> secret in Lovable (steps in{" "}
          <code>docs/LOVABLE-SETUP.md</code>) to see which sources led to real orders.
        </SetupNotice>
      )}
      {shopify === "error" && (
        <SetupNotice title="Couldn't read Shopify orders">{shopifyError}</SetupNotice>
      )}
    </>
  );
}
