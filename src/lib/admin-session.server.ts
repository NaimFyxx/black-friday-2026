// Server-only admin lock for the /admin dashboards.
//
// One shared password: the BLACK_FRIDAY_ADMIN_PASSWORD secret in the Supabase
// project. This site can't read Supabase secrets, so the `bf-admin` edge
// function checks the password for us (see bf-edge.server.ts).
// A correct password gets an encrypted, HttpOnly session cookie for 400 days,
// renewed on every /admin visit, keyed by bf_settings.admin_session_secret (change that value to sign
// everyone out).
// FAIL CLOSED: if the password secret is unset/short, or anything can't be
// reached, nobody can sign in.

// `useSession` is a server cookie-session helper, not a React hook.
import { useSession as openSession } from "@tanstack/react-start/server";

import { callBfAdmin, getBfSetting } from "./bf-edge.server";

type AdminSession = { admin?: boolean };

async function sessionConfig() {
  const secret = await getBfSetting("admin_session_secret");
  if (!secret || secret.length < 32) throw new Error("admin_session_secret missing");
  return {
    name: "bf_admin",
    password: secret,
    // 400 days: the longest a browser keeps a cookie. Renewed on every /admin
    // visit (isAdminAndRenew), so in practice you stay signed in.
    maxAge: 60 * 60 * 24 * 400,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

/** Checks the password and, if right, starts an admin session. */
export async function signIn(attempt: string): Promise<"ok" | "wrong" | "not_configured"> {
  const check = await callBfAdmin<{ configured: boolean; ok: boolean }>({
    action: "check_password",
    password: attempt,
  });
  if (!check.configured) return "not_configured";
  if (!check.ok) return "wrong"; // the edge function already slows down guesses
  const session = await openSession<AdminSession>(await sessionConfig());
  await session.update({ admin: true });
  return "ok";
}

export async function signOut(): Promise<void> {
  const session = await openSession<AdminSession>(await sessionConfig());
  await session.clear();
}

export async function isAdmin(): Promise<boolean> {
  try {
    const session = await openSession<AdminSession>(await sessionConfig());
    return session.data.admin === true;
  } catch {
    return false;
  }
}

/** Like isAdmin, but also restarts the 400-day clock, so anyone who opens
 *  /admin at least once a year stays signed in. Called when /admin loads. */
export async function isAdminAndRenew(): Promise<boolean> {
  try {
    const session = await openSession<AdminSession>(await sessionConfig());
    if (session.data.admin !== true) return false;
    await session.update({ admin: true });
    return true;
  } catch {
    return false;
  }
}

/** Call FIRST in every admin server function: hiding the UI is not a lock. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorized");
}
