// Sales forecast for /admin (no server imports: safe to test on its own).
//
// "At this pace by midnight" = today's sales so far / the share of last
// year's Fyxx Friday sales (10:00 to midnight) that had come in by the same
// time. Shares come from bf_settings.forecast_last_year.share_by_hour
// ({"11": 0.015, ...}: share in by 11:00 Amman time); within an hour the share
// grows evenly.

/** Amman is UTC+3 all year. Hours since 00:00 Amman, e.g. 15.5 = 15:30. */
export function ammanHour(now: Date): number {
  const ms = now.getTime() + 3 * 3_600_000;
  const d = new Date(ms);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

/** Share of the day's sales in by `hour` (10 to 24), from last year's pattern. */
export function shareAt(shareByHour: Record<string, number>, hour: number): number | null {
  const lo = Math.floor(hour);
  const a = shareByHour[String(lo)];
  if (a === undefined) return null;
  const b = shareByHour[String(lo + 1)];
  if (b === undefined) return a;
  return a + (b - a) * (hour - lo);
}

/** Estimated total by midnight, or null when it's too early to tell. */
export function paceByMidnight(input: {
  soFar: number;
  hour: number;
  shareByHour: Record<string, number>;
  tooEarlyBefore: number;
}): number | null {
  if (input.hour < input.tooEarlyBefore) return null;
  const share = shareAt(input.shareByHour, input.hour);
  if (!share || share <= 0) return null;
  return input.soFar / Math.min(share, 1);
}
