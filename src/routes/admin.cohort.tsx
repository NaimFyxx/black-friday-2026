import { useQuery } from "@tanstack/react-query";
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
  Loading,
  PageHeader,
  Panel,
  RangePicker,
  rangeFor,
  Note,
  Section,
  SetupNotice,
  StatCard,
  TD,
  TDR,
  TH,
  THR,
  TR,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { getCohort } from "@/lib/admin.functions";
import { describeChannel } from "@/lib/source-labels";

export const Route = createFileRoute("/admin/cohort")({
  component: CohortPage,
});

function change(now: number, before: number): string {
  if (!before) return now ? "new" : "–";
  const pct = ((now - before) / before) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs before`;
}

function CohortPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const range = rangeFor(rangeKey);
  const fn = useServerFn(getCohort);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-cohort", range],
    queryFn: () => fn({ data: range }),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <>
      <PageHeader title="All Fyxx sales">
        Every Fyxx order in this time, from every channel: the app, the website, draft orders and
        the shops. Compared with the same number of days just before, so you can see whether the
        campaign lifted sales overall, not only on this site.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <RangePicker value={rangeKey} onChange={setRangeKey} />
        <span className="text-xs text-muted-foreground">{fmtRange(range)}</span>
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : data.status === "error" ? (
        <ErrorBox error={data.message} />
      ) : (
        <>
          {data.firstOrderSource === "customers_table" && (
            <SetupNotice title="New or returning may be off">
              The database can't yet tell for sure who ordered before (the{" "}
              <code>bf_first_order_dates</code> function is missing), so it uses an older customer
              list that stopped updating in late August 2026. Customers it doesn't know show as
              &quot;unknown&quot;. Paste the prompt from <code>docs/LOVABLE-SETUP.md</code> into
              Lovable to fix this.
            </SetupNotice>
          )}
          {(() => {
            const c = data.current;
            const p = data.previous;
            return (
              <>
                <Section
                  title="The main numbers"
                  intro="Orders and sales from every channel, with the change against the days just before."
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <StatCard
                      label="Sales"
                      value={fmtMoney(c.revenue)}
                      sub={change(c.revenue, p.revenue)}
                    />
                    <StatCard
                      label="Orders"
                      value={fmtNum(c.orders)}
                      sub={change(c.orders, p.orders)}
                    />
                    <StatCard
                      label="Average order"
                      value={fmtMoney(c.aov)}
                      sub={change(c.aov, p.aov)}
                    />
                    <StatCard
                      label="Customers"
                      value={fmtNum(c.customers)}
                      sub={change(c.customers, p.customers)}
                    />
                    <StatCard
                      label="New customers"
                      value={fmtNum(c.newCustomers)}
                      sub={`first order ever, ${fmtPct(c.newCustomers, c.customers)} of customers. ${change(c.newCustomers, p.newCustomers)}`}
                    />
                    <StatCard
                      label="Returning customers"
                      value={fmtNum(c.returningCustomers)}
                      sub={`ordered before, ${fmtPct(c.returningCustomers, c.customers)}. ${change(c.returningCustomers, p.returningCustomers)}`}
                    />
                  </div>
                </Section>

                <Section
                  title="New or returning customers"
                  intro="How much of the sales came from people ordering for the first time ever. New customers are the ones the campaign wins."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <Panel>
                      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                        Sales: new or returning
                      </p>
                      <SplitBar
                        a={{ label: "New", value: c.newRevenue }}
                        b={{ label: "Returning", value: c.returningRevenue }}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        &quot;New&quot; means their first order ever was in this time.{" "}
                        {fmtNum(c.guestOrders)} order(s) had no customer attached (guest, walk-in or
                        house account) and count as neither.
                        {c.unknownCustomers > 0 &&
                          ` ${fmtNum(c.unknownCustomers)} customer(s) unknown.`}
                      </p>
                    </Panel>
                    <Panel>
                      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                        The days before, for comparison
                      </p>
                      <p className="mt-1 text-sm">
                        {fmtRange(data.previousRange)}: {fmtNum(p.orders)} orders ·{" "}
                        {fmtMoney(p.revenue)} in sales · {fmtNum(p.customers)} customers (
                        {fmtNum(p.newCustomers)} new)
                      </p>
                      {data.syncedAt && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Orders last copied from Shopify {fmtDate(data.syncedAt, true)}.
                        </p>
                      )}
                      {[c.pos, p.pos].some((x) => x && x.days < x.expectedDays) && (
                        <p className="mt-2 text-xs text-amber-700">
                          Shop (POS) sales are missing for some days (this time: {c.pos?.days ?? 0}{" "}
                          of {c.pos?.expectedDays ?? 0} days, before: {p.pos?.days ?? 0} of{" "}
                          {p.pos?.expectedDays ?? 0}). They are copied from Odoo every night since
                          19 Oct 2026, so today's shop sales show tomorrow.
                        </p>
                      )}
                    </Panel>
                  </div>
                </Section>

                <Section
                  title="Sales by channel"
                  intro="Where the orders were placed, with each channel's share of all sales and its sales in the days before."
                >
                  <Panel className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className={TH}>Channel</th>
                          <th className={THR}>Orders</th>
                          <th className={THR}>Sales</th>
                          <th className={THR}>Share</th>
                          <th className={`${THR} hidden sm:table-cell`}>Customers</th>
                          <th className={THR}>Sales before</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.channels.map((ch) => {
                          const before = p.channels.find((x) => x.channel === ch.channel);
                          return (
                            <tr key={ch.channel} className={TR}>
                              <td className={`${TD} font-medium`}>{describeChannel(ch.channel)}</td>
                              <td className={TDR}>{fmtNum(ch.orders)}</td>
                              <td className={TDR}>{fmtMoney(ch.revenue)}</td>
                              <td className={TDR}>{fmtPct(ch.revenue, c.revenue)}</td>
                              <td className={`${TDR} hidden sm:table-cell`}>
                                {ch.channel === "POS (Odoo)" ? "–" : fmtNum(ch.customers)}
                              </td>
                              <td className={`${TDR} text-muted-foreground`}>
                                {before ? fmtMoney(before.revenue) : "–"}
                              </td>
                            </tr>
                          );
                        })}
                        {c.channels.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                              No orders in this period yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Panel>
                  <Note>
                    Shop sales come from Odoo. Shopify also keeps partial copies of some shop sales
                    (&quot;Odoo Connector&quot;); those are left out so nothing is counted twice.
                    New or returning only covers Shopify customers, not shop customers.
                  </Note>
                </Section>
              </>
            );
          })()}
        </>
      )}
    </>
  );
}

function SplitBar({
  a,
  b,
}: {
  a: { label: string; value: number };
  b: { label: string; value: number };
}) {
  const total = a.value + b.value;
  const pa = total ? (a.value / total) * 100 : 0;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
        <div className="bg-primary" style={{ width: `${pa}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span>
          {a.label}: {fmtMoney(a.value)} ({fmtPct(a.value, total)})
        </span>
        <span className="text-muted-foreground">
          {b.label}: {fmtMoney(b.value)} ({fmtPct(b.value, total)})
        </span>
      </div>
    </div>
  );
}
