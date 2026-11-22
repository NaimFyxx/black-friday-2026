import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  ErrorBox,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtRange,
  KindTag,
  Loading,
  Note,
  PageHeader,
  Panel,
  RangePicker,
  rangeFor,
  Section,
  SourceName,
  SourceSetupNotices,
  StatCard,
  TD,
  TDR,
  TH,
  THR,
  Toggle,
  TR,
  type Range,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { getLeaving, getSources, getTopAdded, type SourceRow } from "@/lib/admin.functions";
import { describeCampaign, describeSource, type SourceKind } from "@/lib/source-labels";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});

type TopAdded = Awaited<ReturnType<typeof getTopAdded>>;

function useTopAdded(range: "today" | "launch") {
  const fn = useServerFn(getTopAdded);
  return useQuery({
    queryKey: ["admin-top-added", range],
    queryFn: () => fn({ data: { range } }),
    staleTime: 30_000,
    retry: 1,
  });
}

function useLeaving(range: Range) {
  const fn = useServerFn(getLeaving);
  return useQuery({
    queryKey: ["admin-leaving", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });
}

function OverviewPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const range = rangeFor(rangeKey);
  const fn = useServerFn(getSources);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-sources", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });
  const launch = useTopAdded("launch");
  const leaving = useLeaving(range);

  const t = data?.totals;
  const cur = data?.currency ?? "JOD";

  return (
    <>
      <PageHeader title="Overview">
        How the Fyxx Friday site is doing: how many people came, what they put in their cart and
        what they ordered. Main numbers first, details further down.
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

          <Section
            title="The main numbers"
            intro="The five numbers to watch. The sections below show where they come from."
          >
            <KeyNumbers
              totals={t}
              currency={cur}
              launch={launch.data}
              leaving={leaving.data}
              leavingLoading={leaving.isLoading}
            />
          </Section>

          <Section
            title="Paid ads or free"
            intro="Visits and orders from paid ads next to free channels (email, the app, our own posts). Shows what the ad money brings in."
          >
            <PaidVsFree rows={data.rows} currency={cur} />
          </Section>

          <Section
            title="Where visitors came from"
            intro="Each place visitors came from and how far they got, from the first visit to an order. Use it to see which links and ads work."
          >
            <SourcesList rows={data.rows} currency={cur} />
            <Note>
              A visit is one browser tab session on this site: the same person coming back later
              counts again. Orders and sales are paid orders placed through this site&apos;s
              checkout (cancelled orders left out), credited to where the visitor first came from.
              The grey line under each name is the tracking tag on the link, for whoever made the
              link. &quot;Direct or unknown&quot; means no tag and no referring site: typed in, a
              bookmark or most apps (before 22 Nov the referring site wasn&apos;t saved at all). The
              team&apos;s own visits (preview link, or signed in to /admin on that browser) are left
              out. Tip: tag every link you share, for example{" "}
              <code>?utm_source=instagram&amp;utm_medium=story</code>, so it gets its own row here.
            </Note>
          </Section>
        </>
      )}

      <TopAddedSection />

      <LeavingSection range={range} />
    </>
  );
}

/** The five headline tiles. */
function KeyNumbers({
  totals: t,
  currency,
  launch,
  leaving,
  leavingLoading,
}: {
  totals: {
    sessions: number;
    cart_sessions: number;
    checkout_sessions: number;
    orders: number;
    revenue: number;
  };
  currency: string;
  launch: TopAdded | undefined;
  leaving: Awaited<ReturnType<typeof getLeaving>> | undefined;
  leavingLoading: boolean;
}) {
  const laterOrders = leaving?.orders ?? 0;
  const orders = t.orders + laterOrders;
  const sales = t.revenue + (leaving?.revenue ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Visits" value={fmtNum(t.sessions)} sub="one browser tab session each" />
      <StatCard
        label="Added to cart"
        value={fmtNum(t.cart_sessions)}
        sub={`visits that added something (${fmtPct(t.cart_sessions, t.sessions)})`}
      />
      <StatCard
        label="Went to checkout"
        value={fmtNum(t.checkout_sessions)}
        sub={`visits that reached checkout (${fmtPct(t.checkout_sessions, t.sessions)})`}
      />
      <StatCard
        label="Cart value, full price"
        value={launch ? fmtMoney(launch.totals.valueFull) : "…"}
        sub="everything added since launch, before discounts"
      />
      <div className="col-span-2 sm:col-span-1">
        <StatCard
          label="Orders on myfyxx.com"
          value={leavingLoading ? "…" : fmtNum(orders)}
          sub={
            leavingLoading
              ? undefined
              : `${fmtMoney(sales, currency)} in sales. ${fmtNum(t.orders)} through this site's checkout, ${fmtNum(laterOrders)} later on myfyxx.com`
          }
        />
      </div>
    </div>
  );
}

type Group = { visits: number; carts: number; orders: number; sales: number };

/** Totals per Paid / Free / Unknown, from the same rows as the sources list. */
function PaidVsFree({ rows, currency }: { rows: SourceRow[]; currency: string }) {
  const groups: Record<SourceKind, Group> = {
    paid: { visits: 0, carts: 0, orders: 0, sales: 0 },
    free: { visits: 0, carts: 0, orders: 0, sales: 0 },
    unknown: { visits: 0, carts: 0, orders: 0, sales: 0 },
  };
  for (const r of rows) {
    const g = groups[describeSource(r.utm_source, r.utm_medium).kind];
    g.visits += r.sessions;
    g.carts += r.cart_sessions;
    g.orders += r.orders;
    g.sales += r.revenue;
  }
  const blurb: Record<SourceKind, string> = {
    paid: "Instagram and Facebook ads",
    free: "Email, the Fyxx app, our own posts",
    unknown: "No tag on the link",
  };
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={TH}>Type</th>
            <th className={THR}>Visits</th>
            <th className={THR}>Added to cart</th>
            <th className={THR}>Orders</th>
            <th className={THR}>Sales</th>
          </tr>
        </thead>
        <tbody>
          {(["paid", "free", "unknown"] as const).map((k) => {
            const g = groups[k];
            return (
              <tr key={k} className={TR}>
                <td className={TD}>
                  <KindTag kind={k} />
                  <span className="mt-0.5 block text-xs text-muted-foreground">{blurb[k]}</span>
                </td>
                <td className={TDR}>{fmtNum(g.visits)}</td>
                <td className={TDR}>{fmtNum(g.carts)}</td>
                <td className={TDR}>{fmtNum(g.orders)}</td>
                <td className={TDR}>{fmtMoney(g.sales, currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg tabular-nums">{value}</dd>
    </div>
  );
}

/** Extra grey text under a source: campaign, or why the referring site is missing. */
function sourceExtra(r: SourceRow): string {
  if (r.utm_source === null && r.utm_medium === null)
    return "referring site not saved (before 22 Nov)";
  return describeCampaign(r.utm_campaign);
}

/** What goes out: clicks to myfyxx.com / the app, and website orders after a visit. */
function LeavingSection({ range }: { range: Range }) {
  const { data, isLoading, error } = useLeaving(range);
  return (
    <Section
      title="After visiting this site"
      intro="Visitors who went on to myfyxx.com or the Fyxx app, and the orders they placed on myfyxx.com later. These are sales the site helped with outside its own checkout."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Went to myfyxx.com"
              value={fmtNum(data.websiteClicks)}
              sub="link clicks"
            />
            <StatCard label="Went to the app" value={fmtNum(data.appClicks)} sub="link clicks" />
            <StatCard
              label="Orders later on myfyxx.com"
              value={fmtNum(data.orders)}
              sub="paid, within 30 days of a visit"
            />
            <StatCard
              label="Sales from those orders"
              value={fmtMoney(data.revenue, data.currency)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={TH}>Link clicked</th>
                    <th className={TH}>Went to</th>
                    <th className={THR}>Clicks</th>
                    <th className={THR}>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clicks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        Nobody has clicked out yet.
                      </td>
                    </tr>
                  ) : (
                    data.clicks.map((c) => (
                      <tr key={`${c.destination}|${c.link}`} className={TR}>
                        <td className={TD}>{c.link}</td>
                        <td className={TD}>
                          {c.destination === "app" ? "Fyxx app" : "myfyxx.com"}
                        </td>
                        <td className={TDR}>{fmtNum(c.clicks)}</td>
                        <td className={TDR}>{fmtNum(c.people)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
            <Panel className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={TH}>First came from</th>
                    <th className={THR}>Orders</th>
                    <th className={THR}>Sales</th>
                    <th className={THR}>New customers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySource.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        No orders on myfyxx.com from Friday visitors yet.
                      </td>
                    </tr>
                  ) : (
                    data.bySource.map((r) => (
                      <tr key={`${r.source}|${r.medium}`} className={TR}>
                        <td className={TD}>
                          <SourceName source={r.source} medium={r.medium} />
                        </td>
                        <td className={TDR}>{fmtNum(r.orders)}</td>
                        <td className={TDR}>{fmtMoney(r.revenue, data.currency)}</td>
                        <td className={TDR}>{fmtNum(r.new_customers)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Panel>
          </div>
          <Note>
            Clicks: visitors tapping a link from this site to myfyxx.com or the Fyxx app. Orders
            later: paid orders on myfyxx.com from a browser that visited this site in the 30 days
            before (needs the small snippet in the myfyxx.com theme). Orders in the app can&apos;t
            be linked: the app doesn&apos;t share the browser. Team visits are left out.
          </Note>
        </>
      )}
    </Section>
  );
}

/** "Most added to cart": adds, visits, full value, top first-touch source. */
function TopAddedSection() {
  const [range, setRange] = useState<"today" | "launch">("today");
  const { data, isLoading, error } = useTopAdded(range);
  const rows = data?.rows ?? [];
  return (
    <Section
      title="Most added to cart"
      intro="The products people put in their cart most, with what those carts are worth at full price. Shows what people want before prices drop."
      actions={
        <Toggle
          value={range}
          onChange={setRange}
          options={[
            { key: "today", label: "Today" },
            { key: "launch", label: "Since launch" },
          ]}
        />
      }
    >
      {data && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Cart value, full price"
            value={fmtMoney(data.totals.valueFull)}
            sub="everything added, before discounts"
          />
          <StatCard label="Times added" value={fmtNum(data.totals.adds)} sub="add to cart taps" />
          <StatCard
            label="Visits that added"
            value={fmtNum(data.totals.people)}
            sub="one browser tab session each"
          />
          <StatCard
            label="Average cart per visit"
            value={data.totals.people ? fmtMoney(data.totals.valueFull / data.totals.people) : "–"}
            sub="full price, visits that added"
          />
        </div>
      ) : null}
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading ? (
        <Loading />
      ) : (
        <Panel className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nothing added to a cart in this time yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={TH}>Product</th>
                  <th className={THR}>Times added</th>
                  <th className={`${THR} hidden sm:table-cell`}>Visits</th>
                  <th className={THR}>Full value</th>
                  <th className={`${TH} hidden sm:table-cell`}>Most came from</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product} className={TR}>
                    <td className={`${TD} font-medium`}>
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
                      <span className="mt-0.5 block text-xs font-normal sm:hidden">
                        <SourceName source={r.top_source} medium={null} />
                      </span>
                    </td>
                    <td className={TDR}>{fmtNum(r.adds)}</td>
                    <td className={`${TDR} hidden sm:table-cell`}>{fmtNum(r.people)}</td>
                    <td className={TDR}>{fmtMoney(r.value_full)}</td>
                    <td className={`${TD} hidden sm:table-cell`}>
                      <SourceName source={r.top_source} medium={null} />{" "}
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        ({fmtNum(r.top_source_adds)} adds)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
      <Note>
        From this site&apos;s own tracking. Full value = quantity x the regular price, even after
        the sale prices are set; items removed from a cart later still count. A visit is one browser
        tab session, so one person who comes back counts again. &quot;Most came from&quot; is where
        most of those visits first came from. Test visits (tags claude-qa or test) are left out.
        {data && <> Since {fmtRange({ since: data.since, until: new Date().toISOString() })}.</>}
      </Note>
    </Section>
  );
}

/** Phone and tablet: one card per source. Desktop: one table. */
function SourcesList({ rows, currency }: { rows: SourceRow[]; currency: string }) {
  if (rows.length === 0) {
    return (
      <Panel>
        <p className="p-4 text-center text-sm text-muted-foreground">No visits in this time yet.</p>
      </Panel>
    );
  }
  const key = (r: SourceRow) => `${r.utm_source}|${r.utm_medium}|${r.utm_campaign}`;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((r) => (
          <Panel key={key(r)}>
            <SourceName
              source={r.utm_source}
              medium={r.utm_medium}
              showRaw
              extra={sourceExtra(r)}
            />
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <Fig label="Visits" value={fmtNum(r.sessions)} />
              <Fig label="Viewed a product" value={fmtNum(r.product_views)} />
              <Fig label="Added to cart" value={fmtNum(r.cart_sessions)} />
              <Fig label="Went to checkout" value={fmtNum(r.checkout_sessions)} />
              <Fig label="Orders" value={fmtNum(r.orders)} />
              <Fig label="Sales" value={fmtMoney(r.revenue, currency)} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {fmtPct(r.orders, r.sessions)} of visits ordered · {fmtNum(r.new_customers)} new
              customer{r.new_customers === 1 ? "" : "s"}
            </p>
          </Panel>
        ))}
      </div>
      <Panel className="hidden overflow-x-auto p-0 lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className={TH}>Came from</th>
              <th className={THR}>Visits</th>
              <th className={THR}>Viewed a product</th>
              <th className={THR}>Added to cart</th>
              <th className={THR}>Went to checkout</th>
              <th className={THR}>Orders</th>
              <th className={THR}>Visits that ordered</th>
              <th className={THR}>Sales</th>
              <th className={THR}>New customers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={key(r)} className={TR}>
                <td className={TD}>
                  <SourceName
                    source={r.utm_source}
                    medium={r.utm_medium}
                    showRaw
                    extra={sourceExtra(r)}
                  />
                </td>
                <td className={TDR}>{fmtNum(r.sessions)}</td>
                <td className={TDR}>{fmtNum(r.product_views)}</td>
                <td className={TDR}>{fmtNum(r.cart_sessions)}</td>
                <td className={TDR}>{fmtNum(r.checkout_sessions)}</td>
                <td className={TDR}>{fmtNum(r.orders)}</td>
                <td className={TDR}>{fmtPct(r.orders, r.sessions)}</td>
                <td className={TDR}>{fmtMoney(r.revenue, currency)}</td>
                <td className={TDR}>{fmtNum(r.new_customers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
