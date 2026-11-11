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
  { key: "Product views", color: "#64748b" },
  { key: "Carts", color: "#f59e0b" },
  { key: "Checkouts", color: "#3b82f6" },
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
    "Product views": d.product_views,
    Carts: d.carts,
    Checkouts: d.checkouts,
    Orders: d.orders,
  }));

  return (
    <>
      <PageHeader title="Activity over time">
        Daily visits, product views, carts, checkouts and orders on this site, by Amman day.
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
            <StatCard label="Visits" value={sum("visits").toLocaleString()} />
            <StatCard label="Orders" value={sum("orders").toLocaleString()} />
            <StatCard
              label="Busiest day (visits)"
              value={peakVisits ? peakVisits.visits.toLocaleString() : "–"}
              sub={peakVisits ? dayLabel(peakVisits.day) : "No visits yet"}
            />
            <StatCard
              label="Busiest day (orders)"
              value={peakOrders ? peakOrders.orders.toLocaleString() : "–"}
              sub={
                peakOrders
                  ? `${dayLabel(peakOrders.day)} · ${fmtMoney(peakOrders.revenue, data.currency)}`
                  : "No orders yet"
              }
            />
          </div>

          <Panel>
            <ResponsiveContainer width="100%" height={360}>
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

          <Panel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-medium">Day</th>
                  <th className="px-4 py-3 text-right font-medium">Visits</th>
                  <th className="px-4 py-3 text-right font-medium">Product views</th>
                  <th className="px-4 py-3 text-right font-medium">Carts</th>
                  <th className="px-4 py-3 text-right font-medium">Checkouts</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...days].reverse().map((d) => (
                  <tr key={d.day} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">{dayLabel(d.day)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.visits}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.product_views}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.carts}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.checkouts}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{d.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(d.revenue, data.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </>
  );
}
