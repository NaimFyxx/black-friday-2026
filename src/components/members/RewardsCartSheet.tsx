import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { trackTierPointsOpen } from "@/lib/analytics";
import { useRewardsAuth } from "@/hooks/useRewardsAuth";
import { ActivationNotice, RewardsLoginButton } from "./RewardsSignInSheet";
import { CREAM, INK, MUTED, SERIF, SHOW_LOGIN, TIERS, useRewardsStripOn } from "./rewards-tiers";

/**
 * Cart slide-out: one thin Fyxx Rewards line above Checkout, "Members earn up
 * to 2x points on this order". Tapping it opens the tiers sheet: a bottom
 * sheet on the phone (drag handle, swipe down / X / dimmed area / Escape to
 * close) and a centred box on desktop, both over a dimmed page. The four
 * tiers show the normal rate crossed out and the Friday rate. Shown only
 * during the sale (Fri 10:00 to midnight, and ?preview=friday). Visual only:
 * not connected to LoyaltyLion or Shopify.
 */
export function RewardsCartSheet({ className }: { className?: string }) {
  const on = useRewardsStripOn();
  const { signedIn } = useRewardsAuth();
  const [open, setOpen] = useState(false);
  // Live drag-to-dismiss on the phone: offset the sheet while a finger drags
  // the handle down; let go past the threshold to close.
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  if (!on) return null;

  const onOpenChange = (o: boolean) => {
    if (o) trackTierPointsOpen("cart");
    else setDragY(0);
    setOpen(o);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const delta = (e.touches[0]?.clientY ?? 0) - startY.current;
    setDragY(delta > 0 ? delta : 0);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onOpenChange(false);
    else setDragY(0);
    startY.current = null;
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-left transition-opacity hover:opacity-90",
            className,
          )}
          style={{ background: CREAM, borderColor: "rgba(35,31,32,0.12)", color: INK }}
        >
          <img
            src="/brand/fyxx-rewards-logo-black.svg"
            alt="Fyxx Rewards"
            width={746}
            height={392}
            loading="lazy"
            className="h-5 w-auto shrink-0"
          />
          <span style={SERIF} className="min-w-0 text-[13px] leading-tight">
            Members earn up to 2x points on this order
          </span>
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby="rewards-sheet-sub"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-2xl shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            // Desktop: a centred box that fades/zooms in instead of sliding.
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
          )}
          style={{ background: CREAM, color: INK }}
        >
          <div style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}>
            {/* Drag handle (phone): swipe down here to close. */}
            <div
              className="flex touch-none justify-center pt-2.5 pb-1 sm:hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <span
                aria-hidden="true"
                className="h-1 w-10 rounded-full"
                style={{ background: "rgba(35,31,32,0.2)" }}
              />
            </div>

            <DialogPrimitive.Close
              className="absolute right-3 top-3 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
              style={{ color: INK }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <div className="px-5 pt-2 pb-6 sm:pt-5">
              <img
                src="/brand/fyxx-rewards-logo-black.svg"
                alt="Fyxx Rewards"
                width={746}
                height={392}
                loading="lazy"
                className="mx-auto h-7 w-auto"
              />
              <DialogPrimitive.Title style={SERIF} className="mt-3 text-center text-xl md:text-2xl">
                Up to 2x points <em>this Friday</em>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="rewards-sheet-sub"
                className="mx-auto mt-1.5 max-w-sm text-center text-sm"
                style={{ color: MUTED }}
              >
                Every Fyxx Rewards member earns more on Friday orders, 10:00 to midnight.
              </DialogPrimitive.Description>

              <ul className="mx-auto mt-4 max-w-sm space-y-2">
                {TIERS.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                  >
                    <span
                      style={{
                        ...SERIF,
                        background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                        border: `2px solid ${CREAM}`,
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs shadow-[0_2px_6px_rgba(35,31,32,0.18)]"
                    >
                      {t.points}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: INK }}>
                      {t.name}
                    </span>
                    <span className="ml-auto text-sm" style={{ color: MUTED }}>
                      <s>{t.normal}</s>{" "}
                      <strong className="font-semibold" style={{ color: INK }}>
                        {t.rate}
                      </strong>{" "}
                      pts per JOD 1
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mx-auto mt-4 flex max-w-sm gap-2">
                {SHOW_LOGIN && (
                  <RewardsLoginButton
                    where="cart"
                    label="Log in"
                    variant="outline"
                    className="h-10 flex-1"
                  />
                )}
                {!signedIn && (
                  <RewardsLoginButton
                    where="cart"
                    tap="join"
                    label="Join Fyxx Rewards"
                    variant="solid"
                    className="h-10 flex-1"
                  />
                )}
              </div>
              <p className="mx-auto mt-3 max-w-sm text-center text-[11px]" style={{ color: MUTED }}>
                Points land after your order. Some product categories don't earn points.
              </p>
              <ActivationNotice className="mt-3" />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
