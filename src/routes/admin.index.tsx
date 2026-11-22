import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  ErrorBox,
  fmtMoney,
  fmtPct,
  fmtRange,
  Loading,
  PageHeader,
  Panel,
  RangePicker,
  rangeFor,
  SourceSetupNotices,
  StatCard,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { getLeaving, getSources, getTopAdded, type SourceRow } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: SourcesPage,
});

function label(v: string | null) {
  return v ?? <span className="text-muted-foreground">(none)</span>;
}

function SourcesPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const range = rangeFor(rangeKey);
  const fn = useServerFn(getSources);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-sources", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });

  const t = data?.totals;
  const cur = data?.currency ?? "JOD";

  return (
    <>
      <PageHeader title="Sources">
        Where shoppers came from (first-touch <code>utm_source</code> / <code>medium</code> /{" "}
        <code>campaign</code>, or <code>fyxx_app</code> for <code>?from=app</code> links) and how
        far each source got: visits → product views → carts → checkouts → paid orders.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <RangePicker value={rangeKey} onChange={setRangeKey} />
        <span className="text-xs text-muted-foreground">{fmtRange(range)} (Amman time)</span>
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data || !t ? (
        <Loading />
      ) : (
        <>
          <SourceSetupNotices {...data.setup} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Visits" value={t.sessions.toLocaleString()} />
            <StatCard
              label="Added to cart"
              value={t.cart_sessions.toLocaleString()}
              sub={`${fmtPct(t.cart_sessions, t.sessions)} of visits`}
            />
            <StatCard
              label="Reached checkout"
              value={t.checkout_sessions.toLocaleString()}
              sub={`${fmtPct(t.checkout_sessions, t.sessions)} of visits`}
            />
            <StatCard
              label="Orders"
              value={t.orders.toLocaleString()}
              sub={`${fmtPct(t.orders, t.sessions)} conversion`}
            />
            <StatCard label="Revenue" value={fmtMoney(t.revenue, cur)} />
            <StatCard
              label="New customers"
              value={t.new_customers.toLocaleString()}
              sub="first order ever"
            />
          </div>

          <Panel className="overflow-x-auto p-0">
            <SourcesTable rows={data.rows} currency={cur} />
          </Panel>

          <p className="text-xs text-muted-foreground">
            Visits are browser sessions on this site. Orders and revenue are paid Shopify orders
            placed through this site (cancelled orders excluded), credited to the source the shopper
            first arrived from. Tip: add <code>?utm_source=instagram&amp;utm_medium=story</code>{" "}
            style tags to every link you share so it shows up here. Visits without tags ("No tag")
            show where they came from in the Medium column (for example <code>instagram.com</code>,
            or <code>direct</code> for typed links, bookmarks and most apps); visits recorded before
            22 Nov show <em>not recorded</em>. The team's own visits (preview link or signed in to
            /admin on that browser) are left out.
          </p>
        </>
      )}

      <TopAddedSection />

      <LeavingSection range={range} />
    </>
  );
}

/** What goes out: clicks to myfyxx.com / the app, and website orders after a visit. */
function LeavingSection({ range }: { range: { since: string; until: string } }) {
  const fn = useServerFn(getLeaving);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-leaving", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });
  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-lg font-semibold">After the Friday site</h2>
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Left for the website" value={data.websiteClicks.toLocaleString()} />
            <StatCard label="Left for the app" value={data.appClicks.toLocaleString()} />
            <StatCard
              label="Website orders after a visit"
              value={data.orders.toLocaleString()}
              sub="paid orders on myfyxx.com"
            />
            <StatCard label="Their revenue" value={fmtMoney(data.revenue, data.currency)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Link clicked</th>
                    <th className="px-4 py-3 font-medium">To</th>
                    <th className="px-4 py-3 text-right font-medium">Clicks</th>
                    <th className="px-4 py-3 text-right font-medium">People</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clicks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        No clicks out yet.
                      </td>
                    </tr>
                  ) : (
                    data.clicks.map((c) => (
                      <tr
                        key={`${c.destination}|${c.link}`}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-2.5">{c.link}</td>
                        <td className="px-4 py-2.5">
                          {c.destination === "app" ? "App" : "Website"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{c.clicks}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{c.people}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
            <Panel className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">First came from</th>
                    <th className="px-4 py-3 text-right font-medium">Website orders</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">New cust.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySource.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        No website orders from Friday visitors yet.
                      </td>
                    </tr>
                  ) : (
                    data.bySource.map((r) => (
                      <tr
                        key={`${r.source}|${r.medium}`}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          {r.source ?? "No tag"}
                          {r.medium ? (
                            <span className="text-muted-foreground"> · {r.medium}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.orders}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmtMoney(r.revenue, data.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.new_customers}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </div>
          <p className="text-xs text-muted-foreground">
            Clicks: visitors tapping a link from this site to myfyxx.com or the Fyxx app (the links
            carry utm_source=fyxx-friday-site, so Shopify's own reports show them too). Website
            orders: paid orders on myfyxx.com from a browser that visited this site in the 30 days
            before (needs the small snippet in the myfyxx.com theme). App orders can't be linked:
            the app doesn't share the browser. Team visits are left out.
          </p>
        </>
      )}
    </section>
  );
}

/** "Most added to cart": adds, people (sessions), value, top first-touch source. */
function TopAddedSection() {
  const [range, setRange] = useState<"today" | "launch">("today");
  const fn = useServerFn(getTopAdded);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-top-added", range],
    queryFn: () => fn({ data: { range } }),
    staleTime: 30_000,
    retry: 1,
  });
  const rows = data?.rows ?? [];
  return (
    <section className="mt-10 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Most added to cart</h2>
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
          {(["today", "launch"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={
                range === k
                  ? "rounded bg-foreground px-3 py-1 text-background"
                  : "rounded px-3 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              {k === "today" ? "Today" : "Since launch"}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading ? (
        <Loading />
      ) : (
        <Panel className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No add to carts in this range yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 text-right font-medium">Adds</th>
                  <th className="px-4 py-3 text-right font-medium">People</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Top source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {r.handle ? (
                        <a
                          href={`/product/${r.handle}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {r.product}
                        </a>
                      ) : (
                        r.product
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.adds}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.people}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(r.value)}</td>
                    <td className="px-4 py-2.5">
                      {r.top_source ?? "(direct)"}{" "}
                      <span className="text-xs text-muted-foreground">({r.top_source_adds})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
      <p className="text-xs text-muted-foreground">
        From this site's own tracking (add to cart events). People = browser sessions. Source =
        where the shopper first came from. Test visits (utm_source claude-qa or test) are left out.
        {data && <> Since {fmtRange({ since: data.since, until: new Date().toISOString() })}.</>}
      </p>
    </section>
  );
}

function SourcesTable({ rows, currency }: { rows: SourceRow[]; currency: string }) {
  if (rows.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">No visits in this range yet.</p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
          <th className="px-4 py-3 font-medium">Source</th>
          <th className="px-4 py-3 font-medium">Medium</th>
          <th className="px-4 py-3 font-medium">Campaign</th>
          <th className="px-4 py-3 text-right font-medium">Visits</th>
          <th className="px-4 py-3 text-right font-medium">Viewed product</th>
          <th className="px-4 py-3 text-right font-medium">Cart</th>
          <th className="px-4 py-3 text-right font-medium">Checkout</th>
          <th className="px-4 py-3 text-right font-medium">Orders</th>
          <th className="px-4 py-3 text-right font-medium">Conv.</th>
          <th className="px-4 py-3 text-right font-medium">Revenue</th>
          <th className="px-4 py-3 text-right font-medium">New cust.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={`${r.utm_source}|${r.utm_medium}|${r.utm_campaign}`}
            className="border-b border-border/60 last:border-0"
          >
            {/* No UTM tags: "No tag", the medium column shows where they came from. */}
            <td className="px-4 py-2.5 font-medium">
              {r.utm_source ?? <span className="text-muted-foreground">No tag</span>}
            </td>
            <td className="px-4 py-2.5">
              {r.utm_source === null && r.utm_medium === null ? (
                <span className="text-muted-foreground">not recorded (before 22 Nov)</span>
              ) : (
                label(r.utm_medium)
              )}
            </td>
            <td className="px-4 py-2.5">
              {r.utm_source === null ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                label(r.utm_campaign)
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{r.sessions.toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {r.product_views.toLocaleString()}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {r.cart_sessions.toLocaleString()}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {r.checkout_sessions.toLocaleString()}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{r.orders.toLocaleString()}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtPct(r.orders, r.sessions)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(r.revenue, currency)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {r.new_customers.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
