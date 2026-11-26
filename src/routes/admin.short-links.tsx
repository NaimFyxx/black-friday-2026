import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Pencil, Plus } from "lucide-react";

import {
  ErrorBox,
  fmtDate,
  fmtNum,
  Loading,
  Note,
  PageHeader,
  Panel,
  SetupNotice,
  TD,
  TDR,
  TH,
  THR,
  TR,
} from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createShortLink,
  listShortLinks,
  setShortLinkActive,
  updateShortLink,
} from "@/lib/short-links.functions";
import {
  buildShortLinkTarget,
  DEFAULT_UTM_CAMPAIGN,
  DEFAULT_UTM_MEDIUM,
  normalizeSlug,
  SHORT_LINK_ORIGIN,
  shortLinkUrl,
  slugError,
  validateDestination,
  type ShortLinkRow,
} from "@/lib/short-links";

export const Route = createFileRoute("/admin/short-links")({
  component: ShortLinksPage,
});

type FormState = {
  id: number | null;
  slug: string;
  destination_path: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
};

const emptyForm = (): FormState => ({
  id: null,
  slug: "",
  destination_path: "/",
  utm_source: "",
  utm_medium: DEFAULT_UTM_MEDIUM,
  utm_campaign: DEFAULT_UTM_CAMPAIGN,
  utm_content: "",
});

/** The full URL to show in the preview (paths are shown on the Friday origin). */
function fullTarget(destination: string, utms: Record<string, string>): string | null {
  const t = buildShortLinkTarget(destination, utms);
  if (t === null) return null;
  return t.startsWith("http") ? t : `${SHORT_LINK_ORIGIN}${t}`;
}

function ShortLinksPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listShortLinks);
  const createFn = useServerFn(createShortLink);
  const updateFn = useServerFn(updateShortLink);
  const activeFn = useServerFn(setShortLinkActive);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-short-links"],
    queryFn: () => listFn(),
  });

  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-short-links"] });

  const slug = normalizeSlug(form.slug);
  const slugMsg = form.id === null ? slugError(slug) : null;
  const destCheck = validateDestination(form.destination_path);
  const utms = {
    utm_source: form.utm_source,
    utm_medium: form.utm_medium,
    utm_campaign: form.utm_campaign,
    utm_content: form.utm_content,
  };
  const preview = useMemo(
    () => (destCheck.ok ? fullTarget(form.destination_path, utms) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.destination_path, form.utm_source, form.utm_medium, form.utm_campaign, form.utm_content],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        destination_path: form.destination_path,
        utm_source: form.utm_source || undefined,
        utm_medium: form.utm_medium || undefined,
        utm_campaign: form.utm_campaign || undefined,
        utm_content: form.utm_content || undefined,
      };
      return form.id === null
        ? createFn({ data: { slug, ...payload } })
        : updateFn({ data: { id: form.id, ...payload } });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setFormError(null);
      toast.success(form.id === null ? "Short link created" : "Short link saved");
      setForm(emptyForm());
      void refresh();
    },
    onError: () => setFormError("Something went wrong. Please try again."),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: number; is_active: boolean }) => activeFn({ data: v }),
    onSuccess: () => void refresh(),
    onError: () => toast.error("Could not change that link. Please try again."),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (slugMsg) return setFormError(slugMsg);
    if (!destCheck.ok) return setFormError(destCheck.error);
    save.mutate();
  };

  const startEdit = (row: ShortLinkRow) => {
    setFormError(null);
    setForm({
      id: row.id,
      slug: row.slug,
      destination_path: row.destination_path,
      utm_source: row.utm_source ?? "",
      utm_medium: row.utm_medium ?? "",
      utm_campaign: row.utm_campaign ?? "",
      utm_content: row.utm_content ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Short link copied");
    } catch {
      toast.error("Could not copy. Please copy it by hand.");
    }
  };

  const links = data?.links ?? [];
  const editing = form.id !== null;

  return (
    <>
      <PageHeader title="Short links">
        Short links on friday.myfyxx.com that open a page with campaign tags added, so WhatsApp,
        Instagram and Facebook still show the normal Fyxx Friday preview. Share the short URL, read
        the clicks here.
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : !data.setup ? (
        <SetupNotice title="Short links are not set up yet">
          The short_links table is missing from the database.
        </SetupNotice>
      ) : (
        <div className="mt-5 space-y-6">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{editing ? `Edit /${form.slug}` : "New link"}</p>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForm(emptyForm());
                    setFormError(null);
                  }}
                >
                  <Plus /> New link
                </Button>
              )}
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Short link word" hint="Lowercase letters, numbers and dashes.">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">/</span>
                    <Input
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="e.g. wa"
                      disabled={editing}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  {editing && (
                    <span className="block text-xs text-muted-foreground">
                      The word cannot be changed, so old shared links keep working.
                    </span>
                  )}
                </Field>
                <Field
                  label="Destination"
                  hint="A path like / or /product/x, or a full https:// link on myfyxx.com."
                >
                  <Input
                    value={form.destination_path}
                    onChange={(e) => setForm((f) => ({ ...f, destination_path: e.target.value }))}
                    placeholder="/"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="utm_source">
                  <Input
                    value={form.utm_source}
                    onChange={(e) => setForm((f) => ({ ...f, utm_source: e.target.value }))}
                    placeholder="e.g. whatsapp"
                  />
                </Field>
                <Field label="utm_medium">
                  <Input
                    value={form.utm_medium}
                    onChange={(e) => setForm((f) => ({ ...f, utm_medium: e.target.value }))}
                  />
                </Field>
                <Field label="utm_campaign">
                  <Input
                    value={form.utm_campaign}
                    onChange={(e) => setForm((f) => ({ ...f, utm_campaign: e.target.value }))}
                  />
                </Field>
                <Field label="utm_content" hint="Optional.">
                  <Input
                    value={form.utm_content}
                    onChange={(e) => setForm((f) => ({ ...f, utm_content: e.target.value }))}
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Preview</p>
                <p className="mt-1 break-all">
                  <span className="font-medium">{shortLinkUrl(slug || "...")}</span>
                </p>
                <p className="mt-1 break-all text-muted-foreground">
                  goes to{" "}
                  {destCheck.ok ? (
                    <span className="text-foreground">{preview}</span>
                  ) : (
                    <span className="text-red-700">{destCheck.error}</span>
                  )}
                </p>
              </div>

              {formError && <p className="text-sm text-red-700">{formError}</p>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : editing ? "Save changes" : "Create short link"}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <p className="mb-3 font-medium">All links</p>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No short links yet. Add one above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={TH}>Short link</th>
                      <th className={TH}>Destination</th>
                      <th className={TH}>Campaign tags</th>
                      <th className={THR}>Clicks</th>
                      <th className={THR}>Active</th>
                      <th className={THR}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((row) => (
                      <tr key={row.id} className={TR}>
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">/{row.slug}</span>
                            <button
                              type="button"
                              onClick={() => copy(shortLinkUrl(row.slug))}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                              title="Copy the full short URL"
                            >
                              <Copy className="size-3" /> Copy
                            </button>
                          </div>
                          <span className="block text-[11px] break-all text-muted-foreground">
                            {shortLinkUrl(row.slug)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            Added {fmtDate(row.created_at)}
                          </span>
                        </td>
                        <td className={`${TD} break-all`}>{row.destination_path}</td>
                        <td className={TD}>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {[
                              row.utm_source && `source: ${row.utm_source}`,
                              row.utm_medium && `medium: ${row.utm_medium}`,
                              row.utm_campaign && `campaign: ${row.utm_campaign}`,
                              row.utm_content && `content: ${row.utm_content}`,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "none"}
                          </span>
                        </td>
                        <td className={TDR}>{fmtNum(row.click_count)}</td>
                        <td className={TDR}>
                          <div className="flex justify-end">
                            <Switch
                              checked={row.is_active}
                              disabled={toggle.isPending}
                              onCheckedChange={(v) => toggle.mutate({ id: row.id, is_active: v })}
                            />
                          </div>
                        </td>
                        <td className={TDR}>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Pencil className="size-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3">
              <Note>
                Switching a link off stops it at once: visitors see the normal page or a 404. It is
                never deleted, so you can switch it back on and the same short URL works again.
              </Note>
            </div>
          </Panel>
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
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
