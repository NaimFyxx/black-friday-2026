import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";

import {
  ErrorBox,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtRange,
  PageHeader,
  RangePicker,
  rangeFor,
  SourceName,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import {
  deleteSavedReport,
  generateCampaignReport,
  getSavedReport,
  listSavedReports,
  saveCampaignReport,
} from "@/lib/admin.functions";
import { CAMPAIGN_LABEL } from "@/lib/campaign-config";
import type { CampaignReport } from "@/lib/report.server";
import { describeChannel, describeSourceText } from "@/lib/source-labels";

export const Route = createFileRoute("/admin/report")({
  component: ReportPage,
});

// ── Helpers ───────────────────────────────────────────────────────────

function changeText(now: number, before: number | undefined | null): string | undefined {
  if (before === undefined || before === null) return undefined;
  if (!before) return now ? "new vs before" : undefined;
  const pct = ((now - before) / before) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs before`;
}

/** "2026-10-27" -> "27 Oct" */
function shortDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? day
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

type Shown = {
  report: CampaignReport;
  /** Set when this is a saved copy (not freshly generated). */
  saved?: { id: string; title: string; at: string };
};

function defaultTitle(r: CampaignReport): string {
  return r.isCampaignPeriod
    ? `${CAMPAIGN_LABEL} report`
    : `Sales report ${r.period.from} to ${r.period.to}`;
}

function ReportPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const [withAi, setWithAi] = useState(true);
  const [shown, setShown] = useState<Shown | null>(null);
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const genFn = useServerFn(generateCampaignReport);
  const saveFn = useServerFn(saveCampaignReport);
  const listFn = useServerFn(listSavedReports);
  const getFn = useServerFn(getSavedReport);
  const delFn = useServerFn(deleteSavedReport);

  const saved = useQuery({ queryKey: ["admin-saved-reports"], queryFn: () => listFn(), retry: 1 });
  const refreshSaved = () => queryClient.invalidateQueries({ queryKey: ["admin-saved-reports"] });

  const gen = useMutation({
    mutationFn: () => genFn({ data: { ...rangeFor(rangeKey), withAi } }),
    onSuccess: (r) => {
      setShown({ report: r });
      setTitle(defaultTitle(r));
    },
  });
  const save = useMutation({
    mutationFn: () => {
      if (!shown) throw new Error("Nothing to save");
      return saveFn({
        data: { title: title.trim() || defaultTitle(shown.report), report: shown.report as never },
      });
    },
    onSuccess: ({ id }) => {
      if (shown) {
        setShown({
          ...shown,
          saved: {
            id,
            title: title.trim() || defaultTitle(shown.report),
            at: new Date().toISOString(),
          },
        });
      }
      refreshSaved();
    },
  });
  const open = useMutation({
    mutationFn: (id: string) => getFn({ data: { id } }),
    onSuccess: (row) => {
      setShown({ report: row.report, saved: { id: row.id, title: row.title, at: row.created_at } });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: (_d, id) => {
      if (shown?.saved?.id === id) setShown(null);
      refreshSaved();
    },
  });

  const downloadPdf = () => {
    // The PDF file name comes from the page title.
    const r = shown?.report;
    const old = document.title;
    if (r) document.title = shown?.saved?.title ?? defaultTitle(r);
    window.print();
    document.title = old;
  };

  const r = shown?.report;

  return (
    <>
      <div className="space-y-4 print:hidden">
        <PageHeader title="Campaign report">
          Every number from the campaign on one page, with a summary in plain words. It takes up to
          a minute to build. Save the final one so it reads the same every time, and use
          &quot;Download PDF&quot; to share it.
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
        </div>
        {gen.error && <ErrorBox error={gen.error} />}

        {/* Save / download the report on screen */}
        {r && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
            {shown?.saved ? (
              <p className="text-sm">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 uppercase">
                  Saved
                </span>{" "}
                <strong>{shown.saved.title}</strong>{" "}
                <span className="text-muted-foreground">
                  · saved {fmtDate(shown.saved.at, true)}
                </span>
              </p>
            ) : (
              <>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  aria-label="Report name"
                  className="h-9 min-w-64 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save this report"}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={downloadPdf}>
              Download PDF
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Tip: in the print window choose “Save as PDF” and untick “Headers and footers” for a
              clean file.
            </p>
            {save.error && <ErrorBox error={save.error} />}
          </div>
        )}

        {/* Saved reports */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Saved reports
          </p>
          {saved.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : saved.error ? (
            <ErrorBox error={saved.error} />
          ) : !saved.data?.reports.length ? (
            <p className="text-sm text-muted-foreground">
              None yet. Generate a report, then click “Save this report”.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {saved.data.reports.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.period_from} to {s.period_to} · saved {fmtDate(s.created_at, true)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => open.mutate(s.id)}
                      disabled={open.isPending}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete the saved report “${s.title}”?`))
                          remove.mutate(s.id);
                      }}
                      disabled={remove.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(open.error || remove.error) && <ErrorBox error={open.error ?? remove.error} />}
        </div>
      </div>

      {r && <Report r={r} />}
    </>
  );
}

// ── Building blocks ───────────────────────────────────────────────────

function H2({ children, intro }: { children: ReactNode; intro: string }) {
  return (
    <div className="mt-7 mb-2 break-after-avoid print:mt-5">
      <h2 className="font-display text-xl print:text-lg">{children}</h2>
      <p className="text-sm text-muted-foreground print:text-[10.5px]">{intro}</p>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground print:text-xs">{children}</p>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="rounded-lg border border-border p-3 break-inside-avoid print:p-2">
      <p className="text-[9px] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-display text-xl whitespace-nowrap tabular-nums print:text-lg">
        {value}
      </p>
      {sub && <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** First column is text; the rest are numbers (right-aligned, never wrapped). */
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <Muted>Nothing in this period.</Muted>;
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-[13px] print:text-[10.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] text-muted-foreground print:text-[9px]">
            {head.map((h, i) => (
              <th
                key={h}
                className={`py-1.5 pr-3 font-medium last:pr-0 ${i > 0 ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 break-inside-avoid last:border-0">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`py-1.5 pr-3 align-top last:pr-0 ${j > 0 ? "text-right whitespace-nowrap tabular-nums" : ""}`}
                >
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
        <ul key={`u${out.length}`} className="ml-5 list-disc space-y-0.5">
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
        <h3 key={i} className="mt-3 font-semibold break-after-avoid first:mt-0">
          {inline(h[1] ?? "")}
        </h3>,
      );
    } else if (b) {
      list.push(
        <li key={i} className="break-inside-avoid">
          {inline(b[1] ?? "")}
        </li>,
      );
    } else {
      flush();
      out.push(<p key={i}>{inline(line)}</p>);
    }
  });
  flush();
  return <div className="space-y-1.5 text-sm leading-relaxed print:text-[11px]">{out}</div>;
}

// ── The report ────────────────────────────────────────────────────────

function Report({ r }: { r: CampaignReport }) {
  const store = r.store.status === "ok" ? r.store.data : null;
  const mNow = r.marketing.now.status === "ok" ? r.marketing.now.data : null;
  const mBefore = r.marketing.before.status === "ok" ? r.marketing.before.data : null;
  const meta = r.meta.status === "ok" ? r.meta.data : null;
  const kl = r.klaviyo.status === "ok" ? r.klaviyo.data : null;
  const site = r.site.status === "ok" ? r.site.data : null;
  const prods = r.products.status === "ok" ? r.products.data : null;
  const cmp = r.comparison;
  const posBeforeMissing =
    !!store?.previous.pos && store.previous.pos.days < store.previous.pos.expectedDays;
  const siteEmpty = !site || (site.totals.visits === 0 && site.totals.orders === 0);
  const metaEmpty = !meta || meta.campaigns.length === 0;

  const why = (s: { status: string; reason?: string }) =>
    s.status === "ok" ? "" : ` (${s.reason ?? "not available"})`;

  return (
    <article className="mt-6 print:mt-0">
      {/* Title */}
      <header className="border-b border-border pb-3">
        <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          Fyxx · {r.isCampaignPeriod ? "Campaign report" : "Sales report"}
        </p>
        <h1 className="font-display text-3xl">
          {r.isCampaignPeriod
            ? CAMPAIGN_LABEL
            : fmtRange({ since: r.period.since, until: r.period.until })}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {r.isCampaignPeriod
            ? `${fmtRange({ since: r.period.since, until: r.period.until })} · `
            : "Test / normal period, not the campaign · "}
          {r.period.days} days, compared with the {r.period.days} days before (
          {fmtRange({ since: r.previousPeriod.since, until: r.previousPeriod.until })}) · Generated{" "}
          {fmtDate(r.generatedAt, true)}
        </p>
      </header>

      {/* Headline numbers */}
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5 print:grid-cols-5">
        <Stat
          label="All Fyxx sales"
          value={cmp ? fmtMoney(cmp.now) : "–"}
          sub={
            cmp
              ? `${cmp.changePct === null ? "" : `${cmp.changePct >= 0 ? "+" : ""}${cmp.changePct.toFixed(0)}% vs before`}${cmp.likeForLike ? "" : " · without shops*"}`
              : "not available"
          }
        />
        <Stat
          label="Helped by marketing"
          value={mNow ? fmtMoney(mNow.influencedRevenue) : "–"}
          sub={
            mNow
              ? `${fmtPct(mNow.influencedRevenue, mNow.revenue)} of online sales${mBefore ? ` · ${changeText(mNow.influencedRevenue, mBefore.influencedRevenue)}` : ""}`
              : "not available"
          }
        />
        <Stat
          label="Email & SMS"
          value={kl ? fmtMoney(kl.totals.revenue) : "–"}
          sub={
            kl
              ? `${fmtNum(kl.totals.sends)} sent · ${fmtNum(kl.totals.orders)} orders`
              : "not available"
          }
        />
        <Stat
          label="Facebook & Instagram ads"
          value={meta?.roas != null ? `${meta.roas.toFixed(1)}x back` : metaEmpty ? "No ads" : "–"}
          sub={
            meta
              ? `${fmtMoney(meta.spend, meta.currency)} spent${meta.roas != null ? `, sales ${meta.roas.toFixed(1)} times that` : ""}`
              : "not available"
          }
        />
        <Stat
          label="Fyxx Friday site"
          value={site ? fmtMoney(site.totals.revenue) : "–"}
          sub={
            site
              ? `${fmtNum(site.totals.orders)} orders · ${fmtNum(site.totals.visits)} visits`
              : "not available"
          }
        />
      </div>
      {cmp && !cmp.likeForLike && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          * Shop (POS) sales are only recorded from 19 Oct 2026, so the days before have none. To
          compare like with like, &quot;All Fyxx sales&quot; here is website + app + draft orders.
          Shop sales this time:{" "}
          {fmtMoney(store?.current.channels.find((c) => c.channel === "POS (Odoo)")?.revenue ?? 0)}.
        </p>
      )}

      {/* AI summary: allowed to flow across pages */}
      {r.summary.status === "ok" ? (
        <section className="mt-5 rounded-lg border border-border p-4 print:p-3">
          <p className="mb-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Summary
          </p>
          <Markdown text={r.summary.data.text} />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Written by AI ({r.summary.data.model}) from the numbers in this report only.
          </p>
        </section>
      ) : r.summary.reason !== "Not requested" ? (
        <div className="mt-5">
          <Muted>AI summary not available ({r.summary.reason}).</Muted>
        </div>
      ) : null}

      {/* Whole store */}
      <H2 intro="Where all Fyxx orders were placed, compared with the days before. Shows whether the campaign lifted sales everywhere.">
        Sales by channel
      </H2>
      {store ? (
        <>
          <Table
            head={["Channel", "Orders", "Sales", "Share", "Sales before"]}
            rows={store.current.channels.map((c) => {
              const b = store.previous.channels.find((x) => x.channel === c.channel);
              const isPos = c.channel === "POS (Odoo)";
              return [
                describeChannel(c.channel),
                c.orders.toLocaleString(),
                fmtMoney(c.revenue),
                fmtPct(c.revenue, store.current.revenue),
                isPos && posBeforeMissing ? "no data" : b ? fmtMoney(b.revenue) : "–",
              ];
            })}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {fmtNum(store.current.orders)} orders, average {fmtMoney(store.current.aov)} ·{" "}
            {fmtNum(store.current.newCustomers)} new and {fmtNum(store.current.returningCustomers)}{" "}
            returning online customers (before: {fmtNum(store.previous.newCustomers)} new).
          </p>
        </>
      ) : (
        <Muted>Store sales not available{why(r.store)}.</Muted>
      )}

      {/* Marketing */}
      <H2 intro="Each online order is credited to one main reason: an email, a discount code or where the visit came from. Shows which marketing earned its money.">
        What brought the online sales in
      </H2>
      {mNow ? (
        <>
          <div className="break-inside-avoid">
            <Table
              head={["Main reason", "Orders", "Sales"]}
              rows={mNow.byReason.map((b) => [
                b.name,
                b.orders.toLocaleString(),
                fmtMoney(b.revenue),
              ])}
            />
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-2 print:grid-cols-2">
            <div className="break-inside-avoid">
              <p className="mb-1 text-sm font-medium">Top Klaviyo messages</p>
              <Table
                head={["Message", "Orders", "Sales"]}
                rows={mNow.topKlaviyoMessages
                  .slice(0, 8)
                  .map((b) => [b.name, b.orders, fmtMoney(b.revenue)])}
              />
            </div>
            <div className="break-inside-avoid">
              <p className="mb-1 text-sm font-medium">Top discount codes and programmes</p>
              <Table
                head={["Code or programme", "Orders", "Sales"]}
                rows={mNow.topCodes.slice(0, 8).map((b) => [b.name, b.orders, fmtMoney(b.revenue)])}
              />
            </div>
          </div>
          <div className="mt-4 break-inside-avoid">
            <p className="mb-1 text-sm font-medium">
              Where online shoppers came from (Google Analytics)
            </p>
            <Table
              head={["Came from", "Orders", "Sales"]}
              rows={mNow.topGaSources
                .slice(0, 8)
                .map((b) => [
                  <SourceName key={b.name} label={describeSourceText(b.name)} showRaw />,
                  b.orders,
                  fmtMoney(b.revenue),
                ])}
            />
          </div>
        </>
      ) : (
        <Muted>Marketing attribution not available{why(r.marketing.now)}.</Muted>
      )}

      {/* Klaviyo */}
      <H2 intro="Every email and SMS sent in this time, how many people opened and clicked, and the orders that followed.">
        Emails & SMS (Klaviyo)
      </H2>
      {kl ? (
        <Table
          head={["Message", "Sent on", "Sent to", "Opened", "Clicked", "Orders", "Sales"]}
          rows={kl.campaigns.map((c) => [
            `${c.name}${c.channel && c.channel !== "email" ? ` (${c.channel})` : ""}`,
            shortDay(c.sentOn),
            fmtNum(c.sent),
            `${(c.openRate * 100).toFixed(1)}%`,
            `${(c.clickRate * 100).toFixed(2)}%`,
            fmtNum(c.orders),
            fmtMoney(c.revenue),
          ])}
        />
      ) : (
        <Muted>Klaviyo not available{why(r.klaviyo)}.</Muted>
      )}

      {/* Meta */}
      <H2 intro="Facebook and Instagram ads: what was spent and what Meta says came back. 3.0x back means sales of 3 for every 1 spent.">
        Facebook & Instagram ads (Meta)
      </H2>
      {metaEmpty ? (
        <Muted>
          {meta
            ? "No Meta ads ran in this period (Fyxx Ads account)."
            : `Meta ads not available${why(r.meta)}.`}
        </Muted>
      ) : (
        <>
          <Table
            head={["Campaign", "Spent", "Clicks", "Orders", "Sales", "Back per 1 spent"]}
            rows={meta!.campaigns.map((c) => [
              c.name,
              fmtMoney(c.spend, meta!.currency),
              fmtNum(c.clicks),
              fmtNum(c.purchases),
              fmtMoney(c.purchase_value, meta!.currency),
              c.roas != null ? `${c.roas.toFixed(1)}x` : "–",
            ])}
          />
          {meta!.spendJod != null && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Spent in total about {fmtMoney(meta!.spendJod)} · sales Meta counts from the ads about{" "}
              {fmtMoney(meta!.purchaseValueJod ?? 0)} ({fmtNum(meta!.purchases)} orders).
            </p>
          )}
        </>
      )}

      {/* Site */}
      <H2 intro="This site's own numbers: visits, carts and orders through its checkout, by where visitors first came from.">
        The Fyxx Friday site
      </H2>
      {siteEmpty ? (
        <Muted>
          {site
            ? "No visits or orders on the Fyxx Friday site in this period."
            : `Site numbers not available${why(r.site)}.`}
        </Muted>
      ) : (
        <>
          <p className="mb-2 text-sm">
            {fmtNum(site!.totals.visits)} visits → {fmtNum(site!.totals.carts)} added to cart (
            {fmtPct(site!.totals.carts, site!.totals.visits)}) → {fmtNum(site!.totals.checkouts)}{" "}
            went to checkout → {fmtNum(site!.totals.orders)} orders (
            {fmtPct(site!.totals.orders, site!.totals.visits)} of visits) ·{" "}
            {fmtMoney(site!.totals.revenue)} in sales · {fmtNum(site!.totals.newCustomers)} new
            customers
          </p>
          {site!.ordersNote && <p className="text-[11px] text-amber-700">{site!.ordersNote}</p>}
          <Table
            head={["Came from", "Visits", "Added to cart", "Went to checkout", "Orders", "Sales"]}
            rows={site!.sources.map((s) => [
              <SourceName key={s.source} label={describeSourceText(s.source)} showRaw />,
              s.visits,
              s.carts,
              s.checkouts,
              s.orders,
              fmtMoney(s.revenue),
            ])}
          />
        </>
      )}

      {/* Products */}
      <H2 intro="What visitors on this site wanted most, and what they looked at but didn't buy (maybe the price or the photo).">
        Products on the site
      </H2>
      {prods?.tracked ? (
        <div className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
          <div className="break-inside-avoid">
            <p className="mb-1 text-sm font-medium">Most added to cart</p>
            <Table
              head={["Product", "Viewed", "Added to cart", "At checkout"]}
              rows={prods.mostAdded.map((p) => [
                p.title || "(unknown)",
                p.views,
                p.carts,
                p.checkoutUnits,
              ])}
            />
          </div>
          <div className="break-inside-avoid">
            <p className="mb-1 text-sm font-medium">Looked at a lot, rarely added</p>
            <Table
              head={["Product", "Viewed", "Added to cart", "Added per view"]}
              rows={prods.viewedNotAdded.map((p) => [
                p.title || "(unknown)",
                p.views,
                p.carts,
                `${(p.addRate * 100).toFixed(0)}%`,
              ])}
            />
          </div>
        </div>
      ) : (
        <Muted>
          {prods
            ? "No product activity on the Fyxx Friday site in this period."
            : `Products not available${why(r.products)}.`}
        </Muted>
      )}

      <footer className="mt-5 border-t border-border pt-2 text-[10px] leading-snug text-muted-foreground print:mt-3">
        <p className="font-medium">How these numbers are counted</p>
        <ul className="ml-4 list-disc">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          {cmp && <li>Total sales comparison basis: {cmp.basis}.</li>}
        </ul>
      </footer>
    </article>
  );
}
