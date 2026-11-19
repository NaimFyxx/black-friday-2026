import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/** Appears after scrolling down a while; jumps back to the top. */
export function BackToTop({ raised }: { raised: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setShow(window.scrollY > 1200);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0 })}
      className={cn(
        "fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-ff-red bg-ff-cream text-ff-red shadow-md md:right-6",
        raised ? "bottom-24" : "bottom-4",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
