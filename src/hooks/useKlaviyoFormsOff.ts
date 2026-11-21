import { useEffect } from "react";

/**
 * Klaviyo signup forms (popups, slide-ins and teasers like "Early Access") are
 * switched off on this site: Spin & win is the only popup. The forms are hidden
 * by a CSS rule in src/styles.css; this hook makes sure a hidden Klaviyo popup
 * can never leave the page unable to scroll. Klaviyo tracking is not affected.
 * (Cleaner long term: exclude friday.myfyxx.com in the form's targeting in Klaviyo.)
 */
export function useKlaviyoFormsOff() {
  useEffect(() => {
    const unlock = () => {
      // Our own dialogs (cart, filters, Spin & win) lock scrolling on purpose.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      for (const el of [document.documentElement, document.body]) {
        if (el.style.overflow === "hidden") el.style.removeProperty("overflow");
        if (el.style.position === "fixed") el.style.removeProperty("position");
      }
    };
    const onKlaviyo = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "open" || type === "close") {
        unlock();
        setTimeout(unlock, 100);
        setTimeout(unlock, 600);
      }
    };
    window.addEventListener("klaviyoForms", onKlaviyo);
    return () => window.removeEventListener("klaviyoForms", onKlaviyo);
  }, []);
}
