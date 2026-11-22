import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { CatalogItem } from "@/lib/catalog";
import type { Preview } from "@/lib/preview";
import { lookupUsual } from "@/lib/usual.functions";

import { CatalogCard } from "./CatalogCard";

const STORE_KEY = "fyxx:usual";
const KEEP_DAYS = 60;

function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as { ids?: unknown; at?: number };
    if (!Array.isArray(v.ids) || !v.at || Date.now() - v.at > KEEP_DAYS * 864e5) return [];
    return v.ids.map(String);
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ ids, at: Date.now() }));
  } catch {
    // private mode: shelf only for this visit
  }
}

/**
 * "Your usual": what this shopper ordered before, at today's prices, for
 * shoppers who came from one of our emails (Klaviyo _kx). Hidden for everyone
 * else, and when none of their products is on the site.
 */
export function YourUsual({ threshold, preview }: { threshold: number; preview: Preview | null }) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = readSaved();
    if (saved.length) setIds(saved);
    const kx = new URLSearchParams(window.location.search).get("_kx");
    if (!kx) return;
    const seen = `fyxx:usual-kx:${kx.slice(0, 40)}`;
    try {
      if (window.sessionStorage.getItem(seen)) return;
      window.sessionStorage.setItem(seen, "1");
    } catch {
      // no sessionStorage: look up anyway
    }
    lookupUsual({ data: { kx } })
      .then((r) => {
        if (r.ids.length) {
          save(r.ids);
          setIds(r.ids);
        }
      })
      .catch(() => {});
  }, []);

  const { data: items = [] } = useQuery({
    queryKey: ["usual", preview ?? "", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const call = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await call.call(supabase, "bf_usual_items", {
        p: { ids, preview, limit: 12 },
      });
      if (error) throw new Error(error.message);
      return (data as CatalogItem[]) ?? [];
    },
  });

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="your-usual" className="mt-6">
      <h2 id="your-usual" className="ff-headline text-xl text-ff-red uppercase md:text-2xl">
        Your usual
      </h2>
      <p className="ff-subline mt-1 text-sm text-ff-black/70">
        What you&apos;ve ordered before, ready to add again.
      </p>
      <div className="-mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] md:-mx-10 md:scroll-px-10 md:px-10">
        {items.map((item) => (
          <CatalogCard key={item.product_id} item={item} threshold={threshold} compact />
        ))}
      </div>
    </section>
  );
}
