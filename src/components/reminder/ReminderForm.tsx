import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { EMAIL_RE, hasReminder, submitReminder } from "@/lib/reminder";
import type { ReminderCopy } from "@/lib/teaser";
import { cn } from "@/lib/utils";

/**
 * One email field + button (texts from bf_settings.reminder). Hidden once this
 * browser has signed up, except for the thank-you right after submitting.
 */
export function ReminderForm({
  copy,
  source,
  showTitle = true,
  tone = "light",
}: {
  copy: ReminderCopy;
  source: "cart" | "hero";
  showTitle?: boolean;
  tone?: "light" | "dark";
}) {
  const [mounted, setMounted] = useState(false);
  const [already, setAlready] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    setMounted(true);
    setAlready(hasReminder());
    const on = () => setAlready(true);
    window.addEventListener("fyxx:reminder", on);
    return () => window.removeEventListener("fyxx:reminder", on);
  }, []);

  if (!mounted || !copy.enabled || !copy.list_id) return null;
  const dark = tone === "dark";

  if (status === "done") {
    return (
      <p
        role="status"
        className={cn("ff-subline text-sm", dark ? "text-ff-cream" : "text-ff-burgundy")}
      >
        {copy.thanks}
      </p>
    );
  }
  if (already) return null;

  const valid = EMAIL_RE.test(email.trim());
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || status === "sending") return;
        setStatus("sending");
        try {
          await submitReminder(email, copy.list_id!, source);
          setStatus("done");
        } catch {
          setStatus("error");
        }
      }}
    >
      {showTitle && copy.title && (
        <p className={cn("ff-subline mb-2 text-sm", dark ? "text-ff-cream" : "text-ff-black")}>
          {copy.title}
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-label="Email"
          placeholder={copy.placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className={cn(
            "ff-small h-11 min-w-0 flex-1 rounded-full border px-4 text-base",
            dark
              ? "border-ff-cream/40 bg-transparent text-ff-cream placeholder:text-ff-cream/60"
              : "border-ff-black/25 bg-ff-cream text-ff-black placeholder:text-ff-black/45",
          )}
        />
        <button
          type="submit"
          disabled={!valid || status === "sending"}
          className="ff-subline h-11 shrink-0 rounded-full bg-ff-red px-5 text-sm text-ff-cream disabled:opacity-50"
        >
          {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.button}
        </button>
      </div>
      {status === "error" && (
        <p role="alert" className="ff-small mt-2 text-xs text-ff-red">
          That didn't go through. Please check your email and try again.
        </p>
      )}
      {copy.consent && (
        <p
          className={cn(
            "ff-small mt-2 text-[11px]",
            dark ? "text-ff-cream/70" : "text-ff-black/60",
          )}
        >
          {copy.consent}
        </p>
      )}
    </form>
  );
}
