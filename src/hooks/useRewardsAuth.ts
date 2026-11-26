// Tracks the signed-in Fyxx Rewards member (Supabase auth user). The session is
// persisted in the browser and refreshed by the Supabase client, so a member
// stays signed in across visits until they sign out. Also reports whether their
// Shopify account is activated (password set), so the UI can nudge them to
// finish, and exposes a resend for the activation email.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { lookupEmail, resendInvite } from "@/lib/rewards-auth";

function firstNameOf(user: User | null): string | null {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const first = typeof m["first_name"] === "string" ? m["first_name"].trim() : "";
  if (first) return first;
  const full = typeof m["full_name"] === "string" ? m["full_name"].trim() : "";
  if (full) return full.split(/\s+/)[0] ?? null;
  return null;
}

export function useRewardsAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // null = not yet known; true/false once the Shopify account state is read.
  const [activated, setActivated] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Once signed in, read whether their Shopify account is activated.
  const email = user?.email ?? null;
  useEffect(() => {
    let mounted = true;
    if (!email) {
      setActivated(null);
      return;
    }
    lookupEmail(email)
      .then((r) => {
        if (mounted) setActivated(r.activated);
      })
      .catch(() => {
        if (mounted) setActivated(null);
      });
    return () => {
      mounted = false;
    };
  }, [email]);

  return {
    user,
    loading,
    firstName: firstNameOf(user),
    signedIn: !!user,
    activated,
    resendActivation: () => (email ? resendInvite(email) : Promise.resolve({ ok: false })),
    signOut: () => supabase.auth.signOut(),
  };
}
