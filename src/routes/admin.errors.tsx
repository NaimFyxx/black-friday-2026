import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  ErrorBox,
  fmtDate,
  fmtNum,
  Loading,
  PageHeader,
  Panel,
  Section,
  SetupNotice,
  StatCard,
  TD,
  TH,
  TR,
} from "@/components/admin/AdminUi";
import { getErrorLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/errors")({
  component: ErrorsPage,
});

function ErrorsPage() {
  const fn = useServerFn(getErrorLog);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-errors"],
    queryFn: () => fn(),
    staleTime: 10_000,
    retry: 1,
  });

  return (
    <>
      <PageHeader title="Errors">
        Problems real visitors ran into on the site: a page that broke, a script that failed or a
        request that didn&apos;t go through. A sudden jump means something needs fixing. (They also
        go to Google Analytics as <code>js_error</code>.)
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : data.setup === "missing" ? (
        <SetupNotice title="Errors aren't being saved yet">
          The table that stores them (<code>bf_error_log</code>) doesn&apos;t exist in the database
          yet. Paste the prompt from <code>docs/LOVABLE-SETUP.md</code> into Lovable.
        </SetupNotice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Last 24 hours" value={fmtNum(data.total24h)} sub="errors" />
            <StatCard label="Last 7 days" value={fmtNum(data.total7d)} sub="errors" />
          </div>

          {data.summary.length > 0 && (
            <Panel>
              <p className="mb-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                By type: last 24 hours / last 7 days
              </p>
              <div className="flex flex-wrap gap-2">
                {data.summary.map((a) => (
                  <span
                    key={a.area}
                    className="rounded-full border border-border px-3 py-1 text-xs tabular-nums"
                  >
                    {a.area}: {a.count_24h} / {a.count_7d}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          <Section
            title="Latest errors"
            intro="Newest first. Hold the pointer on a message to see the phone or browser it came from."
            actions={
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
            }
          >
            <Panel className="overflow-x-auto p-0">
              {data.rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No errors. 🎉</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className={TH}>When</th>
                      <th className={`${TH} hidden sm:table-cell`}>Type</th>
                      <th className={TH}>What happened</th>
                      <th className={`${TH} hidden sm:table-cell`}>Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className={TR}>
                        <td className={`${TD} whitespace-nowrap`}>{fmtDate(r.created_at, true)}</td>
                        <td className={`${TD} hidden whitespace-nowrap sm:table-cell`}>{r.area}</td>
                        <td
                          className={`${TD} max-w-md break-words`}
                          title={r.user_agent ?? undefined}
                        >
                          {r.message}
                          <span className="block text-xs text-muted-foreground sm:hidden">
                            {r.area} · {r.path ?? "–"}
                          </span>
                        </td>
                        <td className={`${TD} hidden text-muted-foreground sm:table-cell`}>
                          {r.path ?? "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </Section>
        </>
      )}
    </>
  );
}
