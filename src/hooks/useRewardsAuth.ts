// Tracks the signed-in Fyxx Rewards member (Supabase auth user). The session is
// persisted in the browser and refreshed by the Supabase client, so a member
// stays signed in across visits until they sign out. Used by the Log in button
// to greet a returning member and swap "Log in" for "Hi {name}".

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

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

  return {
    user,
    loading,
    firstName: firstNameOf(user),
    signedIn: !!user,
    signOut: () => supabase.auth.signOut(),
  };
}
