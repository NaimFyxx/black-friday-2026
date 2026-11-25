import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  getFreeBottlesSettings,
  setFreeBottlesSettings,
  type FreeBottlesSettings,
} from "@/lib/admin.functions";
import { ErrorBox, Loading, Panel, Section, Toggle } from "./AdminUi";

const input =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ff-red";

/**
 * /admin "Free bottles bar": off / preview only (?preview=rewards) / on, the
 * amounts, every piece of text and what each reward is. DISPLAY ONLY: the bar
 * never adds products or discounts; the free bottles are given in Shopify.
 */
export function FreeBottlesAdmin() {
  const getFn = useServerFn(getFreeBottlesSettings);
  const saveFn = useServerFn(setFreeBottlesSettings);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-free-bottles"],
    queryFn: () => getFn(),
    staleTime: 30_000,
    retry: 1,
  });
  const [s, setS] = useState<FreeBottlesSettings | null>(null);
  useEffect(() => {
    if (data) setS(data);
  }, [data]);
  const [saving, setSaving] = useState(false);

  const save = async (next: FreeBottlesSettings) => {
    setSaving(true);
    try {
      await saveFn({ data: next });
      await qc.invalidateQueries({ queryKey: ["admin-free-bottles"] });
      toast.success("Saved", { description: "Live on the site within a minute." });
    } catch (e) {
      toast.error("Couldn't save", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<FreeBottlesSettings>) => setS((p) => (p ? { ...p, ...patch } : p));
  const setText = (patch: Partial<FreeBottlesSettings["text"]>) =>
    setS((p) => (p ? { ...p, text: { ...p.text, ...patch } } : p));

  return (
    <Section
      title="Free bottles bar"
      intro="The 'Up to 4 free bottles' progress bar: home page, product cards and pages, the cart and a short message after each add to cart. Display only: it never adds bottles or discounts. The free bottles themselves are given in Shopify (automatic discounts)."
    >
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !s ? (
        <Loading />
      ) : (
        <Panel className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Who sees it</p>
            <Toggle
              value={s.mode}
              options={[
                { key: "off", label: "Off" },
                { key: "preview", label: "Preview only for me" },
                { key: "on", label: "On for everyone" },
              ]}
              onChange={(mode) => {
                const next = { ...s, mode };
                setS(next);
                void save(next);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Preview only: open <code>friday.myfyxx.com/?preview=rewards</code> once on your phone;
              that browser keeps seeing it until you open <code>?preview=off</code>. Nobody else
              sees anything.
            </p>
          </div>

          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">
              Discounted items count toward the total
              <span className="block text-xs text-muted-foreground">
                Off: only full-price items count.
              </span>
            </span>
            <Switch
              checked={s.count_discounted}
              onCheckedChange={(v) => set({ count_discounted: v })}
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium">
              Amounts (JOD, cart total after sale prices, before delivery)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Num
                label="Free delivery"
                value={s.delivery}
                onChange={(v) => set({ delivery: v })}
              />
              {s.thresholds.map((v, i) => (
                <Num
                  key={i}
                  label={`Reward ${i + 1}`}
                  value={v}
                  onChange={(x) =>
                    set({ thresholds: s.thresholds.map((t, j) => (j === i ? x : t)) })
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Text</p>
            <Txt
              label="Headline"
              value={s.text.headline}
              onChange={(v) => setText({ headline: v })}
            />
            <Txt
              label="Away line ({amount} and {reward} are filled in)"
              value={s.text.away}
              onChange={(v) => setText({ away: v })}
            />
            <Txt
              label="Product card and page line"
              value={s.text.card}
              onChange={(v) => setText({ card: v })}
            />
            <Txt label="All unlocked" value={s.text.done} onChange={(v) => setText({ done: v })} />
            <Txt
              label="Reward not set yet"
              value={s.text.soon}
              onChange={(v) => setText({ soon: v })}
            />
            <div className="grid gap-2 sm:grid-cols-5">
              {s.text.labels.map((l, i) => (
                <Txt
                  key={i}
                  label={i === 0 ? "Label: delivery" : `Label: reward ${i}`}
                  value={l}
                  onChange={(v) =>
                    setText({ labels: s.text.labels.map((x, j) => (j === i ? v : x)) })
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What each reward is (shown when a star is tapped)</p>
            <p className="text-xs text-muted-foreground">
              Leave empty to show &quot;{s.text.soon || "Revealed soon"}&quot;. Image: a full image
              address (for example from Shopify Files).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.slots.map((slot, i) => {
                const up = (patch: Partial<typeof slot>) =>
                  set({ slots: s.slots.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="space-y-1.5 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium">Reward {i + 1}</p>
                    <Txt label="Bottle name" value={slot.name} onChange={(v) => up({ name: v })} />
                    <Txt
                      label="Image address"
                      value={slot.image}
                      onChange={(v) => up({ image: v })}
                    />
                    <Txt label="Short text" value={slot.text} onChange={(v) => up({ text: v })} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(s)}
              className="rounded-full bg-ff-red px-5 py-2 text-sm text-ff-cream disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </Panel>
      )}
    </Section>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.5"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${input} mt-1 tabular-nums`}
      />
    </label>
  );
}

function Txt({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} mt-1 text-foreground`}
      />
    </label>
  );
}
