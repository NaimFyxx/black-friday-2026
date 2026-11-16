import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";

import {
  ErrorBox,
  fmtDate,
  fmtMoney,
  fmtPct,
  fmtRange,
  PageHeader,
  Panel,
  RangePicker,
  rangeFor,
  StatCard,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { generateCampaignReport } from "@/lib/admin.functions";
import { CAMPAIGN_LABEL } from "@/lib/campaign-config";
import type { CampaignReport } from "@/lib/report.server";

export const Route = createFileRoute("/admin/report")({
  component: ReportPage,
});

type Ok<S> = S extends { status: "ok"; data: infer D } ? D : never;

function change(now: number, before: number | undefined): string | undefined {
  if (before === undefined) return undefined;
  if (!before) return now ? "new vs before" : undefined;
  const pct = ((now - before) / before) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs before`;
}

function ReportPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const [withAi, setWithAi] = useState(true);
  const fn = useServerFn(generateCampaignReport);
  const gen = useMutation({
    mutationFn: () => fn({ data: { ...rangeFor(rangeKey), withAi } }),
  });

  return (
    <>
      <div className="space-y-4 print:hidden">
        <PageHeader title="Campaign report">
          One click: every number from the campaign in one page, with a plain-English summary. Takes
          up to a minute. Use “Download PDF” to save or share it.
        </PageHeader>
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker value={rangeKey} onChange={setRangeKey} />
          <span className="text-xs text-muted-foreground">{fmtRange(rangeFor(rangeKey))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? "Building the report…" : "Generate report"}
          </Button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />
            Include AI-written summary
          </label>
          {gen.data && (
            <Button variant="outline" onClick={() => window.print()}>
              Download PDF
            </Button>
          )}
        </div>
        {gen.error && <ErrorBox error={gen.error} />}
      </div>

      {gen.data && <Report r={gen.data} />}
    </>
  );
}

function Unavailable({ what, reason }: { what: string; reason: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
      {what} not available: {reason}
    </p>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-3 font-display text-2xl break-after-avoid">{children}</h2>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing in this period.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 break-inside-avoid">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j > 0 ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tiny markdown renderer for the AI summary (headings, bullets, bold). */
function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length)
      out.push(
        <ul key={`u${out.length}`} className="ml-5 list-disc space-y-1">
          {list}
        </ul>,
      );
    list = [];
  };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return flush();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const b = line.match(/^[*-]\s+(.*)$/) ?? line.match(/^\d+\.\s+(.*)$/);
    if (h) {
      flush();
      out.push(
        <h3 key={i} className="mt-4 font-semibold">
          {inline(h[1] ?? "")}
        </h3>,
      );
    } else if (b) {
      list.push(<li key={i}>{inline(b[1] ?? "")}</li>);
    } else {
      flush();
      out.push(<p key={i}>{inline(line)}</p>);
    }
  });
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{out}</div>;
}

function Report({ r }: { r: CampaignReport }) {
  const store = r.store.status === "ok" ? r.store.data : null;
  const mNow = r.marketing.now.status === "ok" ? r.marketing.now.data : null;
  const mBefore = r.marketing.before.status === "ok" ? r.marketing.before.data : null;
  const meta = r.meta.status === "ok" ? r.meta.data : null;
  const kl = r.klaviyo.status === "ok" ? r.klaviyo.data : null;
  const site = r.site.status === "ok" ? r.site.data : null;
  const prods = r.products.status === "ok" ? r.products.data : null;

  return (
    <article className="mt-6 space-y-2 print:mt-0">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          Fyxx · Campaign report
        </p>
        <h1 className="font-display text-4xl">{CAMPAIGN_LABEL}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmtRange({ since: r.period.since, until: r.period.until })} ({r.period.days} days),
          compared with {fmtRange({ since: r.previousPeriod.since, until: r.previousPeriod.until })}
          . Generated {fmtDate(r.generatedAt, true)}.
        </p>
      </header>

      {/* Summary */}
      {r.summary.status === "ok" ? (
        <Panel className="mt-4 break-inside-avoid">
          <p className="mb-1 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Summary
          </p>
          <Markdown text={r.summary.data.text} />
          <p className="mt-3 text-[10px] text-muted-foreground">
            Written by AI ({r.summary.data.model}) from the numbers below only.
          </p>
        </Panel>
      ) : r.summary.reason !== "Not requested" ? (
        <Unavailable what="AI summary" reason={r.summary.reason} />
      ) : null}

      {/* Headline numbers */}
      <H2>Headline</H2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total sales (all channels)"
          value={store ? fmtMoney(store.current.revenue) : "–"}
          sub={store ? change(store.current.revenue, store.previous.revenue) : "not available"}
        />
        <StatCard
          label="Revenue from marketing"
          value={mNow ? fmtMoney(mNow.influencedRevenue) : "–"}
          sub={
            mNow
              ? `${fmtPct(mNow.influencedRevenue, mNow.revenue)} of sales${mBefore ? ` · ${change(mNow.influencedRevenue, mBefore.influencedRevenue)}` : ""}`
              : "not available"
          }
        />
        <StatCard
          label="Meta ads return"
          value={meta?.roas != null ? `${meta.roas.toFixed(1)}×` : "–"}
          sub={meta ? `${fmtMoney(meta.spend, meta.currency)} spent` : "not available"}
        />
        <StatCard
          label="Email & SMS revenue"
          value={kl ? fmtMoney(kl.totals.revenue) : "–"}
          sub={kl ? `${kl.totals.sends} sends · ${kl.totals.orders} orders` : "not available"}
        />
        <StatCard
          label="Black Friday site"
          value={site ? fmtMoney(site.totals.revenue) : "–"}
          sub={
            site ? `${site.totals.orders} orders · ${site.totals.visits} visits` : "not available"
          }
        />
      </div>

      {/* Whole store */}
      <H2>Whole store, by channel</H2>
      {store ? (
        <>
          <Table
            head={["Channel", "Orders", "Revenue", "Share", "Before"]}
            rows={store.current.channels.map((c) => {
              const b = store.previous.channels.find((x) => x.channel === c.channel);
              return [
                c.channel,
                c.orders.toLocaleString(),
                fmtMoney(c.revenue),
                fmtPct(c.revenue, store.current.revenue),
                b ? fmtMoney(b.revenue) : "–",
              ];
            })}
          />
          <p className="text-xs text-muted-foreground">
            {store.current.orders.toLocaleString()} orders, average {fmtMoney(store.current.aov)} ·{" "}
            {store.current.newCustomers.toLocaleString()} new and{" "}
            {store.current.returningCustomers.toLocaleString()} returning Shopify customers (before:{" "}
            {store.previous.newCustomers.toLocaleString()} new).
          </p>
        </>
      ) : (
        r.store.status !== "ok" && <Unavailable what="Store sales" reason={r.store.reason} />
      )}

      {/* Marketing */}
      <H2>What brought the sales in</H2>
      {mNow ? (
        <>
          <Table
            head={["Main reason", "Orders", "Revenue"]}
            rows={mNow.byReason.map((b) => [
              b.name,
              b.orders.toLocaleString(),
              fmtMoney(b.revenue),
            ])}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mt-4 mb-2 text-sm font-medium">Top Klaviyo messages</p>
              <Table
                head={["Message", "Orders", "Revenue"]}
                rows={mNow.topKlaviyoMessages.map((b) => [b.name, b.orders, fmtMoney(b.revenue)])}
              />
            </div>
            <div>
              <p className="mt-4 mb-2 text-sm font-medium">Top discount codes</p>
              <Table
                head={["Code", "Orders", "Revenue"]}
                rows={mNow.topCodes.map((b) => [b.name, b.orders, fmtMoney(b.revenue)])}
              />
            </div>
          </div>
          <p className="mt-4 mb-2 text-sm font-medium">
            Top Google Analytics sources (ads, social, links)
          </p>
          <Table
            head={["Source / medium", "Orders", "Revenue"]}
            rows={mNow.topGaSources.map((b) => [b.name, b.orders, fmtMoney(b.revenue)])}
          />
        </>
      ) : (
        r.marketing.now.status !== "ok" && (
          <Unavailable what="Marketing attribution" reason={r.marketing.now.reason} />
        )
      )}

      {/* Meta */}
      <H2>Meta ads</H2>
      {meta ? (
        <Table
          head={["Campaign", "Spend", "Clicks", "Purchases", "Purchase value", "ROAS"]}
          rows={meta.campaigns.map((c) => [
            c.name,
            fmtMoney(c.spend, meta.currency),
            c.clicks.toLocaleString(),
            c.purchases.toLocaleString(),
            fmtMoney(c.purchase_value, meta.currency),
            c.roas != null ? `${c.roas.toFixed(1)}×` : "–",
          ])}
        />
      ) : (
        r.meta.status !== "ok" && <Unavailable what="Meta ads" reason={r.meta.reason} />
      )}
      {meta?.spendJod != null && (
        <p className="text-xs text-muted-foreground">
          Total spend ≈ {fmtMoney(meta.spendJod)} · Meta-reported purchase value ≈{" "}
          {fmtMoney(meta.purchaseValueJod ?? 0)} ({meta.purchases.toLocaleString()} purchases).
        </p>
      )}

      {/* Klaviyo */}
      <H2>Emails & SMS (Klaviyo)</H2>
      {kl ? (
        <Table
          head={[
            "Message",
            "Sent on",
            "Recipients",
            "Open rate",
            "Click rate",
            "Orders",
            "Revenue",
          ]}
          rows={kl.campaigns.map((c) => [
            `${c.name}${c.channel && c.channel !== "email" ? ` (${c.channel})` : ""}`,
            c.sentOn,
            c.sent.toLocaleString(),
            `${(c.openRate * 100).toFixed(1)}%`,
            `${(c.clickRate * 100).toFixed(2)}%`,
            c.orders.toLocaleString(),
            fmtMoney(c.revenue),
          ])}
        />
      ) : (
        r.klaviyo.status !== "ok" && <Unavailable what="Klaviyo" reason={r.klaviyo.reason} />
      )}

      {/* Site */}
      <H2>The Black Friday site</H2>
      {site ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Visits" value={site.totals.visits.toLocaleString()} />
            <StatCard
              label="Added to cart"
              value={site.totals.carts.toLocaleString()}
              sub={`${fmtPct(site.totals.carts, site.totals.visits)} of visits`}
            />
            <StatCard
              label="Reached checkout"
              value={site.totals.checkouts.toLocaleString()}
              sub={`${fmtPct(site.totals.checkouts, site.totals.carts)} of carts`}
            />
            <StatCard
              label="Orders"
              value={site.totals.orders.toLocaleString()}
              sub={`${fmtPct(site.totals.orders, site.totals.visits)} of visits`}
            />
            <StatCard label="New customers" value={site.totals.newCustomers.toLocaleString()} />
          </div>
          {site.ordersNote && <p className="text-xs text-amber-700">{site.ordersNote}</p>}
          <div className="mt-3">
            <Table
              head={["Source", "Visits", "Carts", "Checkouts", "Orders", "Revenue"]}
              rows={site.sources.map((s) => [
                s.source,
                s.visits,
                s.carts,
                s.checkouts,
                s.orders,
                fmtMoney(s.revenue),
              ])}
            />
          </div>
        </>
      ) : (
        r.site.status !== "ok" && <Unavailable what="Site numbers" reason={r.site.reason} />
      )}

      {/* Products */}
      <H2>Products on the site</H2>
      {prods && prods.tracked ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Most added to cart</p>
            <Table
              head={["Product", "Views", "Added", "At checkout"]}
              rows={prods.mostAdded.map((p) => [
                p.title || "(unknown)",
                p.views,
                p.carts,
                p.checkoutUnits,
              ])}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Looked at a lot, rarely added</p>
            <Table
              head={["Product", "Views", "Added", "Add rate"]}
              rows={prods.viewedNotAdded.map((p) => [
                p.title || "(unknown)",
                p.views,
                p.carts,
                `${(p.addRate * 100).toFixed(0)}%`,
              ])}
            />
          </div>
        </div>
      ) : prods ? (
        <p className="text-sm text-muted-foreground">
          No product activity recorded in this period.
        </p>
      ) : (
        r.products.status !== "ok" && <Unavailable what="Products" reason={r.products.reason} />
      )}

      <footer className="mt-8 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <p className="font-medium">How these numbers are counted</p>
        <ul className="ml-4 list-disc">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}

// Keep the type helper referenced so it stays available for future sections.
export type _ReportSections = Ok<CampaignReport["store"]>;
