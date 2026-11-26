import { useEffect, useRef } from "react";
import { Toaster as Sonner, toast, useSonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Sonner's default time on screen, when a toast sets none. */
const DEFAULT_MS = 4000;

/**
 * Sonner pauses a toast's countdown while a pointer is over it. On phones a tap
 * near the top of the screen (the header and cart button sit under the toasts)
 * can leave the toast "hovered" for good, so "Added to cart" never went away.
 * This closes every toast shortly after its own duration, hovered or not.
 */
function AutoClose() {
  const { toasts } = useSonner();
  const timers = useRef(new Map<string | number, number>());

  useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    for (const t of toasts) {
      if (timers.current.has(t.id)) continue;
      const ms = typeof t.duration === "number" ? t.duration : DEFAULT_MS;
      if (!Number.isFinite(ms)) continue;
      timers.current.set(
        t.id,
        window.setTimeout(() => {
          toast.dismiss(t.id);
          timers.current.delete(t.id);
        }, ms + 800),
      );
    }
    // Forget toasts that are already gone.
    for (const [id, timer] of timers.current) {
      if (!live.has(id)) {
        window.clearTimeout(timer);
        timers.current.delete(id);
      }
    }
  }, [toasts]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) window.clearTimeout(timer);
      map.clear();
    };
  }, []);

  return null;
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
      <Sonner
        className="toaster group"
        closeButton
        toastOptions={{
          duration: DEFAULT_MS,
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
      <AutoClose />
    </>
  );
};

export { Toaster };
