import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  ErrorBox,
  fmtDate,
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
import {
  getCarts,
  getOfferSwitches,
  setOfferSwitch,
  type OfferKey,
  getLeaving,
  getSalesForecast,
  getSources,
  getTopAdded,
  type Bucket,
  type DaySales,
  type SourceRow,
} from "@/lib/admin.functions";
import { formatJod } from "@/lib/shopify";
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

      <OffersSection />

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

      <SalesForecastSection />

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
        <div className="grid gap-3 lg:grid-cols-2">
          {data.mode === "before" && data.carts ? (
            <Panel className="space-y-2">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Digital, estimate from carts
              </p>
              <p className="font-display text-2xl tabular-nums">{formatJod(data.carts.value)}</p>
              <p className="text-xs text-muted-foreground">
                In {data.carts.carts} carts right now, at Friday prices.
              </p>
              <ul className="space-y-1 pt-1 text-sm">
                {data.carts.rates.map((r) => (
                  <li key={r} className="flex justify-between gap-3">
                    <span>If {Math.round(r * 100)}% of carts buy</span>
                    <span className="tabular-nums">{formatJod((data.carts?.value ?? 0) * r)}</span>
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-xs text-muted-foreground">
                Items taken out of a cart are still counted, so this runs a little high.
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
        </div>
      )}
    </Section>
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
  const digital = (d: DaySales) => ({
    orders: d.channels.website.orders + d.channels.app.orders,
    total: d.channels.website.total + d.channels.app.total,
  });
  const staff = (d: DaySales) => ({
    orders: d.channels.staff.orders + d.channels.other.orders,
    total: d.channels.staff.total + d.channels.other.total,
  });
  const rows: Array<{
    label: string;
    sub?: boolean;
    strong?: boolean;
    pick: (d: DaySales) => Bucket;
  }> = [
    { label: "Total", strong: true, pick: (d) => ({ orders: d.orders, total: d.total }) },
    { label: "Digital (website + app)", strong: true, pick: digital },
    { label: "Website", sub: true, pick: (d) => d.channels.website },
    { label: "Mobile app", sub: true, pick: (d) => d.channels.app },
    { label: "In store (Point of Sale)", strong: true, pick: (d) => d.channels.inStore },
    { label: "Staff orders (phone and draft)", strong: true, pick: staff },
  ];
  const cell = (b: Bucket | null) =>
    b ? (
      <>
        {formatJod(b.total)}
        <span className="block text-xs text-muted-foreground">{b.orders} orders</span>
        {b.orders > 0 && (
          <span className="block text-xs text-muted-foreground">
            Average order {formatJod(b.total / b.orders)}
          </span>
        )}
      </>
    ) : (
      <span className="text-muted-foreground">–</span>
    );
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={TH}>By channel</th>
            <th className={THR}>Fyxx Friday 2025</th>
            <th className={THR}>Fyxx Friday 2026</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={TR}>
              <td className={TD}>
                <span
                  className={
                    r.sub ? "block pl-4 text-muted-foreground" : r.strong ? "font-medium" : ""
                  }
                >
                  {r.label}
                </span>
              </td>
              <td className={TDR}>{cell(r.pick(lastYear))}</td>
              <td className={TDR}>{cell(thisYear ? r.pick(thisYear) : null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground sm:px-4">
        Whole day, 00:00 to midnight Amman time: 28 Nov 2025 and Fri 27 Nov 2026
        {before ? " (fills in from Friday)" : " (so far)"}. Shopify orders, cancelled ones left out.
        Average order = sales divided by orders. In-store sales from Odoo come later.
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
          key: "mystery_gift_enabled",
          title: "Green Room mystery gift",
          description:
            "The progress bar in the cart and the floating cart bar, and the Congratulations message every 50 JOD. Display only: no gift is added to orders.",
          on: data.mystery_gift_enabled,
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

/** "Carts": every shopper's cart, biggest first, with what's in it. */
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
  return (
    <Section
      title="Carts"
      intro="Every shopper's cart right now, biggest first: what's in it and what it's worth. One row per browser; the team's own visits and tests are left out."
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
            <StatCard label="Total, full price" value={formatJod(total)} />
            <StatCard label="Total, Friday prices" value={formatJod(totalFriday)} />
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
