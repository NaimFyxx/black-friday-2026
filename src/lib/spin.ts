// "Spin & win" Fyxx points game. Settings and texts live in bf_settings
// (spin_enabled, spin_odds, spin_copy; editable on /admin/spins). The prize is
// drawn in the database (bf_spin), never in the browser. Points are not
// credited automatically: the team credits them in LoyaltyLion.

import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface SpinCopy {
  sticker?: string;
  title?: string;
  subtitle?: string;
  email_label?: string;
  button?: string;
  win?: string;
  win_note?: string;
  already?: string;
  privacy?: string;
}
export interface SpinConfig {
  enabled: boolean;
  prizes: number[];
  copy: SpinCopy;
}
export type SpinResult =
  { ok: true; already: boolean; points: number } | { ok: false; reason: "closed" | "email" };

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

export const spinConfigQueryOptions = () =>
  queryOptions({
    queryKey: ["bf-spin-config"],
    queryFn: async () => {
      const { data, error } = await rpc("bf_spin_config");
      if (error) throw new Error(error.message);
      return data as SpinConfig;
    },
    staleTime: 5 * 60_000,
  });

export async function spin(email: string, device: string): Promise<SpinResult> {
  const { data, error } = await rpc("bf_spin", { p_email: email, p_device: device });
  if (error) throw new Error(error.message);
  return data as SpinResult;
}

/** Replace {points} in a text from bf_settings. */
export const fill = (text: string | undefined, points: number) =>
  (text ?? "").replaceAll("{points}", String(points));

// Per-browser memory (a convenience only; the database enforces one spin).
const KEY = { device: "bf_spin_device", seen: "bf_spin_seen", result: "bf_spin_result" };
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: fine */
  }
};
export function deviceId(): string {
  let id = read(KEY.device);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random()).slice(2);
    write(KEY.device, id);
  }
  return id;
}
export const wasSeen = () => read(KEY.seen) === "1";
export const markSeen = () => write(KEY.seen, "1");
export const savedPoints = () => {
  const v = Number(read(KEY.result));
  return Number.isFinite(v) && v > 0 ? v : null;
};
export const savePoints = (p: number) => write(KEY.result, String(p));
