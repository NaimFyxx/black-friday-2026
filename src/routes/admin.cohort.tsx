import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  ErrorBox,
  fmtDate,
  fmtMoney,
  fmtPct,
  fmtRange,
  Loading,
  PageHeader,
  Panel,
  RangePicker,
  rangeFor,
  SetupNotice,
  StatCard,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { getCohort } from "@/lib/admin.functions";

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
      <PageHeader title="Customers">
        Every Fyxx order in the period across all channels (website, app, POS, draft orders), from
        the Shopify data already synced into Supabase. Compared with the same number of days right
        before it.
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
            <SetupNotice title="New vs returning may be off">
              The <code>bf_first_order_dates</code> database function isn't set up yet, so
              new-vs-returning falls back to the <code>shopify_customers</code> table, which stopped
              updating in late August 2026. Customers it doesn't know are shown as “unknown”. Paste
              the prompt from <code>docs/LOVABLE-SETUP.md</code> into Lovable to fix this.
            </SetupNotice>
          )}
          {(() => {
            const c = data.current;
            const p = data.previous;
            return (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <StatCard
                    label="Orders"
                    value={c.orders.toLocaleString()}
                    sub={change(c.orders, p.orders)}
                  />
                  <StatCard
                    label="Revenue"
                    value={fmtMoney(c.revenue)}
                    sub={change(c.revenue, p.revenue)}
                  />
                  <StatCard label="Avg. order" value={fmtMoney(c.aov)} sub={change(c.aov, p.aov)} />
                  <StatCard
                    label="Customers"
                    value={c.customers.toLocaleString()}
                    sub={change(c.customers, p.customers)}
                  />
                  <StatCard
                    label="New customers"
                    value={c.newCustomers.toLocaleString()}
                    sub={`${fmtPct(c.newCustomers, c.customers)} · ${change(c.newCustomers, p.newCustomers)}`}
                  />
                  <StatCard
                    label="Returning"
                    value={c.returningCustomers.toLocaleString()}
                    sub={`${fmtPct(c.returningCustomers, c.customers)} · ${change(c.returningCustomers, p.returningCustomers)}`}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Panel>
                    <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                      Revenue: new vs returning
                    </p>
                    <SplitBar
                      a={{ label: "New", value: c.newRevenue }}
                      b={{ label: "Returning", value: c.returningRevenue }}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      “New” = first order ever placed in this period.{" "}
                      {c.guestOrders.toLocaleString()} order(s) had no customer attached (guest /
                      walk-in / house account) and aren't counted as either.
                      {c.unknownCustomers > 0 &&
                        ` ${c.unknownCustomers.toLocaleString()} customer(s) unknown.`}
                    </p>
                  </Panel>
                  <Panel>
                    <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                      Before this period
                    </p>
                    <p className="mt-1 text-sm">
                      {fmtRange(data.previousRange)}: {p.orders.toLocaleString()} orders ·{" "}
                      {fmtMoney(p.revenue)} · {p.customers.toLocaleString()} customers (
                      {p.newCustomers.toLocaleString()} new)
                    </p>
                    {data.syncedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Order data last synced {fmtDate(data.syncedAt, true)}.
                      </p>
                    )}
                  </Panel>
                </div>

                <Panel className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                        <th className="px-4 py-3 font-medium">Channel</th>
                        <th className="px-4 py-3 text-right font-medium">Orders</th>
                        <th className="px-4 py-3 text-right font-medium">Revenue</th>
                        <th className="px-4 py-3 text-right font-medium">Share</th>
                        <th className="px-4 py-3 text-right font-medium">Customers</th>
                        <th className="px-4 py-3 text-right font-medium">Before</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.channels.map((ch) => {
                        const before = p.channels.find((x) => x.channel === ch.channel);
                        return (
                          <tr key={ch.channel} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-2.5 font-medium">{ch.channel}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {ch.orders.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {fmtMoney(ch.revenue)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {fmtPct(ch.revenue, c.revenue)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {ch.customers.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
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
