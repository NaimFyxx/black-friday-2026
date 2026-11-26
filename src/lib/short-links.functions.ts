// Server functions for short links. Reads/writes use the service-role client,
// because short_links has RLS on with no public policies (same as the other
// bf_* tables). Admin functions call assertAdmin() first; the public resolve /
// existence functions never expose more than an active slug's redirect.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  buildShortLinkTarget,
  normalizeSlug,
  slugError,
  validateDestination,
  type ShortLinkRow,
} from "@/lib/short-links";

type Loose = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

async function db(): Promise<Loose> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Loose;
}

async function adminDb(): Promise<Loose> {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  return db();
}

/** Link-preview crawlers (WhatsApp, Facebook, etc.): resolve for them, but
 *  don't count their fetch as a real click. */
async function requestIsBot(): Promise<boolean> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const ua = getRequest()?.headers.get("user-agent") ?? "";
    return /bot|crawler|spider|facebookexternalhit|facebot|whatsapp|telegrambot|twitterbot|discordbot|linkedinbot|slackbot|embedly|quora|pinterest|redditbot|applebot|bingpreview|slurp|preview/i.test(
      ua,
    );
  } catch {
    return false;
  }
}

const SlugArg = z.object({ slug: z.string().min(1).max(64) });

type ResolveRow = {
  destination_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

/** Public: resolve a slug to the final URL (destination + UTMs) and count the
 *  click. Returns { target: null } for unknown, inactive or unsafe links. */
export const getShortLinkTarget = createServerFn({ method: "GET" })
  .validator((d: unknown) => SlugArg.parse(d))
  .handler(async ({ data }): Promise<{ target: string | null }> => {
    const slug = normalizeSlug(data.slug);
    if (slugError(slug)) return { target: null };
    try {
      const client = await db();
      const { data: rows, error } = await client.rpc("resolve_short_link", {
        p_slug: slug,
        p_count: !(await requestIsBot()),
      });
      if (error) return { target: null };
      const row = (Array.isArray(rows) ? rows[0] : rows) as ResolveRow | undefined;
      if (!row) return { target: null };
      // Safety net: never redirect to a destination that is not allowed.
      const target = buildShortLinkTarget(row.destination_path, {
        utm_source: row.utm_source,
        utm_medium: row.utm_medium,
        utm_campaign: row.utm_campaign,
        utm_content: row.utm_content,
      });
      return { target };
    } catch {
      return { target: null };
    }
  });

/** Public: is this slug a live short link? Used by the root route to switch off
 *  tracking on redirect pages. Never throws, so it can't break page loads. */
export const isActiveShortLink = createServerFn({ method: "GET" })
  .validator((d: unknown) => SlugArg.parse(d))
  .handler(async ({ data }): Promise<{ active: boolean }> => {
    const slug = normalizeSlug(data.slug);
    if (slugError(slug)) return { active: false };
    try {
      const client = await db();
      const { data: rows, error } = await client
        .from("short_links")
        .select("slug")
        .eq("slug", slug)
        .eq("is_active", true)
        .limit(1);
      if (error) return { active: false };
      return { active: Array.isArray(rows) && rows.length > 0 };
    } catch {
      return { active: false };
    }
  });

// ── Admin ─────────────────────────────────────────────────────────────

/** True when Postgres/PostgREST says the table does not exist yet. */
function isMissing(err: { message: string; code?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    /does not exist|could not find/i.test(err.message)
  );
}

const SELECT_COLS =
  "id, slug, destination_path, utm_source, utm_medium, utm_campaign, utm_content, is_active, click_count, created_at, updated_at";

export const listShortLinks = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ setup: boolean; links: ShortLinkRow[] }> => {
    const client = await adminDb();
    const { data, error } = await client
      .from("short_links")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) return { setup: false, links: [] };
      throw new Error(error.message);
    }
    return { setup: true, links: (data ?? []) as ShortLinkRow[] };
  },
);

const utmField = z
  .string()
  .trim()
  .max(200)
  .refine((v) => !/[–—]/.test(v), {
    message: "Please use a plain hyphen, not a long dash.",
  })
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

const CreateInput = z.object({
  slug: z.string().min(1).max(64),
  destination_path: z.string().min(1).max(2048),
  utm_source: utmField,
  utm_medium: utmField,
  utm_campaign: utmField,
  utm_content: utmField,
});

type SaveResult = { ok: true; link: ShortLinkRow } | { ok: false; error: string };

export const createShortLink = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }): Promise<SaveResult> => {
    const slug = normalizeSlug(data.slug);
    const slugMsg = slugError(slug);
    if (slugMsg) return { ok: false, error: slugMsg };
    const dest = validateDestination(data.destination_path);
    if (!dest.ok) return { ok: false, error: dest.error };

    const client = await adminDb();
    const now = new Date().toISOString();
    const { data: row, error } = await client
      .from("short_links")
      .insert({
        slug,
        destination_path: dest.value,
        utm_source: data.utm_source,
        utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign,
        utm_content: data.utm_content,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select(SELECT_COLS)
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That slug is already taken." };
      if (isMissing(error)) return { ok: false, error: "The short_links table is not set up yet." };
      throw new Error(error.message);
    }
    return { ok: true, link: row as ShortLinkRow };
  });

const UpdateInput = z.object({
  id: z.number().int().positive(),
  destination_path: z.string().min(1).max(2048),
  utm_source: utmField,
  utm_medium: utmField,
  utm_campaign: utmField,
  utm_content: utmField,
});

// The slug is never changed: an old shared link must keep working.
export const updateShortLink = createServerFn({ method: "POST" })
  .validator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data }): Promise<SaveResult> => {
    const dest = validateDestination(data.destination_path);
    if (!dest.ok) return { ok: false, error: dest.error };
    const client = await adminDb();
    const { data: row, error } = await client
      .from("short_links")
      .update({
        destination_path: dest.value,
        utm_source: data.utm_source,
        utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign,
        utm_content: data.utm_content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, link: row as ShortLinkRow };
  });

export const setShortLinkActive = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.number().int().positive(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const client = await adminDb();
    const { error } = await client
      .from("short_links")
      .update({ is_active: data.is_active, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
