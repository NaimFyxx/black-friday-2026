// Shared Fyxx Rewards tier data and palette, used by the home / product strip
// (MembersRewards) and the cart tiers sheet (RewardsCartSheet). The Friday
// rates are the LoyaltyLion campaign "fyxx-friday-fri-27-tier-points" (normal
// points per JOD 1 times the tier multiplier). Visual only: not connected to
// LoyaltyLion or Shopify.

import { useQuery } from "@tanstack/react-query";

import { usePreview } from "@/lib/preview";
import { teaserQueryOptions } from "@/lib/teaser";

/** Where "Log in to collect your points" goes (existing members; also the
 *  in-site email-code sheet, see RewardsSignInSheet). */
export const LOGIN_URL = "https://www.myfyxx.com/account/login";
/** "Join Fyxx Rewards": the Fyxx account registration page on myfyxx.com.
 *  Opens in a new tab, so new shoppers create a full (points-earning) account
 *  on Shopify rather than a guest one. */
export const REGISTER_URL =
  "https://www.myfyxx.com/account/register?utm_source=friday-site&utm_medium=referral&utm_campaign=fyxx-friday-2026-11-27&utm_content=tier-points-join";
/** "Learn more": the Fyxx Rewards info page. Opens in a new tab. */
export const LEARN_MORE_URL = "https://www.myfyxx.com/pages/rewards";
/** Show the "Log in" button (email-code sign-in, see RewardsSignInSheet). On
 *  this branch it is enabled for review; it stays off on main until approved. */
export const SHOW_LOGIN = true;

export const INK = "#231F20";
export const CREAM = "#FBF5F2";
export const MUTED = "#8A8175";
export const SERIF = { fontFamily: '"Baskervville", "Times New Roman", Georgia, serif' };

/** Small print under the buttons. */
export const EARN_NOTE = "Some product categories don't earn points.";

/** Where a tier-points open / tap happened, for the bf_events log. */
export type RewardsWhere = "home" | "product" | "cart";

export interface Tier {
  name: string;
  /** Friday points multiplier, shown in the tier circle. */
  points: string;
  /** Normal points per JOD 1 (crossed out in the cart sheet). */
  normal: string;
  /** Friday points per JOD 1. */
  rate: string;
  /** Membership-card tier colours (light to dark). */
  from: string;
  to: string;
}

/** Blue, Silver, Gold, Platinum: multiplier, normal rate, Friday rate, colours. */
export const TIERS: Tier[] = [
  { name: "Blue", points: "1.25x", normal: "3", rate: "3.75", from: "#C2C9E2", to: "#97A2CA" },
  { name: "Silver", points: "1.5x", normal: "4", rate: "6", from: "#C9CACD", to: "#9A9CA0" },
  { name: "Gold", points: "1.75x", normal: "5", rate: "8.75", from: "#F2E8BF", to: "#E2C98E" },
  { name: "Platinum", points: "2x", normal: "5", rate: "10", from: "#D2B6EE", to: "#B387CF" },
];

/**
 * Whether to show the Fyxx Rewards tiers. On whenever
 * bf_settings.rewards_strip_enabled is switched on in /admin (Offers): through
 * the build-up and the Friday sale, hidden only after the sale ends.
 * (?preview=friday still simulates the sale.) Shared by the home / product
 * strip and the cart line.
 */
export function useRewardsStripOn(): boolean {
  const info = useQuery(teaserQueryOptions(usePreview())).data;
  return !!info?.rewards_strip && info?.state !== "ended";
}
