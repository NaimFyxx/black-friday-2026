import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";

import { ErrorBox, fmtDate, Loading, PageHeader, Panel } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getSaleAdmin, refreshProductsNow, saveSaleSettings } from "@/lib/sale-admin.functions";

export const Route = createFileRoute("/admin/sale")({
  component: SalePage,
});

// Stored as ISO with +03:00; the inputs show Amman local time.
const toAmmanInput = (iso: unknown) =>
  typeof iso === "string" && iso
    ? new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 16)
    : "";

type Form = {
  sale_start: string;
  sale_end: string;
  badge_amount_threshold: string;
  upto_min_products: string;
  top_deals_count: string;
  batch_size: string;
  price_bands: string;
  discount_filters: string;
  nav_groups: string;
  sale_list_filter: string;
  sale_label_preview: string;
  category_mapping: string;
  exclusions: string;
  teaser_headline: string;
  teaser_subline: string;
  teaser_countdown_label: string;
  teaser_button: string;
  teaser_cart_note: string;
};

function SalePage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getSaleAdmin);
  const saveFn = useServerFn(saveSaleSettings);
  const refreshFn = useServerFn(refreshProductsNow);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-sale"], queryFn: () => getFn() });
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || form) return;
    const s = data.settings;
    setForm({
      sale_start: toAmmanInput(s["sale_start"]),
      sale_end: toAmmanInput(s["sale_end"]),
      badge_amount_threshold: String(s["badge_amount_threshold"] ?? 100),
      upto_min_products: String(s["upto_min_products"] ?? 10),
      top_deals_count: String(s["top_deals_count"] ?? 12),
      batch_size: String(s["batch_size"] ?? 24),
      price_bands: ((s["price_bands"] as number[] | undefined) ?? [20, 50, 100]).join(", "),
      nav_groups: JSON.stringify(s["nav_groups"] ?? [], null, 2),
      sale_list_filter: s["sale_list_filter"] === false ? "false" : "true",
      sale_label_preview: String(s["sale_label_preview"] ?? ""),
      discount_filters: ((s["discount_filters"] as number[] | undefined) ?? [10, 20, 30]).join(
        ", ",
      ),
      category_mapping: JSON.stringify(s["category_mapping"] ?? [], null, 2),
      exclusions: JSON.stringify(s["exclusions"] ?? {}, null, 2),
      teaser_headline: String(s["teaser_headline"] ?? ""),
      teaser_subline: String(s["teaser_subline"] ?? ""),
      teaser_countdown_label: String(s["teaser_countdown_label"] ?? ""),
      teaser_button: String(s["teaser_button"] ?? ""),
      teaser_cart_note: String(s["teaser_cart_note"] ?? ""),
    });
  }, [data, form]);

  const reload = () => queryClient.invalidateQueries({ queryKey: ["admin-sale"] });
  const save = useMutation({
    mutationFn: (payload: unknown) => saveFn({ data: payload }),
    onSuccess: reload,
  });
  const refresh = useMutation({ mutationFn: () => refreshFn(), onSettled: reload });

  const submit = () => {
    if (!form) return;
    setFormError(null);
    let mapping: unknown, exclusions: unknown, navGroups: unknown;
    try {
      navGroups = JSON.parse(form.nav_groups);
    } catch {
      return setFormError("Header sections is not valid JSON");
    }
    try {
      mapping = JSON.parse(form.category_mapping);
    } catch {
      return setFormError("Category mapping is not valid JSON");
    }
    try {
      exclusions = JSON.parse(form.exclusions);
    } catch {
      return setFormError("Exclusions is not valid JSON");
    }
    save.mutate({
      sale_start: form.sale_start,
      sale_end: form.sale_end,
      badge_amount_threshold: Number(form.badge_amount_threshold),
      upto_min_products: Number(form.upto_min_products),
      top_deals_count: Number(form.top_deals_count),
      batch_size: Number(form.batch_size),
      price_bands: form.price_bands
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => v > 0),
      nav_groups: navGroups,
      sale_list_filter: form.sale_list_filter === "true",
      sale_label_preview: form.sale_label_preview,
      discount_filters: form.discount_filters
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => v > 0)
        .sort((a, b) => a - b),
      category_mapping: mapping,
      exclusions,
      teaser_headline: form.teaser_headline,
      teaser_subline: form.teaser_subline,
      teaser_countdown_label: form.teaser_countdown_label,
      teaser_button: form.teaser_button,
      teaser_cart_note: form.teaser_cart_note,
    });
  };

  const last = data?.settings["products_last_refresh"] as
    { at: string; ok: boolean; count?: number; error?: string } | undefined;
  const start = data ? new Date(String(data.settings["sale_start"])) : null;
  const end = data ? new Date(String(data.settings["sale_end"])) : null;
  const now = new Date();
  const state =
    !start || now < start ? "Before the sale" : end && now >= end ? "Sale ended" : "Sale is ON";
  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <>
      <PageHeader title="Sale & products">
        Everything the shop page uses: sale dates, badge and &quot;up to&quot; rules, filters and
        which Shopify products are included. Saved changes show on the site within a minute, no
        redeploy needed. Prices always come from Shopify.
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data || !form ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <Panel className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">Products from Shopify</p>
              <p className="text-sm text-muted-foreground">
                {last
                  ? last.ok
                    ? `Last refresh ${fmtDate(last.at, true)}: ${last.count} products.`
                    : `Last refresh ${fmtDate(last.at, true)} FAILED: ${last.error}`
                  : "Not refreshed yet."}{" "}
                Refreshes by itself every 15 minutes.
              </p>
            </div>
            <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              {refresh.isPending ? "Refreshing…" : "Refresh products now"}
            </Button>
          </Panel>
          {refresh.error && <ErrorBox error={refresh.error} />}

          <Panel className="space-y-4">
            <p className="font-medium">
              Sale dates (Amman time){" "}
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">
                {state}
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sale starts">
                <Input
                  type="datetime-local"
                  value={form.sale_start}
                  onChange={(e) => set("sale_start")(e.target.value)}
                />
              </Field>
              <Field label="Sale ends">
                <Input
                  type="datetime-local"
                  value={form.sale_end}
                  onChange={(e) => set("sale_end")(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Before the start: normal prices, no badges. During: only discounted products, badges,
              &quot;up to&quot; and Top deals. After the end: a thank-you message.
            </p>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="font-medium">Only show products on the Fyxx Friday sale list</p>
                <p className="text-sm text-muted-foreground">
                  {form.sale_list_filter === "true"
                    ? "ON: the shop shows only products marked in_sale on the sale list (bf_sale_list)."
                    : "OFF: the shop shows every in-stock product. Use this if the sale list has a problem."}{" "}
                  Press Save settings to apply.
                </p>
              </div>
              <Switch
                checked={form.sale_list_filter === "true"}
                onCheckedChange={(v) => set("sale_list_filter")(v ? "true" : "false")}
              />
            </div>
            <Field
              label="Label on sale-list products before the sale starts"
              hint="Shown on the product photo until Friday 10:00. Leave empty to hide it."
            >
              <Input
                value={form.sale_label_preview}
                onChange={(e) => set("sale_label_preview")(e.target.value)}
              />
            </Field>
          </Panel>

          <Panel className="space-y-4">
            <p className="font-medium">Before the sale: big header and cart note</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline">
                <Input
                  value={form.teaser_headline}
                  onChange={(e) => set("teaser_headline")(e.target.value)}
                />
              </Field>
              <Field label="Line under the headline">
                <Input
                  value={form.teaser_subline}
                  onChange={(e) => set("teaser_subline")(e.target.value)}
                />
              </Field>
              <Field
                label="Countdown text"
                hint="Shown before the time left, e.g. Prices drop in 5d 03h 12m"
              >
                <Input
                  value={form.teaser_countdown_label}
                  onChange={(e) => set("teaser_countdown_label")(e.target.value)}
                />
              </Field>
              <Field label="Button" hint="Scrolls down to the filters.">
                <Input
                  value={form.teaser_button}
                  onChange={(e) => set("teaser_button")(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Note in the cart"
              hint="Shown in the cart only before the sale starts. Leave empty to hide it."
            >
              <Input
                value={form.teaser_cart_note}
                onChange={(e) => set("teaser_cart_note")(e.target.value)}
              />
            </Field>
          </Panel>

          <Panel className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Badge switches to “Save JOD” at this price (JOD)"
              hint="Under it the badge shows −15%; at or above, Save JOD 12.000."
            >
              <Input
                type="number"
                min={0}
                value={form.badge_amount_threshold}
                onChange={(e) => set("badge_amount_threshold")(e.target.value)}
              />
            </Field>
            <Field
              label="“Up to X%” needs at least this many products"
              hint="With fewer products, their own highest percent is used."
            >
              <Input
                type="number"
                min={1}
                value={form.upto_min_products}
                onChange={(e) => set("upto_min_products")(e.target.value)}
              />
            </Field>
            <Field label="Top deals to show">
              <Input
                type="number"
                min={0}
                max={48}
                value={form.top_deals_count}
                onChange={(e) => set("top_deals_count")(e.target.value)}
              />
            </Field>
            <Field label="Products per batch (infinite scroll)">
              <Input
                type="number"
                min={6}
                max={96}
                value={form.batch_size}
                onChange={(e) => set("batch_size")(e.target.value)}
              />
            </Field>
            <Field
              label="Price band edges in JOD, comma separated"
              hint="20, 50, 100 makes: Under JOD 20, JOD 20 to 50, JOD 50 to 100, JOD 100+"
            >
              <Input
                value={form.price_bands}
                onChange={(e) => set("price_bands")(e.target.value)}
              />
            </Field>
            <Field
              label="Discount filter steps in %, comma separated"
              hint="10, 20, 30 makes: 10% off or more, 20% off or more, 30% off or more. Shown during the sale only."
            >
              <Input
                value={form.discount_filters}
                onChange={(e) => set("discount_filters")(e.target.value)}
              />
            </Field>
          </Panel>

          <Panel className="space-y-4">
            <Field
              label="Category mapping (JSON)"
              hint="Category circles in order. A product joins the first category whose product_types match its Shopify product type (require_tags: it must also have one of these tags; handles: named products). Inside it, the first sub category whose Shopify collections, tags or product types match. image_handle: the product whose photo shows in the circle."
            >
              <Textarea
                rows={14}
                className="font-mono text-xs"
                value={form.category_mapping}
                onChange={(e) => set("category_mapping")(e.target.value)}
              />
            </Field>
            <Field
              label="Never include (JSON)"
              hint="Excluded by product type, product type prefix, vendor or tag. tags_in_main excludes a tag only inside one main category (Cuban cigars)."
            >
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={form.exclusions}
                onChange={(e) => set("exclusions")(e.target.value)}
              />
            </Field>
            <Field
              label="Header sections (JSON)"
              hint="The links in the site header, e.g. The Cellar. Each shows the products of its main categories (names exactly as in the category mapping)."
            >
              <Textarea
                rows={8}
                className="font-mono text-xs"
                value={form.nav_groups}
                onChange={(e) => set("nav_groups")(e.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              After changing the mapping or exclusions, press Refresh products now to apply them.
            </p>
          </Panel>

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
            {save.isSuccess && <span className="text-sm text-muted-foreground">Saved.</span>}
          </div>
          {formError && <ErrorBox error={new Error(formError)} />}
          {save.error && <ErrorBox error={save.error} />}

          <Panel>
            <p className="mb-3 font-medium">Products per category</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4">Category</th>
                    <th className="py-1 pr-4 text-right">In the index</th>
                    <th className="py-1 pr-4 text-right">In stock</th>
                    <th className="py-1 pr-4 text-right">Discounted</th>
                    <th className="py-1 text-right">Up to</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.map((r) => (
                    <tr key={`${r.main}/${r.sub ?? ""}`} className="border-t border-border">
                      <td className={r.sub ? "py-1 pr-4 pl-4" : "py-1 pr-4 font-medium"}>
                        {r.sub ?? r.main}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">{r.total}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{r.inStock}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{r.onSale}</td>
                      <td className="py-1 text-right tabular-nums">
                        {r.upto === null ? "" : `${r.upto}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              &quot;Discounted&quot; means in stock with a Shopify compare-at price above the price.
              &quot;Up to&quot; is what the site will show once the sale starts. The All row is the
              hero headline.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
