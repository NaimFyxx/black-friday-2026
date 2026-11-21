// /admin/spins: the Spin & win results (to credit in LoyaltyLion) and the game's
// settings in bf_settings (spin_enabled, spin_odds, spin_copy). Admin session
// required. Touches only bf_spins and bf_settings.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Loose = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

async function admin() {
  const { assertAdmin } = await import("./admin-session.server");
  await assertAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Loose;
}

export const getSpinsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const spins: Array<{ email: string; points: number; created_at: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("bf_spins")
      .select("email, points, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    spins.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { data: rows, error } = await db
    .from("bf_settings")
    .select("key, value")
    .in("key", ["spin_enabled", "spin_odds", "spin_copy"]);
  if (error) throw new Error(error.message);
  const settings: Record<string, Json> = {};
  for (const r of rows ?? []) settings[r.key] = r.value;
  return { spins, settings };
});

const noDash = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[–—]/.test(v), {
      message: "Please don't use dashes like – or — in shop text",
    });

const SaveInput = z.object({
  spin_enabled: z.boolean(),
  spin_odds: z
    .array(
      z.object({ points: z.number().int().min(1).max(1000), weight: z.number().min(0).max(1000) }),
    )
    .min(1)
    .max(10)
    .refine((a) => a.some((o) => o.weight > 0), {
      message: "At least one prize needs a chance above 0",
    }),
  spin_copy: z.object({
    sticker: noDash(30),
    title: noDash(60),
    subtitle: noDash(140),
    email_label: noDash(80),
    button: noDash(30),
    win: noDash(60),
    win_note: noDash(200),
    already: noDash(140),
    privacy: noDash(140),
  }),
});

export const saveSpinSettings = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const now = new Date().toISOString();
    const rows = Object.entries(data).map(([key, value]) => ({ key, value, updated_at: now }));
    const { error } = await db.from("bf_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
