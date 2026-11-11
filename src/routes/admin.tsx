import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSignIn, adminSignOut, checkAdminAccess } from "@/lib/admin.functions";
import { CAMPAIGN_LABEL } from "@/lib/campaign-config";

// Layout for every /admin page: password gate, then tab nav + the page.
// The REAL lock is server-side (every admin server function checks the
// session); this gate just shows the right screen.
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin · ${CAMPAIGN_LABEL}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Sources" },
  { to: "/admin/activity", label: "Activity" },
  { to: "/admin/cohort", label: "Customers" },
  { to: "/admin/errors", label: "Errors" },
] as const;

function AdminLayout() {
  const checkFn = useServerFn(checkAdminAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => checkFn(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (!data?.isAdmin) return <SignIn />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
              Fyxx admin
            </p>
            <p className="font-display text-xl">{CAMPAIGN_LABEL}</p>
          </div>
          <nav className="flex flex-wrap gap-1 text-xs">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: true, includeSearch: false }}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{
                  className: "bg-primary text-primary-foreground hover:text-primary-foreground",
                }}
              >
                {t.label}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function SignIn() {
  const signInFn = useServerFn(adminSignIn);
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const { result } = await signInFn({ data: { password } });
      if (result === "ok") {
        await queryClient.invalidateQueries({ queryKey: ["admin-access"] });
      } else if (result === "not_configured") {
        setMessage(
          "Admin isn't set up yet: add an ADMIN_PASSWORD secret (8+ characters) in Lovable.",
        );
      } else {
        setMessage("Wrong password.");
      }
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6"
      >
        <div>
          <p className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
            Fyxx admin
          </p>
          <h1 className="font-display text-2xl">{CAMPAIGN_LABEL}</h1>
        </div>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Admin password"
          aria-label="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={pending || !password}>
          {pending ? "Checking…" : "Sign in"}
        </Button>
        {message && <p className="text-sm text-red-700">{message}</p>}
      </form>
    </div>
  );
}

function SignOutButton() {
  const signOutFn = useServerFn(adminSignOut);
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOutFn();
        queryClient.setQueryData(["admin-access"], { isAdmin: false });
        // Drop cached report data so the next person to sign in refetches it.
        queryClient.removeQueries({
          predicate: (q) =>
            q.queryKey[0] !== "admin-access" && String(q.queryKey[0]).startsWith("admin-"),
        });
      }}
      className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      Sign out
    </button>
  );
}
