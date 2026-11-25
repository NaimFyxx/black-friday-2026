import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

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
  TD,
  TDR,
  TH,
  THR,
  TR,
  type RangeKey,
} from "@/components/admin/AdminUi";
import { getLinks, type LinkRow } from "@/lib/admin.functions";
import { describeCampaign, describeSource, type SourceKind } from "@/lib/source-labels";

export const Route = createFileRoute("/admin/links")({
  component: LinksPage,
});

/** "warmup-cold-bottles" -> "Warmup cold bottles" (display only). */
function readable(v: string | null): string {
  if (!v) return "No ad or email name on the link";
  const s = v.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Group = {
  name: string;
  kind: SourceKind;
  rows: LinkRow[];
  sessions: number;
  cart_sessions: number;
  orders: number;
  revenue: number;
};

function groupRows(rows: LinkRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const l = describeSource(r.utm_source, r.utm_medium);
    const k = `${l.name}|${l.kind}`;
    let g = groups.get(k);
    if (!g) {
      g = {
        name: l.name,
        kind: l.kind,
        rows: [],
        sessions: 0,
        cart_sessions: 0,
        orders: 0,
        revenue: 0,
      };
      groups.set(k, g);
    }
    g.rows.push(r);
    g.sessions += r.sessions;
    g.cart_sessions += r.cart_sessions;
    g.orders += r.orders;
    g.revenue += r.revenue;
  }
  const list = [...groups.values()];
  for (const g of list) g.rows.sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);
  return list.sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);
}

function LinksPage() {
  const fn = useServerFn(getLinks);
  const [rangeKey, setRangeKey] = useState<RangeKey>("campaign");
  const range = rangeFor(rangeKey);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-links", range],
    queryFn: () => fn({ data: range }),
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
    retry: 1,
  });
  const cur = data?.currency ?? "JOD";
  const groups = data ? groupRows(data.rows) : [];

  return (
    <>
      <PageHeader title="Links & ads">
        Every tracked link on its own row: each ad, email, story and app banner, with how far its
        visitors got and what they ordered. Use it to compare ads (bottles vs burgundy, cold vs
        warm) and emails (version a vs b).
      </PageHeader>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <RangePicker value={rangeKey} onChange={setRangeKey} />
        <span className="text-xs text-muted-foreground">{fmtRange(range)} (Amman time)</span>
      </div>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <div className="mt-6 space-y-8">
          {data.setup.orders !== "ok" && (
            <Note>
              Orders couldn&apos;t be read from Shopify just now, so orders and sales show 0.
            </Note>
          )}
          {groups.length === 0 ? (
            <Panel>
              <p className="p-4 text-center text-sm text-muted-foreground">
                No visits from tagged links in this time yet.
              </p>
            </Panel>
          ) : (
            groups.map((g) => <GroupTable key={`${g.name}|${g.kind}`} g={g} currency={cur} />)
          )}

          <Note>
            A visit is one browser tab session; orders and sales are paid orders placed through this
            site&apos;s checkout (cancelled left out), credited to the link the visitor first came
            from. The grey line under each name is the exact tracking tags on the link (source /
            medium / campaign / content). Visits without a tag (typed in, bookmarks, other sites):{" "}
            {fmtNum(data.untagged.sessions)} visits, {fmtNum(data.untagged.orders)} orders,{" "}
            {fmtMoney(data.untagged.revenue, cur)}; see Overview for those. Team visits and test
            links are left out.
          </Note>
        </div>
      )}
    </>
  );
}

function GroupTable({ g, currency }: { g: Group; currency: string }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">
          {g.name} <KindTag kind={g.kind} />
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {fmtNum(g.sessions)} visits · {fmtNum(g.cart_sessions)} added to cart · {fmtNum(g.orders)}{" "}
          orders · {fmtMoney(g.revenue, currency)}
        </p>
      </div>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className={TH}>Link</th>
              <th className={THR}>Visits</th>
              <th className={`${THR} hidden sm:table-cell`}>Viewed a product</th>
              <th className={THR}>Added to cart</th>
              <th className={`${THR} hidden sm:table-cell`}>Went to checkout</th>
              <th className={THR}>Orders</th>
              <th className={THR}>Sales</th>
              <th className={`${THR} hidden sm:table-cell`}>Visits that ordered</th>
            </tr>
          </thead>
          <tbody>
            {g.rows.map((r) => {
              const tags = [r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content]
                .map((v) => v ?? "–")
                .join(" / ");
              const camp = describeCampaign(r.utm_campaign);
              return (
                <tr key={tags} className={TR}>
                  <td className={`${TD} min-w-[11rem]`}>
                    <span className="font-medium">{readable(r.utm_content)}</span>
                    {camp && <span className="ml-1.5 text-xs text-muted-foreground">{camp}</span>}
                    <span className="block text-[11px] leading-snug break-all text-muted-foreground">
                      {tags}
                    </span>
                  </td>
                  <td className={TDR}>{fmtNum(r.sessions)}</td>
                  <td className={`${TDR} hidden sm:table-cell`}>{fmtNum(r.product_views)}</td>
                  <td className={TDR}>{fmtNum(r.cart_sessions)}</td>
                  <td className={`${TDR} hidden sm:table-cell`}>{fmtNum(r.checkout_sessions)}</td>
                  <td className={TDR}>{fmtNum(r.orders)}</td>
                  <td className={TDR}>{r.orders > 0 ? fmtMoney(r.revenue, currency) : "–"}</td>
                  <td className={`${TDR} hidden sm:table-cell`}>{fmtPct(r.orders, r.sessions)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </section>
  );
}
