// Public server functions the storefront calls to record campaign activity and
// client errors into Supabase, for the /admin dashboards.
//
// Both write with the service-role client into RLS-locked tables (bf_events,
// bf_error_log) that have NO public policies, so browsers can never read them
// back. Both are best-effort: they never throw, and quietly do nothing if the
// tables haven't been created yet (see docs/LOVABLE-SETUP.md).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { TRACKED_EVENTS } from "@/lib/campaign-config";

const short = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const EventInput = z.object({
  event: z.enum(TRACKED_EVENTS),
  sessionId: z.string().min(8).max(64),
  path: short(300),
  utm_source: short(200),
  utm_medium: short(200),
  utm_campaign: short(200),
  utm_content: short(200),
  utm_term: short(200),
  fromApp: z.boolean().optional(),
  value: z.number().finite().min(0).max(1_000_000).optional(),
  currency: short(8),
  itemCount: z.number().int().min(0).max(10_000).optional(),
});
export type RecordEventInput = z.input<typeof EventInput>;

export const recordEvent = createServerFn({ method: "POST" })
  .validator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data }) => {
    try {
      // Respect the admin tracking switches (site-wide off, or this device excluded).
      const { shouldTrack } = await import("./tracking-settings.server");
      if (!(await shouldTrack())) return { ok: true };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // bf_events is a new table not yet in the generated types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loose = supabaseAdmin as any;
      await loose.from("bf_events").insert({
        event: data.event,
        session_id: data.sessionId,
        path: data.path ?? null,
        utm_source: data.utm_source ?? null,
        utm_medium: data.utm_medium ?? null,
        utm_campaign: data.utm_campaign ?? null,
        utm_content: data.utm_content ?? null,
        utm_term: data.utm_term ?? null,
        from_app: data.fromApp ?? false,
        value: data.value ?? null,
        currency: data.currency ?? null,
        item_count: data.itemCount ?? null,
      });
    } catch {
      // best-effort
    }
    return { ok: true };
  });

/** Is tracking on for this visitor? Read by the root route on page load. */
export const getTrackingState = createServerFn({ method: "GET" }).handler(async () => {
  const { shouldTrack } = await import("./tracking-settings.server");
  return { enabled: await shouldTrack() };
});

const ErrorInput = z.object({
  area: z.string().trim().min(1).max(60),
  message: z.string().max(1000),
  stack: z.string().max(2000).optional(),
  path: short(300),
});

export const reportClientError = createServerFn({ method: "POST" })
  .validator((d: unknown) => ErrorInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loose = supabaseAdmin as any;
      await loose.from("bf_error_log").insert({
        area: data.area,
        message: data.message,
        path: data.path ?? null,
        user_agent: (getRequestHeader("user-agent") ?? "").slice(0, 300) || null,
        detail: data.stack ? { stack: data.stack } : null,
      });
    } catch {
      // best-effort
    }
    return { ok: true };
  });
