// Free bottles bar: a spend-based progress bar (optional free delivery dot, then
// five stars, each one a better free bottle).
// DISPLAY ONLY: it never adds products, makes discounts or changes prices. The real free bottles are given in Shopify (automatic
// discounts), set up separately.
//
// Everything (switch, preview-only, thresholds, text, what each reward is)
// comes from bf_settings via bf_teaser().free_bottles, editable on /admin.
// Shown only when rewards_enabled is on; with rewards_preview_only also on,
// only for browsers that opened the site with ?preview=rewards.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { usePreview } from "@/lib/preview";
import { formatJod } from "@/lib/shopify";
import type { CartItem } from "@/lib/shopify-cart";
import { teaserQueryOptions } from "@/lib/teaser";
import { useCartStore } from "@/stores/cartStore";

export type RewardSlot = { name?: string; image?: string; text?: string };

export type FreeBottlesConfig = {
  preview_only: boolean;
  count_discounted: boolean;
  delivery: number;
  thresholds: number[];
  text: {
    headline?: string;
    away?: string;
    card?: string;
    done?: string;
    soon?: string;
    /** The reward phrase for level 1, e.g. "your free bottle". */
    first?: string;
    /** The reward phrase for levels 2 and up, e.g. "a better free bottle ({level})". */
    upgrade?: string;
    labels?: string[];
  };
  slots: RewardSlot[];
};

/** Number of reward stars (reward_1 .. reward_5 in bf_settings). */
export const REWARD_COUNT = 5;

export const DEFAULT_TEXT = {
  headline: "Spend more, upgrade your free bottle",
  away: "You're {amount} away from {reward}",
  card: "Add {amount} more for {reward}",
  done: "You've unlocked the best free bottle",
  soon: "Revealed soon",
  // One free bottle that gets better at each level (not a new bottle each time).
  first: "your free bottle",
  upgrade: "a better free bottle ({level})",
  // [0] = free delivery (only shown when its amount is above 0), then one per star.
  labels: ["Free delivery", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"],
};

const PREVIEW_KEY = "bf_rewards_preview";

/** ?preview=rewards turns the preview on for this browser; ?preview=off turns it off. */
function previewOn(): boolean {
  try {
    const p = new URLSearchParams(window.location.search).get("preview");
    if (p === "rewards") window.localStorage.setItem(PREVIEW_KEY, "1");
    if (p === "off") window.localStorage.removeItem(PREVIEW_KEY);
    return window.localStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/** The settings when the bar should show for this visitor, otherwise null. */
export function useFreeBottles(): FreeBottlesConfig | null {
  const cfg = useQuery(teaserQueryOptions(usePreview())).data?.free_bottles ?? null;
  // Decided after the page loads (the preview lives in this browser only).
  const [preview, setPreview] = useState<boolean | null>(null);
  useEffect(() => setPreview(previewOn()), []);
  if (!cfg || preview === null) return null;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return null;
  if (cfg.preview_only && !preview) return null;
  return cfg;
}

/** Cart total that counts toward the rewards (sale prices, before delivery). */
export function rewardTotal(items: CartItem[], countDiscounted: boolean): number {
  return items.reduce((sum, i) => {
    const price = Number(i.price.amount);
    const compare = i.compareAtPrice ? Number(i.compareAtPrice.amount) : 0;
    if (!countDiscounted && compare > price) return sum;
    return sum + price * i.quantity;
  }, 0);
}

/** The live cart total for the rewards, updated as the cart changes. */
export function useRewardTotal(cfg: FreeBottlesConfig | null): number {
  const items = useCartStore((s) => s.items);
  return cfg ? rewardTotal(items, cfg.count_discounted) : 0;
}

export type Milestone = {
  /** 0 = free delivery, 1 to 5 = free bottle levels. */
  index: number;
  amount: number;
  label: string;
  reached: boolean;
  /** Position on the bar, 0 to 100. */
  pos: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function progress(total: number, cfg: FreeBottlesConfig) {
  const labels = cfg.text.labels ?? [];
  // Free delivery only when its amount is set (0 = no delivery dot); stars
  // with an amount of 0 are left out.
  const list = [
    { index: 0, amount: Number(cfg.delivery) || 0 },
    ...cfg.thresholds
      .slice(0, REWARD_COUNT)
      .map((a, i) => ({ index: i + 1, amount: Number(a) || 0 })),
  ].filter((m) => m.amount > 0);
  const max = Math.max(...list.map((m) => m.amount), 1);
  const milestones: Milestone[] = list.map(({ index, amount }) => ({
    index,
    amount,
    label: labels[index] || DEFAULT_TEXT.labels[index] || "",
    reached: total + 1e-9 >= amount,
    pos: Math.min(100, (amount / max) * 100),
  }));
  const next = milestones.find((m) => !m.reached) ?? null;
  const bottles = milestones.filter((m) => m.index > 0 && m.reached).length;
  return {
    milestones,
    next,
    bottles,
    left: next ? round3(next.amount - total) : 0,
    fill: Math.min(100, Math.max(0, (total / max) * 100)),
  };
}

/** Lower-case the first letter when a label sits mid-sentence ("Free delivery" -> "free delivery"). */
const mid = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function fill(template: string, amount: number, reward: string) {
  return template.replace("{amount}", formatJod(amount)).replace("{reward}", mid(reward));
}

/**
 * What reaching a milestone gives, as a phrase: level 1 = "your free bottle",
 * later levels = "a better free bottle (level 3)" (the same bottle, upgraded).
 */
export function rewardPhrase(m: Milestone, cfg: FreeBottlesConfig): string {
  if (m.index === 0) return m.label;
  if (m.index === 1) return cfg.text.first || DEFAULT_TEXT.first;
  return (cfg.text.upgrade || DEFAULT_TEXT.upgrade).replace("{level}", mid(m.label));
}

/** "You're JOD 18.500 away from a better free bottle (level 3)" (or the "done" line). */
export function awayLine(total: number, cfg: FreeBottlesConfig): string {
  const p = progress(total, cfg);
  if (!p.next) return cfg.text.done || DEFAULT_TEXT.done;
  return fill(cfg.text.away || DEFAULT_TEXT.away, p.left, rewardPhrase(p.next, cfg));
}

/** "Add JOD 12.000 more for 2 free bottles" (product cards and pages). */
export function cardLine(total: number, cfg: FreeBottlesConfig): string {
  // Cards always point at the next free bottle (free delivery is minor).
  const next = progress(total, cfg).milestones.find((m) => m.index > 0 && !m.reached);
  if (!next) return cfg.text.done || DEFAULT_TEXT.done;
  return fill(
    cfg.text.card || DEFAULT_TEXT.card,
    round3(next.amount - total),
    rewardPhrase(next, cfg),
  );
}

/** One reward level (star) with what it gives, for the reward cards. */
export type RewardLevel = {
  level: number;
  amount: number;
  label: string;
  slot: RewardSlot;
  reached: boolean;
  /** The level the shopper is on now (their bottle). Lower reached levels are "upgraded". */
  current: boolean;
};

export function rewardLevels(total: number, cfg: FreeBottlesConfig): RewardLevel[] {
  const list = progress(total, cfg)
    .milestones.filter((m) => m.index > 0)
    .map((m) => ({
      level: m.index,
      amount: m.amount,
      label: m.label,
      slot: cfg.slots[m.index - 1] ?? {},
      reached: m.reached,
      current: false,
    }));
  const top = list.filter((r) => r.reached).pop();
  if (top) top.current = true;
  return list;
}

/** The best level unlocked so far (null before the first one). */
export function currentReward(total: number, cfg: FreeBottlesConfig): RewardLevel | null {
  const got = rewardLevels(total, cfg).filter((r) => r.reached);
  return got[got.length - 1] ?? null;
}

/**
 * The "away" line split into pieces, so the amount and the reward can be
 * highlighted: [{text}, {text, strong: true}, ...]. All unlocked: the "done" line.
 */
export function awayParts(
  total: number,
  cfg: FreeBottlesConfig,
): Array<{ text: string; strong?: boolean }> {
  const p = progress(total, cfg);
  if (!p.next) return [{ text: cfg.text.done || DEFAULT_TEXT.done, strong: true }];
  const template = cfg.text.away || DEFAULT_TEXT.away;
  const values: Record<string, string> = {
    "{amount}": formatJod(p.left),
    "{reward}": mid(rewardPhrase(p.next, cfg)),
  };
  return template
    .split(/(\{amount\}|\{reward\})/)
    .filter(Boolean)
    .map((t) => (t in values ? { text: values[t] ?? "", strong: true } : { text: t }));
}
