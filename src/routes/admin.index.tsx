import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { FreeBottlesAdmin } from "@/components/admin/FreeBottlesAdmin";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ErrorBox,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtRange,
  JumpNav,
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
import {
  getCarts,
  getOfferSwitches,
  setOfferSwitch,
  type OfferKey,
  getLeaving,
  getRewardsFunnel,
  getSalesForecast,
  getSources,
  getTopAdded,
  type Bucket,
  type DaySales,
  type HourCount,
  type SourceRow,
  getOrdersList,
  getVisitors,
} from "@/lib/admin.functions";
import { formatJod } from "@/lib/shopify";
import { describeSource, type SourceKind } from "@/lib/source-labels";

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

/** The "Jump to" bar, in page order. Titles must match the Section titles. */
const JUMP_LINKS = [
  { title: "The main numbers", label: "Main numbers" },
  { title: "All orders", label: "Orders" },
  { title: "Paid ads or free", label: "Paid or free" },
  { title: "Where visitors came from", label: "Where from" },
  { title: "Visitors who came back", label: "Came back" },
  { title: "Sales forecast", label: "Forecast" },
  { title: "Fyxx Rewards", label: "Rewards" },
  { title: "Carts", label: "Carts" },
  { title: "Most added to cart", label: "Most added" },
  { title: "After visiting this site", label: "After visiting" },
  { title: "Offers on the site", label: "Offers" },
  { title: "Free bottles bar", label: "Free bottles" },
];

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

      <JumpNav items={JUMP_LINKS} />

      <OffersSection />
      <FreeBottlesAdmin />

      <div className="mt-8 flex flex-wrap items-center gap-3">
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

          <OrdersSection range={range} />

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
              A visit is one browser tab session, so someone coming back counts again. Orders are
              paid orders through this site&apos;s checkout, credited to where the visitor first
              came from. &quot;Direct or unknown&quot; means no tag on the link. Hold the pointer on
              a name to see the link tags behind it. Team visits and test links are left out.
            </Note>
          </Section>
        </>
      )}

      <VisitorsSection range={range} />

      <SalesForecastSection />
      <RewardsSection />

      <CartsSection />

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

/** Margin % as in Zeid's sheet: margin / sales without the 16% tax. */
const marginPct = (margin: number, net: number) =>
  net > 0 ? `${((margin / net) * 100).toFixed(1)}%` : "";

/** One bucket minus a part of it (e.g. website minus the Fyxx Friday site). */
function minusBucket(all: Bucket, part: Bucket): Bucket {
  const out = { ...all };
  for (const k of Object.keys(out) as Array<keyof Bucket>) out[k] = all[k] - part[k];
  return out;
}

/** Add buckets together (Digital = website + app; staff = staff + other). */
function sumBuckets(...bs: Bucket[]): Bucket {
  const out: Bucket = {
    orders: 0,
    total: 0,
    margin: 0,
    costedNet: 0,
    uncosted: 0,
    giftCards: 0,
    memberOrders: 0,
    memberTotal: 0,
    newCustomers: 0,
    noCustomer: 0,
  };
  for (const b of bs) for (const k of Object.keys(out) as Array<keyof Bucket>) out[k] += b[k];
  return out;
}

/** "Most added to cart": adds, visits, full value, top first-touch source. */
/** "Sales forecast": carts at Friday prices before the sale, live sales and pace on the
 *  day, and this year vs last year by channel. */
function SalesForecastSection() {
  const fn = useServerFn(getSalesForecast);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-sales-forecast"],
    queryFn: () => fn(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  return (
    <Section
      title="Sales forecast"
      intro={
        data?.mode === "before"
          ? "What the sale could bring in, from what people have in their carts now, and last year's Fyxx Friday by channel."
          : "Shopify sales on Fyxx Friday, every channel, against last year. Updates every 5 minutes."
      }
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {data.mode === "before" && data.carts ? (
            <Panel className="space-y-2">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Digital, estimate from carts
              </p>
              <p className="font-display text-2xl tabular-nums">{formatJod(data.carts.value)}</p>
              <p className="text-xs text-muted-foreground">
                In {data.carts.carts} carts right now, at Friday prices.
              </p>
              {data.carts.costedNet > 0 && (
                <p className="text-sm">
                  Margin{" "}
                  <span className="tabular-nums">
                    {formatJod(data.carts.margin)} (
                    {marginPct(data.carts.margin, data.carts.costedNet)})
                  </span>
                </p>
              )}
              <ul className="space-y-1 pt-1 text-sm">
                {data.carts.rates.map((r) => (
                  <li key={r} className="flex justify-between gap-3">
                    <span>If {Math.round(r * 100)}% of carts buy</span>
                    <span className="text-right tabular-nums">
                      {formatJod((data.carts?.value ?? 0) * r)}
                      {data.carts && data.carts.costedNet > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          Margin {formatJod(data.carts.margin * r)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-xs text-muted-foreground">
                Items taken out of a cart are still counted, so this runs a little high. Margin as
                in Zeid&apos;s sale sheet: price without the 16% sales tax, minus cost.
                {data.carts.uncosted > 0 &&
                  ` ${formatJod(data.carts.uncosted)} with no known cost (gift cards and the like) is left out of the margin.`}
              </p>
            </Panel>
          ) : (
            <Panel className="space-y-2">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                {data.mode === "friday" ? "So far today" : "Fyxx Friday total"}
              </p>
              {data.thisYear ? (
                <>
                  <p className="font-display text-2xl tabular-nums">
                    {formatJod(data.thisYear.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.thisYear.orders} orders since 00:00, every channel.
                  </p>
                  <p className="text-sm">
                    Without in-store and Dine-In{" "}
                    <span className="tabular-nums">
                      {formatJod(
                        data.thisYear.total -
                          data.thisYear.channels.inStore.total -
                          data.thisYear.channels.dineIn.total,
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {data.thisYear.orders -
                        data.thisYear.channels.inStore.orders -
                        data.thisYear.channels.dineIn.orders}{" "}
                      orders: website, app and staff orders.
                    </span>
                  </p>
                  {data.record && data.record.total > 0 && (
                    <p className="text-sm">
                      {data.thisYear.total >= data.record.total ? (
                        <span className="font-medium text-emerald-700">
                          New record! Beats {data.record.label} ({formatJod(data.record.total)})
                        </span>
                      ) : (
                        <>
                          Record to beat: {data.record.label}{" "}
                          <span className="tabular-nums">{formatJod(data.record.total)}</span>
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {formatJod(data.record.total - data.thisYear.total)} to go (
                            {Math.round((data.thisYear.total / data.record.total) * 100)}% there)
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {data.thisYear.costedNet > 0 && (
                    <p className="text-sm">
                      Margin{" "}
                      <span className="tabular-nums">
                        {formatJod(data.thisYear.margin)} (
                        {marginPct(data.thisYear.margin, data.thisYear.costedNet)})
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Shopify sales can&apos;t be read right now. Try again in a few minutes.
                </p>
              )}
              {data.mode === "friday" && (
                <div className="border-t border-border pt-2">
                  <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    At this pace by midnight
                  </p>
                  <p className="font-display text-2xl tabular-nums">
                    {data.pace !== null ? formatJod(data.pace) : "Too early to tell"}
                  </p>
                  {data.pace !== null && data.thisYear && data.thisYear.total > 0 && (
                    <p className="text-sm">
                      Margin about{" "}
                      <span className="tabular-nums">
                        {formatJod((data.pace * data.thisYear.margin) / data.thisYear.total)}
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {data.pace !== null
                      ? "Based on last year's hour-by-hour pattern."
                      : `Shown from ${data.tooEarlyBefore}:00. Based on last year's hour-by-hour pattern.`}
                  </p>
                </div>
              )}
            </Panel>
          )}
          {data.lastYear && (
            <ChannelCompare
              lastYear={data.lastYear}
              thisYear={data.thisYear}
              before={data.mode === "before"}
            />
          )}
          {data.hours.lastYear && (
            <HoursChart
              thisYear={data.hours.thisYear}
              lastYear={data.hours.lastYear}
              nowHour={data.mode === "friday" ? ammanNowHour(data.now) : null}
            />
          )}
        </div>
      )}
    </Section>
  );
}

/** Fyxx Rewards on this site: tiers opened, Log in / Join taps, sign-ins, new accounts, member orders. */
function RewardsSection() {
  const fn = useServerFn(getRewardsFunnel);
  const salesFn = useServerFn(getSalesForecast);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-rewards-funnel"],
    queryFn: () => fn(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  // Member orders come with the day's sales (same data as the sales forecast).
  const { data: sales } = useQuery({
    queryKey: ["admin-sales-forecast"],
    queryFn: () => salesFn(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const places = [
    { key: "home", label: "Home" },
    { key: "cart", label: "Cart" },
    { key: "product", label: "Product page" },
  ];
  const steps = [
    { event: "tier_points_open", label: "Opened the Rewards tiers" },
    { event: "tier_points_login_tap", label: "Tapped Log in" },
    { event: "tier_points_join_tap", label: "Tapped Join" },
    { event: "rewards_signin", label: "Signed in (already a member)", strong: true },
    { event: "rewards_signup", label: "Created an account (new member)", strong: true },
  ];
  const count = (event: string, place?: string) =>
    (data ?? [])
      .filter((r) => r.event === event && (!place || r.place === place))
      .reduce((t, r) => t + r.people, 0);
  const members = sales?.thisYear ?? null;
  return (
    <Section
      title="Fyxx Rewards"
      intro="People who looked at Fyxx Rewards on this site, signed in or created an account. Counted once per visit; team visits left out."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={TH}>Step</th>
                  {places.map((p) => (
                    <th key={p.key} className={THR}>
                      {p.label}
                    </th>
                  ))}
                  <th className={THR}>Total</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((st) => (
                  <tr key={st.event} className={TR}>
                    <td className={TD}>
                      <span className={st.strong ? "font-medium" : ""}>{st.label}</span>
                    </td>
                    {places.map((p) => (
                      <td key={p.key} className={TDR}>
                        {count(st.event, p.key) || "–"}
                      </td>
                    ))}
                    <td className={`${TDR} ${st.strong ? "font-medium" : ""}`}>
                      {count(st.event)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel className="space-y-2">
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Orders by signed-in members
            </p>
            {members ? (
              <>
                <p className="font-display text-2xl tabular-nums">{members.memberOrders}</p>
                <p className="text-xs text-muted-foreground">
                  {formatJod(members.memberTotal)} in orders since 00:00 Friday.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Counted from Friday 00:00.</p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Orders where the shopper was signed in to Fyxx Rewards on this site at checkout (their
              email and address are filled in for them, so the order earns their points). Counted
              from carts made after the 27 Nov update.
            </p>
          </Panel>
        </div>
      )}
    </Section>
  );
}

/** Hour of the day in Amman (UTC+3) for an ISO time. */
const ammanNowHour = (iso: string) => new Date(Date.parse(iso) + 3 * 3_600_000).getUTCHours();

/** Orders per hour (Amman time), today against last year's Fyxx Friday, every channel. */
function HoursChart({
  thisYear,
  lastYear,
  nowHour,
}: {
  thisYear: HourCount[] | null;
  lastYear: HourCount[];
  nowHour: number | null;
}) {
  const rows = lastYear.map((ly, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    // Hours still to come today stay empty rather than showing 0.
    y2026: thisYear && (nowHour === null || h <= nowHour) ? thisYear[h]!.orders : null,
    y2025: ly.orders,
    s2026: thisYear ? thisYear[h]!.total : null,
    s2025: ly.total,
  }));
  const busiest = thisYear
    ? thisYear.reduce((best, x, h) => (x.orders > thisYear[best]!.orders ? h : best), 0)
    : null;
  return (
    <Panel className="lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Orders per hour
        </p>
        {busiest !== null && thisYear && thisYear[busiest]!.orders > 0 && (
          <p className="text-xs text-muted-foreground">
            Busiest hour today: {String(busiest).padStart(2, "0")}:00 with{" "}
            {thisYear[busiest]!.orders} orders ({formatJod(thisYear[busiest]!.total)})
          </p>
        )}
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barGap={1}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} tickLine={false} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fillOpacity: 0.06 }}
              formatter={(v, name, item) => {
                const p = item?.payload as (typeof rows)[number] | undefined;
                const sales = name === "2026 (today)" ? p?.s2026 : p?.s2025;
                return [`${v} orders${sales != null ? `, ${formatJod(sales)}` : ""}`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="y2025"
              name="2025"
              fill="var(--ff-burgundy)"
              fillOpacity={0.25}
              radius={[2, 2, 0, 0]}
            />
            <Bar dataKey="y2026" name="2026 (today)" fill="var(--ff-red)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Amman time, every channel (online, app, staff orders and both Odoo tills). Grey: Fyxx Friday
        2025 (28 Nov 2025). Hover a bar for the sales.
      </p>
    </Panel>
  );
}

/** This year vs last year: total, Digital (website + app), in store, staff orders. */
function ChannelCompare({
  lastYear,
  thisYear,
  before,
}: {
  lastYear: DaySales;
  thisYear: DaySales | null;
  before: boolean;
}) {
  const digital = (d: DaySales) => sumBuckets(d.channels.website, d.channels.app);
  const staff = (d: DaySales) => sumBuckets(d.channels.staff, d.channels.other);
  const rows: Array<{
    label: string;
    sub?: boolean;
    strong?: boolean;
    pick: (d: DaySales) => Bucket;
  }> = [
    { label: "Total", strong: true, pick: (d) => d },
    {
      label: "Total without in-store and Dine-In",
      strong: true,
      pick: (d) =>
        sumBuckets(d.channels.website, d.channels.app, d.channels.staff, d.channels.other),
    },
    { label: "Digital (website + app)", strong: true, pick: digital },
    // Website split by the Shopify sales channel: "Online Store" = myfyxx.com,
    // "Lovable" = the Fyxx Friday site.
    {
      label: "Online Store",
      sub: true,
      pick: (d) => minusBucket(d.channels.website, d.channels.fridaySite),
    },
    { label: "Lovable", sub: true, pick: (d) => d.channels.fridaySite },
    { label: "Mobile app", sub: true, pick: (d) => d.channels.app },
    {
      label: "Shop (in-store + Dine-In)",
      strong: true,
      pick: (d) => sumBuckets(d.channels.inStore, d.channels.dineIn),
    },
    { label: "In-store (Retail till)", sub: true, pick: (d) => d.channels.inStore },
    { label: "Dine-In", sub: true, pick: (d) => d.channels.dineIn },
    { label: "Staff and other orders (draft, phone)", strong: true, pick: staff },
  ];
  const num = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const avg = (b: Bucket) => (b.orders > 0 ? b.total / b.orders : null);
  const mPct = (b: Bucket) => (b.costedNet > 0 ? marginPct(b.margin, b.costedNet) : "");
  /** Change against 2025 as a small pill: green up, red down; nothing when 2025 was 0. */
  const Change = ({ now, was }: { now: number; was: number | null }) => {
    if (was === null || !(was > 0)) return null;
    const pct = Math.round(((now - was) / was) * 100);
    const up = pct >= 0;
    return (
      <span
        className={`ml-1.5 inline-block rounded-full px-1.5 py-px text-[10px] font-medium ${
          up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}
      >
        {up ? "+" : ""}
        {pct}%
      </span>
    );
  };
  /**
   * One number: 2026 on top with its change, 2025 underneath in grey. Before
   * the sale (no 2026 yet) just the 2025 number.
   */
  const Metric = ({
    now,
    was,
    show,
    nowNote,
    wasNote,
  }: {
    now: number | null | undefined;
    was: number | null;
    show: (v: number) => string;
    nowNote?: string | undefined;
    wasNote?: string | undefined;
  }) => {
    if (now === undefined)
      return (
        <span className="tabular-nums">
          {was === null ? "–" : show(was)}
          {wasNote && <span className="text-xs text-muted-foreground"> {wasNote}</span>}
        </span>
      );
    return (
      <>
        {/* 2026: dark and a little larger. */}
        <span className="font-medium text-foreground tabular-nums">
          {now === null ? "–" : show(now)}
          {nowNote && <span className="text-xs font-normal"> {nowNote}</span>}
        </span>
        {now !== null && <Change now={now} was={was} />}
        {/* 2025: small, light grey, with a "2025" tag, so it reads as the reference. */}
        <span className="mt-1 block text-[11px] text-foreground/40 tabular-nums">
          <span className="mr-1 rounded bg-foreground/5 px-1 py-px text-[9px] tracking-wider">
            2025
          </span>
          {was === null || was === 0 ? "–" : show(was)}
          {was ? (wasNote ? ` ${wasNote}` : "") : ""}
        </span>
      </>
    );
  };
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={TH}>
              By channel
              <span className="mt-0.5 block text-[10px] font-normal text-foreground/40">
                Dark: 2026 so far. Grey: 2025.
              </span>
            </th>
            <th className={THR}>Sales (JOD)</th>
            <th className={THR}>Orders</th>
            <th className={THR}>Average order</th>
            <th className={THR}>New customers</th>
            <th className={THR}>Margin (JOD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const was = r.pick(lastYear);
            const now = thisYear ? r.pick(thisYear) : null;
            const has = now !== null;
            return (
              <tr key={r.label} className={`${TR} ${r.strong ? "" : "text-[13px]"}`}>
                <td className={TD}>
                  <span
                    className={
                      r.sub ? "block pl-4 text-muted-foreground" : r.strong ? "font-medium" : ""
                    }
                  >
                    {r.label}
                  </span>
                </td>
                <td className={TDR}>
                  <Metric now={has ? now.total : undefined} was={was.total} show={num} />
                </td>
                <td className={TDR}>
                  <Metric now={has ? now.orders : undefined} was={was.orders} show={String} />
                </td>
                <td className={TDR}>
                  <Metric now={has ? avg(now) : undefined} was={avg(was)} show={num} />
                </td>
                <td className={TDR}>
                  <Metric
                    now={has ? now.newCustomers : undefined}
                    was={was.newCustomers}
                    show={String}
                  />
                </td>
                <td className={TDR}>
                  <Metric
                    now={has ? (now.costedNet > 0 ? now.margin : null) : undefined}
                    was={was.costedNet > 0 ? was.margin : null}
                    show={num}
                    nowNote={has ? mPct(now) : undefined}
                    wasNote={mPct(was)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground sm:px-4">
        {before
          ? "Fyxx Friday 2025 (28 Nov 2025); 2026 fills in from Friday. "
          : "Fyxx Friday 2026 so far on top, the whole of 2025 (28 Nov 2025) underneath in grey; the pill is the change. "}
        Whole day, 00:00 to midnight Amman time. Shopify orders, cancelled ones left out. Online
        Store = myfyxx.com; Lovable = the Fyxx Friday site (friday.myfyxx.com). New customers:
        orders that were the shopper&apos;s first ever Fyxx order (orders with no customer attached,
        common in store, can&apos;t be counted). Margin as in Zeid&apos;s sale sheet: price after
        discounts without the 16% sales tax, minus cost, on items with a known cost; free gifts
        count as cost, gift cards left out. 2025 margin uses this year&apos;s costs. In 2026
        in-store (the Retail till) and Dine-In are read straight from Odoo POS; in 2025 in-store was
        Shopify POS.
      </p>
    </Panel>
  );
}

/** "Offers on the site": on/off switches, live on the site without a Publish. */
function OffersSection() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getOfferSwitches);
  const setFn = useServerFn(setOfferSwitch);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-offers"],
    queryFn: () => getFn(),
    staleTime: 10_000,
  });
  const [saving, setSaving] = useState<OfferKey | null>(null);
  const flip = async (key: OfferKey, enabled: boolean) => {
    setSaving(key);
    try {
      await setFn({ data: { key, enabled } });
      await queryClient.invalidateQueries({ queryKey: ["admin-offers"] });
      toast.success(enabled ? "Switched on" : "Switched off", {
        description: "Live on the site within a minute.",
      });
    } catch (e) {
      toast.error("Couldn't save", { description: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };
  const rows: Array<{ key: OfferKey; title: string; description: string; on: boolean }> = data
    ? [
        {
          key: "gift_card_discount_enabled",
          title: `Gift cards ${data.gift_card_discount_pct}% off`,
          description: `The gift card sticker in the hero shows "${data.gift_card_discount_pct}% OFF", crossed-out prices and the lower price. Set up the matching discount in Shopify first: the cart charges Shopify's price.`,
          on: data.gift_card_discount_enabled,
        },
        {
          key: "rewards_enabled",
          title: "Free bottles bar (replaces the Green Room mystery gift)",
          description:
            "The progress bar with five stars (JOD 50 to 250, each a better free bottle): home page, product cards and pages, the cart, the floating cart bar and a short message after each add to cart. Display only: no bottle is added to orders. Amounts, text and bottles: see Free bottles bar below.",
          on: data.rewards_enabled,
        },
        {
          key: "rewards_preview_only",
          title: "Free bottles bar: preview only for me",
          description:
            "On: only phones that opened friday.myfyxx.com/?preview=rewards see the bar (?preview=off hides it again). Off: everyone sees it while the switch above is on.",
          on: data.rewards_preview_only,
        },
        {
          key: "rewards_strip_enabled",
          title: "Fyxx Rewards line",
          description:
            'The thin "Members earn up to 2x points" line with See tiers, under the hero on the home page and under Add to cart on product pages.',
          on: data.rewards_strip_enabled,
        },
        {
          key: "last_piece_enabled",
          title: "Last piece label",
          description:
            'Red "Last piece" text on product cards and product pages when only one is left in stock.',
          on: data.last_piece_enabled,
        },
        {
          key: "show_planned_discount",
          title: "Show the Friday % before 10:00",
          description:
            'Product photos show the real planned discount ("-25% off on Friday") instead of a blurred number before the sale starts. Off: blurred again. From 10:00 Friday the real Shopify discount shows either way.',
          on: data.show_planned_discount,
        },
        {
          key: "sale_extras_enabled",
          title: "Sale-time extras from 10:00",
          description:
            'Off: from 10:00 the home page keeps its current look. On: adds "Up to X% off", the "ends at midnight" countdown, quick links, the Top deals row, "Up to X%" under the category circles, the discount filter and sort, and "Only X left". Badges show "-25%" instead of "-25% off".',
          on: data.sale_extras_enabled,
        },
      ]
    : [];
  return (
    <Section
      title="Offers on the site"
      intro="Switch these on or off. The site updates within a minute, no Publish needed."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading ? (
        <Loading />
      ) : (
        <Panel className="divide-y divide-border p-0">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {r.title}{" "}
                  <span
                    className={
                      r.on
                        ? "ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 uppercase"
                        : "ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase"
                    }
                  >
                    {r.on ? "On" : "Off"}
                  </span>
                </p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{r.description}</p>
              </div>
              <Switch
                checked={r.on}
                disabled={saving !== null}
                onCheckedChange={(v) => void flip(r.key, v)}
                aria-label={r.title}
                className="mt-1 shrink-0"
              />
            </div>
          ))}
        </Panel>
      )}
    </Section>
  );
}

/** "Carts": every shopper's cart, latest first, with what's in it. */
function CartsSection() {
  const fn = useServerFn(getCarts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-carts"],
    queryFn: () => fn(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const rows = data?.rows ?? [];
  const total = rows.reduce((a, r) => a + r.value_full, 0);
  const totalFriday = rows.reduce((a, r) => a + r.value_friday, 0);
  const sum = (k: "margin_full" | "net_full" | "margin_friday" | "net_friday") =>
    rows.reduce((a, r) => a + r[k], 0);
  const marginSub = (m: number, net: number) =>
    net > 0 ? `Margin ${formatJod(m)} (${marginPct(m, net)}) if all of it sold` : undefined;
  return (
    <Section
      title="Carts"
      intro="Every shopper's cart right now, most recently active first: what's in it and what it's worth. One row per browser; the team's own visits and tests are left out."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">No carts yet.</p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Carts" value={String(rows.length)} />
            <StatCard
              label="Went to checkout"
              value={String(rows.filter((r) => r.checkout).length)}
            />
            <StatCard
              label="Total, full price"
              value={formatJod(total)}
              sub={marginSub(sum("margin_full"), sum("net_full"))}
            />
            <StatCard
              label="Total, Friday prices"
              value={formatJod(totalFriday)}
              sub={marginSub(sum("margin_friday"), sum("net_friday"))}
            />
          </div>
          <Panel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={TH}>Shopper</th>
                  <th className={TH}>What's in the cart</th>
                  <th className={THR}>Value</th>
                  <th className={THR}>At Friday prices</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.session} className={TR}>
                    <td className={`${TD} min-w-[150px]`}>
                      <p className="font-medium">Shopper {i + 1}</p>
                      <SourceName
                        source={r.utm_source}
                        medium={r.utm_source ? r.utm_medium : r.referrer}
                      />
                      <p className="text-xs text-muted-foreground">
                        Last active {fmtDate(r.last_at, true)}
                        {r.checkout ? ", went to checkout" : ""}
                      </p>
                    </td>
                    <td className={`${TD} min-w-[220px]`}>
                      <CartItems items={r.items} units={r.units} />
                    </td>
                    <td className={TDR}>{formatJod(r.value_full)}</td>
                    <td className={TDR}>{formatJod(r.value_friday)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Note>
            Value is quantity x the regular price; &quot;At Friday prices&quot; uses the planned
            sale prices. Items taken out of a cart are still counted. A cart that went to checkout
            shows what was in it at checkout, plus anything added after.
          </Note>
        </>
      )}
    </Section>
  );
}

/** First three products, the rest behind "and N more". */
function CartItems({
  items,
  units,
}: {
  items: Array<{ title: string; qty: number }>;
  units: number;
}) {
  const line = (it: { title: string; qty: number }, k: number) => (
    <li key={k}>
      {it.qty > 1 ? `${it.qty} x ` : ""}
      {it.title}
    </li>
  );
  const head = items.slice(0, 3);
  const rest = items.slice(3);
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {units} {units === 1 ? "item" : "items"}
      </p>
      <ul className="mt-0.5 space-y-0.5">{head.map(line)}</ul>
      {rest.length > 0 && (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            and {rest.length} more
          </summary>
          <ul className="mt-0.5 space-y-0.5">{rest.map((it, k) => line(it, k + 3))}</ul>
        </details>
      )}
    </div>
  );
}

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
type SourceGroup = {
  name: string;
  kind: SourceKind;
  tags: string[];
  sessions: number;
  product_views: number;
  cart_sessions: number;
  checkout_sessions: number;
  orders: number;
  revenue: number;
  new_customers: number;
};

/**
 * One row per friendly name (e.g. both "Direct or unknown" rows become one).
 * Free or unknown sources that never got a cart or an order are folded into a
 * single "Other" row that opens to list them. Paid ads always get their own row.
 */
function groupSources(rows: SourceRow[]): { main: SourceGroup[]; other: SourceGroup[] } {
  const groups = new Map<string, SourceGroup>();
  for (const r of rows) {
    const l = describeSource(r.utm_source, r.utm_medium);
    const k = `${l.name}|${l.kind}`;
    let g = groups.get(k);
    if (!g) {
      g = {
        name: l.name,
        kind: l.kind,
        tags: [],
        sessions: 0,
        product_views: 0,
        cart_sessions: 0,
        checkout_sessions: 0,
        orders: 0,
        revenue: 0,
        new_customers: 0,
      };
      groups.set(k, g);
    }
    if (l.raw && !g.tags.includes(l.raw)) g.tags.push(l.raw);
    g.sessions += r.sessions;
    g.product_views += r.product_views;
    g.cart_sessions += r.cart_sessions;
    g.checkout_sessions += r.checkout_sessions;
    g.orders += r.orders;
    g.revenue += r.revenue;
    g.new_customers += r.new_customers;
  }
  const all = [...groups.values()].sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);
  const small = (g: SourceGroup) => g.kind !== "paid" && g.cart_sessions === 0 && g.orders === 0;
  return { main: all.filter((g) => !small(g)), other: all.filter(small) };
}

function sumGroups(name: string, list: SourceGroup[]): SourceGroup {
  return list.reduce<SourceGroup>(
    (t, g) => ({
      ...t,
      sessions: t.sessions + g.sessions,
      product_views: t.product_views + g.product_views,
      cart_sessions: t.cart_sessions + g.cart_sessions,
      checkout_sessions: t.checkout_sessions + g.checkout_sessions,
      orders: t.orders + g.orders,
      revenue: t.revenue + g.revenue,
      new_customers: t.new_customers + g.new_customers,
    }),
    {
      name,
      kind: "unknown",
      tags: [],
      sessions: 0,
      product_views: 0,
      cart_sessions: 0,
      checkout_sessions: 0,
      orders: 0,
      revenue: 0,
      new_customers: 0,
    },
  );
}

function GroupName({ g, isOther }: { g: SourceGroup; isOther?: boolean | undefined }) {
  return (
    <span className="inline-block min-w-0 align-top">
      <span className="font-medium" title={g.tags.join(", ") || undefined}>
        {g.name}
      </span>{" "}
      {!isOther && <KindTag kind={g.kind} />}
    </span>
  );
}

function SourcesList({ rows, currency }: { rows: SourceRow[]; currency: string }) {
  const [showOther, setShowOther] = useState(false);
  if (rows.length === 0) {
    return (
      <Panel>
        <p className="p-4 text-center text-sm text-muted-foreground">No visits in this time yet.</p>
      </Panel>
    );
  }
  const { main, other } = groupSources(rows);
  const otherRow =
    other.length > 0
      ? sumGroups(
          `Other (${other.length} small source${other.length === 1 ? "" : "s"}, no carts yet)`,
          other,
        )
      : null;
  const toggle = otherRow ? (
    <button
      type="button"
      onClick={() => setShowOther((v) => !v)}
      className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
    >
      {showOther ? "Hide" : "Show"}
    </button>
  ) : null;
  const visible: Array<{ g: SourceGroup; isOther?: boolean; sub?: boolean }> = [
    ...main.map((g) => ({ g })),
    ...(otherRow ? [{ g: otherRow, isOther: true }] : []),
    ...(showOther ? other.map((g) => ({ g, sub: true })) : []),
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {visible.map(({ g, isOther, sub }) => (
          <Panel key={`${g.name}|${g.kind}|${sub ? "s" : ""}`} className={sub ? "opacity-80" : ""}>
            <GroupName g={g} isOther={isOther} />
            {isOther && toggle}
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <Fig label="Visits" value={fmtNum(g.sessions)} />
              <Fig label="Added to cart" value={fmtNum(g.cart_sessions)} />
              <Fig label="Orders" value={fmtNum(g.orders)} />
              {g.orders > 0 && <Fig label="Sales" value={fmtMoney(g.revenue, currency)} />}
            </dl>
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
              <th className={THR}>Sales</th>
              <th className={THR}>New customers</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ g, isOther, sub }) => (
              <tr
                key={`${g.name}|${g.kind}|${sub ? "s" : ""}`}
                className={`${TR} ${sub ? "text-muted-foreground" : ""}`}
              >
                <td className={`${TD} ${sub ? "pl-8 sm:pl-10" : ""}`}>
                  <GroupName g={g} isOther={isOther} />
                  {isOther && toggle}
                </td>
                <td className={TDR}>{fmtNum(g.sessions)}</td>
                <td className={TDR}>{fmtNum(g.product_views)}</td>
                <td className={TDR}>{fmtNum(g.cart_sessions)}</td>
                <td className={TDR}>{fmtNum(g.checkout_sessions)}</td>
                <td className={TDR}>{fmtNum(g.orders)}</td>
                <td className={TDR}>{g.orders > 0 ? fmtMoney(g.revenue, currency) : "–"}</td>
                <td className={TDR}>{g.orders > 0 ? fmtNum(g.new_customers) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

/** Orders in Shopify admin (store drynksapp), for the order links on visitors. */
const SHOPIFY_ADMIN_ORDERS = "https://admin.shopify.com/store/drynksapp/orders";

/** Visitors (one per browser) and how many times each came, from the anonymous visitor ID. */
function VisitorsSection({ range }: { range: Range }) {
  const fn = useServerFn(getVisitors);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-visitors", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });
  const t = data?.totals;
  return (
    <Section
      title="Visitors who came back"
      intro="One visitor = one browser, however many times it comes. Shows whether people return before they buy, and how often."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data || !t ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Visitors"
              value={fmtNum(t.visitors)}
              sub={`one browser each, ${fmtNum(t.visits)} visits between them`}
            />
            <StatCard
              label="Came back"
              value={fmtNum(t.returning)}
              sub={`visited more than once (${fmtPct(t.returning, t.visitors)})`}
            />
            <StatCard
              label="Added to cart"
              value={fmtNum(t.carted)}
              sub={`visitors. ${fmtNum(t.returningCarted)} of them came back`}
            />
            <StatCard
              label="Went to checkout"
              value={fmtNum(t.checkedOut)}
              sub={`visitors. ${fmtNum(t.returningCheckedOut)} of them came back`}
            />
          </div>
          <Panel>
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              How many times visitors came
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
              {data.byVisits.map((b) => (
                <div key={b.label}>
                  <p className="font-display text-lg tabular-nums">{fmtNum(b.count)}</p>
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                </div>
              ))}
            </div>
          </Panel>
          <OrdersByVisits orders={data.orders} />
          <Panel className="overflow-x-auto p-0">
            {data.rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No visitors with an ID yet. Counting starts once this update is published.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={TH}>Visitor</th>
                    <th className={THR}>Visits</th>
                    <th className={`${TH} hidden sm:table-cell`}>First came from</th>
                    <th className={`${TH} hidden sm:table-cell`}>First visit</th>
                    <th className={`${TH} hidden sm:table-cell`}>Last visit</th>
                    <th className={`${THR} hidden sm:table-cell`}>Added to cart</th>
                    <th className={`${TH} hidden sm:table-cell`}>Went to checkout</th>
                    <th className={THR}>Ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.visitor_id} className={TR}>
                      <td className={`${TD} whitespace-nowrap`}>
                        <span className="font-mono text-xs" title={r.visitor_id}>
                          #{r.visitor_id.slice(0, 6)}
                        </span>
                        {r.orderList.length > 0 && (
                          <span className="block text-sm whitespace-normal">
                            <span className="font-medium">{r.customer ?? "Customer"}</span>{" "}
                            {r.orderList.map((o, i) => (
                              <span key={o.id}>
                                {i > 0 && ", "}
                                <a
                                  href={`${SHOPIFY_ADMIN_ORDERS}/${o.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-muted-foreground underline hover:text-foreground"
                                >
                                  {o.name}
                                </a>
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs whitespace-normal sm:hidden">
                          <SourceName source={r.utm_source} medium={r.utm_medium} />
                          <span className="block text-muted-foreground">
                            Last visit {fmtDate(r.last_seen, true)}
                            {r.adds ? ` · added to cart ${fmtNum(r.adds)}x` : ""}
                          </span>
                        </span>
                      </td>
                      <td className={`${TDR} font-medium`}>{fmtNum(r.visits)}</td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        <SourceName source={r.utm_source} medium={r.utm_medium} />
                      </td>
                      <td className={`${TD} hidden whitespace-nowrap sm:table-cell`}>
                        {fmtDate(r.first_seen, true)}
                      </td>
                      <td className={`${TD} hidden whitespace-nowrap sm:table-cell`}>
                        {fmtDate(r.last_seen, true)}
                      </td>
                      <td className={`${TDR} hidden sm:table-cell`}>
                        {r.adds ? `${fmtNum(r.adds)}x` : "–"}
                      </td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        {r.checked_out ? "Yes" : "–"}
                      </td>
                      <td className={TDR}>
                        {r.orders
                          ? `${r.orders > 1 ? `${fmtNum(r.orders)}, ` : ""}${fmtMoney(r.sales)}`
                          : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Note>
            Each visitor gets a random number the first time they open the site (no name or email),
            kept in their browser for 400 days. It is per browser: a phone and a laptop are two
            visitors, and so are the Fyxx app and Safari on the same phone; clearing cookies or a
            private window starts a new one. Counting started on 23 Nov 2026, so earlier visits
            aren&apos;t included. Orders are paid orders through this site&apos;s checkout
            (cancelled ones left out), matched to the visitor by the same ID on the cart. Visitors
            who ordered show the customer&apos;s first name and last initial, with a link to the
            order in Shopify. The table lists the 100 visitors with the most visits. Team visits and
            test tags are left out.
          </Note>
        </>
      )}
    </Section>
  );
}

type VisitorOrders = Awaited<ReturnType<typeof getVisitors>>["orders"];

/** Orders from visitors on their first visit vs visitors who came back first. */
function OrdersByVisits({ orders: o }: { orders: VisitorOrders }) {
  const cols = [
    {
      label: "Ordered on their first visit",
      orders: o.first.orders,
      sales: o.first.sales,
      sub: "",
    },
    {
      label: "Came back, then ordered",
      orders: o.returning.orders,
      sales: o.returning.sales,
      sub: o.returning.orders
        ? `${o.returning.avgVisits.toFixed(1)} visits on average before ordering`
        : "",
    },
    {
      label: "Not known",
      orders: o.unknown.orders,
      sales: o.unknown.sales,
      sub: "cart made before 23 Nov, or tracking was off",
    },
  ];
  return (
    <Panel>
      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Orders: first visit or came back
      </p>
      {o.shopify !== "ok" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Orders from Shopify can&apos;t be read right now.
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {cols.map((c) => (
            <div key={c.label}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-display text-lg tabular-nums">
                {fmtNum(c.orders)} order{c.orders === 1 ? "" : "s"} · {fmtMoney(c.sales)}
              </p>
              {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Status pill for an order: cancelled first, then Shopify's payment status. */
function OrderStatus({ cancelled, status }: { cancelled: boolean; status: string | null }) {
  const s = (status ?? "").toUpperCase();
  const [label, cls] = cancelled
    ? ["Cancelled", "bg-red-100 text-red-800"]
    : s === "PAID"
      ? ["Payment received", "bg-green-100 text-green-800"]
      : s === "REFUNDED"
        ? ["Refunded", "bg-red-100 text-red-800"]
        : s === "PARTIALLY_REFUNDED"
          ? ["Partly refunded", "bg-amber-100 text-amber-900"]
          : s === "PENDING" || s === "AUTHORIZED" || s === "PARTIALLY_PAID"
            ? ["Not paid yet", "bg-secondary text-muted-foreground"]
            : [
                s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "Unknown",
                "bg-secondary text-muted-foreground",
              ];
  return (
    <span
      className={`inline-block rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

/** Every order (this site's checkout and myfyxx.com after a visit), cancelled and refunded included. */
function OrdersSection({ range }: { range: Range }) {
  const fn = useServerFn(getOrdersList);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-orders-list", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });
  const rows = data?.rows ?? [];
  const cancelled = rows.filter((r) => r.cancelled).length;
  const refunded = rows.filter(
    (r) => !r.cancelled && /REFUNDED/i.test(r.financialStatus ?? ""),
  ).length;
  return (
    <Section
      title="All orders"
      intro="Every order from Friday visitors, newest first, with who ordered, where they came from and the order's status. Cancelled and refunded orders are listed too, so nothing is missed."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : data.status !== "ok" ? (
        <p className="text-sm text-muted-foreground">
          Orders from Shopify can&apos;t be read right now{data.message ? `: ${data.message}` : "."}
        </p>
      ) : (
        <>
          <p className="text-sm">
            {fmtNum(rows.length)} order{rows.length === 1 ? "" : "s"}
            {cancelled > 0 && <> · {fmtNum(cancelled)} cancelled</>}
            {refunded > 0 && <> · {fmtNum(refunded)} refunded</>}
          </p>
          <Panel className="overflow-x-auto p-0">
            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No orders in this time yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={TH}>Order</th>
                    <th className={`${TH} hidden sm:table-cell`}>Customer</th>
                    <th className={`${TH} hidden lg:table-cell`}>Where</th>
                    <th className={`${TH} hidden sm:table-cell`}>Came from</th>
                    <th className={`${THR} hidden lg:table-cell`}>Visits before</th>
                    <th className={THR}>Total</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`${TR} ${r.cancelled ? "text-muted-foreground" : ""}`}
                    >
                      <td className={TD}>
                        <a
                          href={`${SHOPIFY_ADMIN_ORDERS}/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline hover:no-underline"
                        >
                          {r.name}
                        </a>
                        <span className="block text-xs text-muted-foreground">
                          {fmtDate(r.createdAt, true)}
                        </span>
                        <span className="block text-xs sm:hidden">
                          {r.customer ?? "Customer"}
                          {r.isFirstOrder ? " · new customer" : ""}
                        </span>
                        <span className="block text-xs whitespace-normal sm:hidden">
                          <SourceName source={r.source} medium={r.medium} />
                        </span>
                        <span className="block text-xs text-muted-foreground lg:hidden">
                          {r.where === "site" ? "This site's checkout" : "Later on myfyxx.com"}
                          {r.visits
                            ? ` · ${fmtNum(r.visits)} visit${r.visits === 1 ? "" : "s"} before`
                            : ""}
                        </span>
                      </td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        {r.customer ?? "Customer"}
                        {r.isFirstOrder && (
                          <span className="block text-xs text-muted-foreground">new customer</span>
                        )}
                      </td>
                      <td className={`${TD} hidden lg:table-cell`}>
                        {r.where === "site" ? "This site's checkout" : "Later on myfyxx.com"}
                      </td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        <SourceName source={r.source} medium={r.medium} />
                      </td>
                      <td className={`${TDR} hidden lg:table-cell`}>
                        {r.visits ? fmtNum(r.visits) : "–"}
                      </td>
                      <td className={`${TDR} ${r.cancelled ? "line-through" : ""}`}>
                        {fmtMoney(r.total, r.currency)}
                      </td>
                      <td className={TD}>
                        <OrderStatus cancelled={r.cancelled} status={r.financialStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Note>
            &quot;This site&apos;s checkout&quot;: ordered through the Fyxx Friday cart. &quot;Later
            on myfyxx.com&quot;: ordered on the website within 30 days of a visit. The order number
            opens the order in Shopify. Visits before: how many times that browser came to the site
            before ordering (counted from 23 Nov). Cancelled orders are crossed out here and left
            out of the totals above; refunded orders are still counted in the totals above, as
            before.
          </Note>
        </>
      )}
    </Section>
  );
}
