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
import { getSources, type SourceRow } from "@/lib/admin.functions";

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
            style tags to every link you share so it shows up here.
          </p>
        </>
      )}
    </>
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
            <td className="px-4 py-2.5 font-medium">{label(r.utm_source)}</td>
            <td className="px-4 py-2.5">{label(r.utm_medium)}</td>
            <td className="px-4 py-2.5">{label(r.utm_campaign)}</td>
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
