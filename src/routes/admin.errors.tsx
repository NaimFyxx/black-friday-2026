import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  ErrorBox,
  fmtDate,
  Loading,
  PageHeader,
  Panel,
  SetupNotice,
  StatCard,
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
      <PageHeader title="Error log">
        Errors real visitors hit on the site: page crashes, script errors and failed requests.
        Errors are also sent to Google Analytics as <code>js_error</code> events.
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : data.setup === "missing" ? (
        <SetupNotice title="Error logging isn't switched on yet">
          The <code>bf_error_log</code> table hasn't been created in Supabase. Paste the prompt from{" "}
          <code>docs/LOVABLE-SETUP.md</code> into Lovable.
        </SetupNotice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Last 24 hours" value={data.total24h.toLocaleString()} />
            <StatCard label="Last 7 days" value={data.total7d.toLocaleString()} />
          </div>

          {data.summary.length > 0 && (
            <Panel>
              <p className="mb-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                By type (24h / 7d)
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <Panel className="overflow-x-auto p-0">
            {data.rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No errors logged. 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.created_at, true)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.area}</td>
                      <td
                        className="max-w-md px-4 py-2 break-words"
                        title={r.user_agent ?? undefined}
                      >
                        {r.message}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.path ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
