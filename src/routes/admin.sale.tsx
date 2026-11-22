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
  quick_links: string;
  reminder: string;
  no_code_note: string;
  ticker_preview: string;
  ticker_sale: string;
  ticker_ended: string;
  sale_cart_note: string;
  sale_list_filter: string;
  sale_label_preview: string;
  category_mapping: string;
  exclusions: string;
  teaser_headline: string;
  teaser_subline: string;
  teaser_countdown_label: string;
  teaser_button: string;
  teaser_cart_note: string;
  teaser_updating_note: string;
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
      quick_links: JSON.stringify(s["quick_links"] ?? [], null, 2),
      reminder: JSON.stringify(s["reminder"] ?? {}, null, 2),
      no_code_note: String(s["no_code_note"] ?? ""),
      ticker_preview: String(s["ticker_preview"] ?? ""),
      ticker_sale: String(s["ticker_sale"] ?? ""),
      ticker_ended: String(s["ticker_ended"] ?? ""),
      sale_cart_note: String(s["sale_cart_note"] ?? ""),
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
      teaser_updating_note: String(s["teaser_updating_note"] ?? ""),
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
    let quickLinks: unknown, reminder: unknown;
    try {
      navGroups = JSON.parse(form.nav_groups);
    } catch {
      return setFormError("Header sections is not valid JSON");
    }
    try {
      quickLinks = JSON.parse(form.quick_links);
    } catch {
      return setFormError("Quick links is not valid JSON");
    }
    try {
      reminder = JSON.parse(form.reminder);
    } catch {
      return setFormError("Reminder form is not valid JSON");
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
      quick_links: quickLinks,
      reminder,
      no_code_note: form.no_code_note,
      ticker_preview: form.ticker_preview,
      ticker_sale: form.ticker_sale,
      ticker_ended: form.ticker_ended,
      sale_cart_note: form.sale_cart_note,
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
      teaser_updating_note: form.teaser_updating_note,
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
        The settings behind the shop page: sale times, badges, filters, texts and which Shopify
        products are shown. Saved changes show on the site within a minute. Prices always come from
        Shopify and can&apos;t be changed here.
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
            <p className="-mt-3 text-sm text-muted-foreground">
              When Friday prices and badges switch on and off on the site.
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
              hint="Shown on the product photo until Friday 10:00, after a blurred -XX%. Example: off on Friday. Leave empty to hide it."
            >
              <Input
                value={form.sale_label_preview}
                onChange={(e) => set("sale_label_preview")(e.target.value)}
              />
            </Field>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <p className="font-medium">Before the sale: big header and cart note</p>
              <p className="text-sm text-muted-foreground">
                The texts visitors see before Friday 10:00, to get them to fill a cart early.
              </p>
            </div>
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
            <Field
              label="Line when Friday prices aren't ready"
              hint="Safety net: shown in the header instead of the countdown if at sale time too few sale products have a crossed-out price in Shopify (sale_min_marked). Preview with ?preview=updating."
            >
              <Input
                value={form.teaser_updating_note}
                onChange={(e) => set("teaser_updating_note")(e.target.value)}
              />
            </Field>
          </Panel>

          <Panel className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="font-medium">Shop page rules</p>
              <p className="text-sm text-muted-foreground">
                Numbers that decide badges, &quot;up to&quot;, Top deals and the filters.
              </p>
            </div>
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
            <div>
              <p className="font-medium">Categories, sections and texts</p>
              <p className="text-sm text-muted-foreground">
                Which products go where, the header sections, quick links and the smaller texts. The
                JSON boxes are for whoever set them up: change with care.
              </p>
            </div>
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
              hint="The links in the site header, e.g. The Cellar. Each shows the products of its main categories (names exactly as in the category mapping). For one type of a category write Category/Type, e.g. Accessories/Wine accessories."
            >
              <Textarea
                rows={8}
                className="font-mono text-xs"
                value={form.nav_groups}
                onChange={(e) => set("nav_groups")(e.target.value)}
              />
            </Field>
            <Field
              label="Quick links on Friday (JSON)"
              hint='Chips at the top of the shop during the sale. "mains" works like a header section (Category or Category/Type), "band" is a price band (0 = under the first price band). "sale_only": true shows it only during the sale.'
            >
              <Textarea
                rows={8}
                className="font-mono text-xs"
                value={form.quick_links}
                onChange={(e) => set("quick_links")(e.target.value)}
              />
            </Field>
            <Field
              label="Reminder form (JSON)"
              hint='"Send me my cart at 10:00" in the cart and "Remind me at 10:00" in the header. list_id is the Klaviyo list (Fyxx Friday 2026 - Cart reminder = Wwe9ax). "title_empty" is the pop-up title when the cart is empty. "enabled": false hides both.'
            >
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={form.reminder}
                onChange={(e) => set("reminder")(e.target.value)}
              />
            </Field>
            <Field
              label="No code line"
              hint="In the cart and under the price on product pages, before and during the sale."
            >
              <Input
                value={form.no_code_note}
                onChange={(e) => set("no_code_note")(e.target.value)}
              />
            </Field>
            <Field
              label="Ticker before the sale"
              hint="Moving red bar at the top. Separate parts with |, e.g. FYXX FRIDAY | FRI 27 NOV"
            >
              <Input
                value={form.ticker_preview}
                onChange={(e) => set("ticker_preview")(e.target.value)}
              />
            </Field>
            <Field label="Ticker during the sale" hint="Shown from sale start until midnight.">
              <Input
                value={form.ticker_sale}
                onChange={(e) => set("ticker_sale")(e.target.value)}
              />
            </Field>
            <Field
              label="Ticker after the sale"
              hint="Shown after the sale ends. Leave empty to hide the ticker."
            >
              <Input
                value={form.ticker_ended}
                onChange={(e) => set("ticker_ended")(e.target.value)}
              />
            </Field>
            <Field
              label="Cart note during the sale"
              hint="Replaces the before-the-sale cart note while the sale is on."
            >
              <Input
                value={form.sale_cart_note}
                onChange={(e) => set("sale_cart_note")(e.target.value)}
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
            <p className="font-medium">Products per category</p>
            <p className="mb-3 text-sm text-muted-foreground">
              How many products each category has on the site right now, and the biggest discount it
              will show.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4">Category</th>
                    <th className="py-1 pr-4 text-right">On the site</th>
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
