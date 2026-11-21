import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";

import {
  ErrorBox,
  fmtDate,
  Loading,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getSpinsAdmin, saveSpinSettings } from "@/lib/spin-admin.functions";

export const Route = createFileRoute("/admin/spins")({
  component: SpinsPage,
});

const COPY_FIELDS: Array<{ key: string; label: string; hint?: string }> = [
  { key: "sticker", label: "Sticker text" },
  { key: "title", label: "Popup title" },
  { key: "subtitle", label: "Line under the title" },
  { key: "email_label", label: "Email field label" },
  { key: "button", label: "Spin button" },
  { key: "win", label: "Win message", hint: "{points} becomes the number won" },
  { key: "win_note", label: "Line under the win message" },
  {
    key: "already",
    label: "Message when they already spun",
    hint: "{points} becomes the number won",
  },
  { key: "privacy", label: "Small print under the button" },
];

type Odds = Array<{ points: number; weight: number }>;

function SpinsPage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getSpinsAdmin);
  const saveFn = useServerFn(saveSpinSettings);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-spins"],
    queryFn: () => getFn(),
  });
  const [enabled, setEnabled] = useState(true);
  const [odds, setOdds] = useState<Odds>([]);
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!data || ready) return;
    setEnabled(data.settings["spin_enabled"] !== false);
    setOdds((data.settings["spin_odds"] as Odds | undefined) ?? []);
    setCopy((data.settings["spin_copy"] as Record<string, string> | undefined) ?? {});
    setReady(true);
  }, [data, ready]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { spin_enabled: enabled, spin_odds: odds, spin_copy: copy } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-spins"] }),
  });

  const spins = data?.spins ?? [];
  const totalPoints = spins.reduce((s, r) => s + r.points, 0);
  const totalWeight = odds.reduce((s, o) => s + (Number(o.weight) || 0), 0);

  const downloadCsv = () => {
    const lines = ["email,points,spun_at"].concat(
      spins.map((s) => `${JSON.stringify(s.email)},${s.points},${s.created_at}`),
    );
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fyxx-friday-spins-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Spin & win">
        The Fyxx points slot machine on the landing page. One spin per email and per browser. Points
        are not added automatically: download the list and add them in LoyaltyLion.
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data || !ready ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Spins" value={String(spins.length)} />
            <StatCard label="Points to add" value={String(totalPoints)} />
            <StatCard
              label="Average"
              value={spins.length ? (totalPoints / spins.length).toFixed(1) : "0"}
            />
          </div>

          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">Winners</p>
              <Button variant="outline" onClick={downloadCsv} disabled={spins.length === 0}>
                Download CSV for LoyaltyLion
              </Button>
            </div>
            {spins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spins yet.</p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-4">Email</th>
                      <th className="py-1 pr-4 text-right">Points</th>
                      <th className="py-1 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spins.map((s) => (
                      <tr key={s.email} className="border-t border-border">
                        <td className="py-1 pr-4">{s.email}</td>
                        <td className="py-1 pr-4 text-right tabular-nums">{s.points}</td>
                        <td className="py-1 text-right">{fmtDate(s.created_at, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Show the game</p>
                <p className="text-sm text-muted-foreground">
                  Sticker and popup on the landing page, until the sale ends.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </Panel>

          <Panel className="space-y-3">
            <p className="font-medium">Prizes and chances</p>
            <div className="grid gap-3 sm:grid-cols-5">
              {odds.map((o, i) => (
                <label key={i} className="block space-y-1 text-sm">
                  <span className="font-medium">{o.points} points</span>
                  <Input
                    type="number"
                    min={0}
                    value={o.weight}
                    onChange={(e) =>
                      setOdds((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, weight: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <span className="block text-xs text-muted-foreground">
                    {totalWeight > 0
                      ? Math.round((100 * (Number(o.weight) || 0)) / totalWeight)
                      : 0}
                    % chance
                  </span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel className="grid gap-4 sm:grid-cols-2">
            {COPY_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <Input
                  value={copy[f.key] ?? ""}
                  onChange={(e) => setCopy((c) => ({ ...c, [f.key]: e.target.value }))}
                />
              </Field>
            ))}
          </Panel>

          <div className="flex items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
            {save.isSuccess && <span className="text-sm text-muted-foreground">Saved.</span>}
          </div>
          {save.error && <ErrorBox error={save.error} />}
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
