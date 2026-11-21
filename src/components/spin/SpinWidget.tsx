import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Beer, Martini, Star, Wine } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  fill,
  markSeen,
  savedPoints,
  savePoints,
  spinConfigQueryOptions,
} from "@/lib/spin";
import { cn } from "@/lib/utils";

/*
 * "Spin & win" sticker (bottom left of the landing page) and a slot machine
 * popup: three reels and a lever. No email: the shopper spins, the reels stop
 * one by one on three matching symbols, then the points show.
 *
 * NOTE (backend owned by Naim): the prize is drawn here in the browser with
 * ODDS below and remembered in this browser only. Nothing is saved to
 * Supabase, so points can't be credited to anyone yet.
 */

// Chance per prize (same as bf_settings.spin_odds). Used only for the draw.
const ODDS: Array<{ points: number; weight: number }> = [
  { points: 5, weight: 40 },
  { points: 10, weight: 30 },
  { points: 15, weight: 15 },
  { points: 20, weight: 10 },
  { points: 25, weight: 5 },
];

// The symbol for each prize: three of a kind wins it.
const SYMBOLS: Array<{ points: number; icon: ReactNode; label: string }> = [
  { points: 5, icon: <Wine className="h-9 w-9" strokeWidth={2.2} />, label: "Wine" },
  { points: 10, icon: <Beer className="h-9 w-9" strokeWidth={2.2} />, label: "Beer" },
  { points: 15, icon: <Martini className="h-9 w-9" strokeWidth={2.2} />, label: "Cocktail" },
  { points: 20, icon: <Star className="h-9 w-9 fill-current" strokeWidth={2.2} />, label: "Star" },
  { points: 25, icon: <span className="ff-num text-4xl leading-none">7</span>, label: "Seven" },
];

const CELL = 64; // px height of one reel symbol
const STOPS = [1800, 2500, 3200]; // ms: each reel stops a bit later than the last
const TURNS = [12, 16, 20]; // how many symbol rounds each reel passes

function draw(): number {
  const total = ODDS.reduce((s, o) => s + o.weight, 0);
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  let r = (buf[0]! / 2 ** 32) * total;
  for (const o of ODDS) {
    if (r < o.weight) return o.points;
    r -= o.weight;
  }
  return ODDS[0]!.points;
}

export function SpinWidget({ raised }: { raised: boolean }) {
  const { data: config } = useQuery(spinConfigQueryOptions());
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  useEffect(() => {
    setMounted(true);
    setWon(savedPoints());
  }, []);

  // The popup never opens on its own: it only appears when the shopper taps
  // the sticker. (It used to open by itself 2.5s after a first visit.)
  if (!mounted || !config?.enabled) return null;
  const copy = config.copy;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          markSeen();
        }}
        aria-label={won ? `Your Fyxx points: ${won}` : (copy.sticker ?? "Spin and win")}
        className={cn(
          "fixed left-4 z-40 flex items-center gap-2 rounded-2xl border-2 border-ff-red bg-ff-burgundy py-1.5 pr-3.5 pl-1.5 text-ff-cream shadow-lg transition-[bottom] md:left-6",
          raised ? "bottom-24" : "bottom-4",
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* mini slot machine: three tiny reels */}
        <span className="flex gap-0.5 rounded-lg bg-ff-red p-1">
          {(won ? [String(won)] : ["7", "7", "7"]).map((c, i) => (
            <span
              key={i}
              className="ff-num flex h-6 min-w-5 items-center justify-center rounded bg-ff-cream px-0.5 text-xs text-ff-red"
            >
              {won ? `+${c}` : c}
            </span>
          ))}
        </span>
        <span className="ff-subline text-sm leading-none">
          {won ? "Your points" : copy.sticker}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[calc(100%-1.5rem)] max-w-sm border-0 bg-transparent p-0 shadow-none outline-none [&>button]:top-3 [&>button]:right-3 [&>button]:z-10 [&>button]:text-ff-cream"
        >
          <SlotMachine
            title={copy.title ?? "Spin & win"}
            winText={copy.win}
            winNote={copy.win_note}
            button={copy.button ?? "Spin"}
            initialWon={won}
            onWin={(p) => {
              setWon(p);
              savePoints(p);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlotMachine({
  title,
  winText,
  winNote,
  button,
  initialWon,
  onWin,
}: {
  title: string;
  winText: string | undefined;
  winNote: string | undefined;
  button: string;
  initialWon: number | null;
  onWin: (points: number) => void;
}) {
  const [phase, setPhase] = useState<"ready" | "spinning" | "done">(initialWon ? "done" : "ready");
  const [points, setPoints] = useState<number | null>(initialWon);
  const [lever, setLever] = useState(false);
  const [stopped, setStopped] = useState(0); // reels stopped so far
  const [target, setTarget] = useState<number>(() => symbolIndex(initialWon ?? 25));
  const [running, setRunning] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    if (phase !== "ready") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const p = draw();
    setTarget(symbolIndex(p));
    setPhase("spinning");
    setLever(true);
    setStopped(0);
    timers.current.push(setTimeout(() => setLever(false), 450));
    // Let the reels reset to the top, then roll to the winning row.
    setRunning(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setRunning(true)));
    STOPS.forEach((ms, i) =>
      timers.current.push(setTimeout(() => setStopped(i + 1), reduce ? 0 : ms)),
    );
    timers.current.push(
      setTimeout(
        () => {
          setPoints(p);
          setPhase("done");
          onWin(p);
        },
        reduce ? 0 : STOPS[2]! + 350,
      ),
    );
  };

  const done = phase === "done" && points !== null;

  return (
    <div className="relative mx-auto w-full select-none">
      {/* Marquee with chasing lights */}
      <div className="relative mx-6 rounded-t-[2rem] border-4 border-b-0 border-ff-red bg-ff-burgundy px-4 pt-4 pb-3 text-center">
        <Bulbs count={11} active={phase !== "ready"} />
        <DialogTitle className="ff-headline mt-2 text-2xl text-ff-cream uppercase">
          {title}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Tap Spin or pull the lever. Three of a kind wins Fyxx points.
        </DialogDescription>
      </div>

      {/* Cabinet */}
      <div className="relative rounded-[1.75rem] border-4 border-ff-red bg-ff-burgundy p-4 shadow-2xl">
        {/* Reel window */}
        <div className="rounded-2xl bg-ff-red p-2">
          <div className="relative flex gap-1.5 rounded-xl bg-ff-black/30 p-1.5">
            {[0, 1, 2].map((i) => (
              <Reel
                key={i}
                index={i}
                target={target}
                running={running}
                stopped={stopped > i || (phase === "done" && !running)}
                settled={phase === "done"}
              />
            ))}
            {/* pay line */}
            <div className="pointer-events-none absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 bg-ff-red/70" />
          </div>
        </div>

        {/* Result or button */}
        <div className="mt-4 min-h-[104px] text-center">
          {done ? (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <p className="ff-headline text-4xl text-ff-warm-cream">
                {fill(winText ?? "+{points} Fyxx points", points!)}
              </p>
              {winNote && (
                <p className="ff-subline mt-2 text-sm text-ff-cream/85">{fill(winNote, points!)}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={phase === "spinning"}
              className="ff-headline mt-2 h-14 w-full rounded-full border-b-4 border-ff-black/40 bg-ff-red text-2xl text-ff-cream uppercase shadow-lg transition-transform active:translate-y-0.5 active:border-b-2 disabled:opacity-80"
            >
              {phase === "spinning" ? "Good luck" : button}
            </button>
          )}
        </div>

        {/* Coin tray */}
        <div className="mx-auto mt-3 h-3 w-2/3 rounded-full bg-ff-black/40" />
      </div>

      {/* Lever on the right side */}
      <button
        type="button"
        onClick={start}
        disabled={phase !== "ready"}
        aria-label="Pull the lever"
        className="absolute top-[38%] -right-3 flex h-36 w-7 flex-col items-center"
      >
        <span
          className="flex w-7 origin-bottom flex-col items-center transition-transform duration-300"
          style={{ transform: lever ? "scaleY(-0.55)" : "none" }}
        >
          <span className="h-7 w-7 rounded-full border-2 border-ff-burgundy bg-ff-red shadow-md" />
          <span className="h-20 w-1.5 rounded-full bg-ff-warm-cream" />
        </span>
        <span className="h-5 w-4 rounded-r-md bg-ff-red" />
      </button>
    </div>
  );
}

function Reel({
  index,
  target,
  running,
  stopped,
  settled,
}: {
  index: number;
  target: number;
  running: boolean;
  stopped: boolean;
  settled: boolean;
}) {
  // A long strip of symbols; the reel rolls down it and stops so the target
  // symbol sits on the pay line (the middle of three visible rows).
  const turns = TURNS[index]!;
  const strip = Array.from({ length: turns + 2 }, () => SYMBOLS).flat();
  const end = (turns * SYMBOLS.length + target - 1) * CELL;
  const restOn = (target - 1 + SYMBOLS.length) % SYMBOLS.length; // idle: target in the middle
  const y = running ? end : settled ? end : restOn * CELL;
  return (
    <div
      className="relative flex-1 overflow-hidden rounded-lg bg-ff-cream"
      style={{ height: CELL * 3 }}
    >
      <div
        className="will-change-transform"
        style={{
          transform: `translateY(-${y}px)`,
          transition: running
            ? `transform ${STOPS[index]}ms cubic-bezier(0.15, 0.75, 0.25, 1)`
            : "none",
          filter: running && !stopped ? "blur(1px)" : "none",
        }}
      >
        {strip.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-ff-burgundy"
            style={{ height: CELL }}
          >
            <span
              className={cn(s.points === 25 && "text-ff-red", s.points === 20 && "text-ff-red")}
            >
              {s.icon}
            </span>
          </div>
        ))}
      </div>
      {/* shade top and bottom rows, like a curved reel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-ff-black/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ff-black/35 to-transparent" />
    </div>
  );
}

function Bulbs({ count, active }: { count: number; active: boolean }) {
  return (
    <div className="flex justify-between px-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            i % 2 ? "bg-ff-warm-cream" : "bg-ff-red",
            active && "animate-pulse",
          )}
          style={{ animationDelay: `${(i % 4) * 150}ms`, animationDuration: "0.6s" }}
        />
      ))}
    </div>
  );
}

function symbolIndex(points: number) {
  const i = SYMBOLS.findIndex((s) => s.points === points);
  return i < 0 ? 0 : i;
}
