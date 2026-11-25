// "Up to 4 free bottles": a spend-based progress bar (free delivery, then four
// free bottle rewards). DISPLAY ONLY: it never adds products, makes discounts
// or changes prices. The real free bottles are given in Shopify (automatic
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
    labels?: string[];
  };
  slots: RewardSlot[];
};

export const DEFAULT_TEXT = {
  headline: "Up to 4 free bottles",
  away: "You're {amount} away from {reward}",
  card: "Add {amount} more for {reward}",
  done: "You've unlocked all 4 free bottles",
  soon: "Revealed soon",
  labels: ["Free delivery", "1 free bottle", "2 free bottles", "3 free bottles", "4 free bottles"],
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
  /** 0 = free delivery, 1 to 4 = free bottle rewards. */
  index: number;
  amount: number;
  label: string;
  reached: boolean;
  /** Position on the bar, 0 to 100. */
  pos: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function progress(total: number, cfg: FreeBottlesConfig) {
  const labels = cfg.text.labels?.length === 5 ? cfg.text.labels : DEFAULT_TEXT.labels;
  const amounts = [cfg.delivery, ...cfg.thresholds.slice(0, 4)].map(Number);
  const max = Math.max(...amounts, 1);
  const milestones: Milestone[] = amounts.map((amount, index) => ({
    index,
    amount,
    label: labels[index] ?? "",
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

/** "You're JOD 18.500 away from 2 free bottles" (or the "all unlocked" line). */
export function awayLine(total: number, cfg: FreeBottlesConfig): string {
  const p = progress(total, cfg);
  if (!p.next) return cfg.text.done || DEFAULT_TEXT.done;
  return fill(cfg.text.away || DEFAULT_TEXT.away, p.left, p.next.label);
}

/** "Add JOD 12.000 more for 2 free bottles" (product cards and pages). */
export function cardLine(total: number, cfg: FreeBottlesConfig): string {
  // Cards always point at the next free bottle (free delivery is minor).
  const next = progress(total, cfg).milestones.find((m) => m.index > 0 && !m.reached);
  if (!next) return cfg.text.done || DEFAULT_TEXT.done;
  return fill(cfg.text.card || DEFAULT_TEXT.card, round3(next.amount - total), next.label);
}
