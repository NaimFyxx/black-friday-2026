import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ErrorBox,
  fmtMoney,
  fmtNum,
  fmtRange,
  Loading,
  PageHeader,
  Panel,
  RangePicker,
  rangeFor,
  Section,
  SourceSetupNotices,
  StatCard,
  TD,
  TDR,
  TH,
  THR,
  TR,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { getActivity, type ActivityDay } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/activity")({
  component: ActivityPage,
});

function dayLabel(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function busiest(days: ActivityDay[], key: keyof Omit<ActivityDay, "day">) {
  let top: ActivityDay | null = null;
  for (const d of days) if (d[key] > 0 && (!top || d[key] > top[key])) top = d;
  return top;
}

const SERIES = [
  { key: "Visits", color: "var(--primary)" },
  { key: "Viewed a product", color: "#64748b" },
  { key: "Added to cart", color: "#f59e0b" },
  { key: "Went to checkout", color: "#3b82f6" },
  { key: "Orders", color: "#22c55e" },
] as const;

function ActivityPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const range = rangeFor(rangeKey);
  const fn = useServerFn(getActivity);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-activity", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    retry: 1,
  });

  const days = data?.days ?? [];
  const sum = (k: keyof Omit<ActivityDay, "day">) => days.reduce((a, d) => a + d[k], 0);
  const peakVisits = busiest(days, "visits");
  const peakOrders = busiest(days, "orders");
  const chartData = days.map((d) => ({
    label: dayLabel(d.day),
    Visits: d.visits,
    "Viewed a product": d.product_views,
    "Added to cart": d.carts,
    "Went to checkout": d.checkouts,
    Orders: d.orders,
  }));

  return (
    <>
      <PageHeader title="Day by day">
        Visits, carts and orders on this site for each day (Amman time). Use it to see which days,
        emails and posts brought people in.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <RangePicker value={rangeKey} onChange={setRangeKey} />
        <span className="text-xs text-muted-foreground">{fmtRange(range)}</span>
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <>
          <SourceSetupNotices {...data.setup} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Visits" value={fmtNum(sum("visits"))} sub="in this time" />
            <StatCard
              label="Orders"
              value={fmtNum(sum("orders"))}
              sub="through this site's checkout"
            />
            <StatCard
              label="Most visits in a day"
              value={peakVisits ? fmtNum(peakVisits.visits) : "–"}
              sub={peakVisits ? dayLabel(peakVisits.day) : "No visits yet"}
            />
            <StatCard
              label="Most orders in a day"
              value={peakOrders ? fmtNum(peakOrders.orders) : "–"}
              sub={
                peakOrders
                  ? `${dayLabel(peakOrders.day)} · ${fmtMoney(peakOrders.revenue, data.currency)}`
                  : "No orders yet"
              }
            />
          </div>

          <Section
            title="Each day on a chart"
            intro="One line per step, from visiting to ordering. A jump shows a day something worked."
          >
            <Panel>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </Section>

          <Section
            title="Each day in numbers"
            intro="The same numbers as the chart, newest day first. A visit is one browser tab session; orders are paid orders through this site's checkout."
          >
            <Panel className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={TH}>Day</th>
                    <th className={THR}>Visits</th>
                    <th className={`${THR} hidden sm:table-cell`}>Viewed a product</th>
                    <th className={THR}>Added to cart</th>
                    <th className={`${THR} hidden sm:table-cell`}>Went to checkout</th>
                    <th className={THR}>Orders</th>
                    <th className={THR}>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days].reverse().map((d) => (
                    <tr key={d.day} className={TR}>
                      <td className={`${TD} whitespace-nowrap`}>{dayLabel(d.day)}</td>
                      <td className={TDR}>{fmtNum(d.visits)}</td>
                      <td className={`${TDR} hidden sm:table-cell`}>{fmtNum(d.product_views)}</td>
                      <td className={TDR}>{fmtNum(d.carts)}</td>
                      <td className={`${TDR} hidden sm:table-cell`}>{fmtNum(d.checkouts)}</td>
                      <td className={TDR}>{fmtNum(d.orders)}</td>
                      <td className={TDR}>{fmtMoney(d.revenue, data.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </Section>
        </>
      )}
    </>
  );
}
