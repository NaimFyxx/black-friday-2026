// Browser entry: the same as TanStack Start's default, plus one thing. When
// React has to throw away the server HTML (hydration mismatch, React #418) it
// tells us which component it was in. That component stack is put at the top
// of the error's stack, so the /admin error log (bf_error_log) shows where the
// mismatch happened, not just "#418". Nothing else changes.
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

function onRecoverableError(error: unknown, info: { componentStack?: string | null }) {
  try {
    if (error instanceof Error && info.componentStack) {
      const where = info.componentStack.trim().split("\n").slice(0, 25).join("\n");
      error.stack = `Component stack:\n${where}\n---\n${error.stack ?? ""}`;
    }
  } catch {
    /* read-only stack: report as is */
  }
  // React's default: hand it to the browser's error reporting (the site's
  // error listener logs it).
  if (typeof reportError === "function") reportError(error);
  else console.error(error);
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    { onRecoverableError },
  );
});
