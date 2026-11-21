import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  deviceId,
  fill,
  markSeen,
  savedPoints,
  savePoints,
  spin,
  spinConfigQueryOptions,
  wasSeen,
} from "@/lib/spin";
import { cn } from "@/lib/utils";

const ITEM = 88; // px height of one reel number
const LOOPS = 14; // how many times the numbers pass before stopping
const SPIN_MS = 3200;

/**
 * "Spin & win" sticker (bottom left of the landing page) and its slot machine
 * popup. Opens by itself on the first visit; afterwards from the sticker.
 */
export function SpinWidget({ raised }: { raised: boolean }) {
  const { data: config } = useQuery(spinConfigQueryOptions());
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  useEffect(() => {
    setMounted(true);
    setWon(savedPoints());
  }, []);

  // First visit: open by itself after a moment.
  useEffect(() => {
    if (!config?.enabled || wasSeen() || savedPoints()) return;
    const t = setTimeout(() => {
      setOpen(true);
      markSeen();
    }, 2500);
    return () => clearTimeout(t);
  }, [config?.enabled]);

  if (!mounted || !config?.enabled || config.prizes.length === 0) return null;
  const copy = config.copy;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          markSeen();
        }}
        className={cn(
          "fixed left-4 z-40 flex items-center gap-2 rounded-full border-2 border-ff-cream bg-ff-red py-1.5 pr-4 pl-1.5 text-ff-cream shadow-lg transition-[bottom] md:left-6",
          raised ? "bottom-24" : "bottom-4",
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <MiniReel value={won ?? Math.max(...config.prizes)} />
        <span className="ff-subline text-sm leading-none">
          {won ? "Your points" : copy.sticker}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border-0 bg-ff-burgundy p-6 text-ff-cream [&>button]:text-ff-cream">
          <SlotMachine
            prizes={config.prizes}
            copy={copy}
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

function MiniReel({ value }: { value: number }) {
  return (
    <span className="ff-num flex h-8 min-w-10 items-center justify-center rounded-full bg-ff-cream px-2 text-sm text-ff-red">
      +{value}
    </span>
  );
}

function SlotMachine({
  prizes,
  copy,
  initialWon,
  onWin,
}: {
  prizes: number[];
  copy: import("@/lib/spin").SpinCopy;
  initialWon: number | null;
  onWin: (points: number) => void;
}) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"ready" | "spinning" | "done">(initialWon ? "done" : "ready");
  const [points, setPoints] = useState<number | null>(initialWon);
  const [already, setAlready] = useState(!!initialWon);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(() =>
    initialWon ? indexFor(prizes, initialWon, LOOPS - 1) * ITEM : 0,
  );
  const [animate, setAnimate] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const reel = Array.from({ length: LOOPS + 1 }, () => prizes).flat();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (phase !== "ready") return;
    setError(null);
    setPhase("spinning");
    // Start the reel turning while the server draws the prize.
    setAnimate(false);
    setOffset(0);
    try {
      const res = await spin(email, deviceId());
      if (!res.ok) {
        setPhase("ready");
        setError(
          res.reason === "email" ? "Please check your email address." : "The game is closed.",
        );
        return;
      }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => {
        setAnimate(!reduce);
        setOffset(indexFor(prizes, res.points, LOOPS - 1) * ITEM);
      });
      timer.current = setTimeout(
        () => {
          setPoints(res.points);
          setAlready(res.already);
          setPhase("done");
          onWin(res.points);
        },
        reduce ? 0 : SPIN_MS,
      );
    } catch {
      setPhase("ready");
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <DialogTitle className="ff-headline text-2xl text-ff-cream">{copy.title}</DialogTitle>
      <DialogDescription className="ff-subline mt-1 text-sm text-ff-cream/80">
        {copy.subtitle}
      </DialogDescription>

      {/* The machine */}
      <div className="mt-5 w-full rounded-2xl bg-ff-red p-3 shadow-inner">
        <div className="flex items-center justify-center gap-1.5 pb-2" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full bg-ff-warm-cream",
                phase === "spinning" && "animate-pulse",
              )}
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <div
          className="relative mx-auto overflow-hidden rounded-xl border-4 border-ff-burgundy bg-ff-cream"
          style={{ height: ITEM }}
          aria-live="polite"
        >
          <div
            className="will-change-transform"
            style={{
              transform: `translateY(-${offset}px)`,
              transition: animate
                ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)`
                : "none",
            }}
          >
            {reel.map((p, i) => (
              <div
                key={i}
                className="ff-num flex items-center justify-center text-5xl text-ff-burgundy"
                style={{ height: ITEM }}
              >
                +{p}
              </div>
            ))}
          </div>
          {/* soft fade top and bottom */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-ff-black/15 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-ff-black/15 to-transparent" />
        </div>
        <p className="ff-subline pt-2 text-xs tracking-[0.2em] text-ff-cream uppercase">
          Fyxx points
        </p>
      </div>

      {phase === "done" && points ? (
        <div className="mt-5">
          {already ? (
            <p className="ff-subline text-base">{fill(copy.already, points)}</p>
          ) : (
            <>
              <p className="ff-headline text-3xl text-ff-cream">{fill(copy.win, points)}</p>
              <p className="ff-subline mt-2 text-sm text-ff-cream/85">
                {fill(copy.win_note, points)}
              </p>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 w-full space-y-3 text-left">
          <label className="block">
            <span className="ff-small text-xs text-ff-cream/85">{copy.email_label}</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={phase === "spinning"}
              className="ff-small mt-1 h-11 w-full rounded-full border-0 bg-ff-cream px-4 text-sm text-ff-black"
              placeholder="you@example.com"
            />
          </label>
          {error && <p className="ff-small text-xs text-ff-warm-cream">{error}</p>}
          <button
            type="submit"
            disabled={phase === "spinning"}
            className="ff-headline flex h-12 w-full items-center justify-center rounded-full bg-ff-red text-lg text-ff-cream uppercase disabled:opacity-70"
          >
            {phase === "spinning" ? <Loader2 className="h-5 w-5 animate-spin" /> : copy.button}
          </button>
          {copy.privacy && (
            <p className="ff-small text-center text-[11px] text-ff-cream/70">{copy.privacy}</p>
          )}
        </form>
      )}
    </div>
  );
}

/** Index in the long reel where `points` sits on the given loop. */
function indexFor(prizes: number[], points: number, loop: number) {
  const i = Math.max(0, prizes.indexOf(points));
  return loop * prizes.length + i;
}
