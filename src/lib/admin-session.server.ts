// Server-only admin lock for the /admin dashboards.
//
// One shared password, set as the BLACK_FRIDAY_ADMIN_PASSWORD secret in Lovable. A correct
// password gets an encrypted, HttpOnly session cookie for 30 days. Changing the
// secret signs everyone out (the cookie key is derived from it).
// FAIL CLOSED: if BLACK_FRIDAY_ADMIN_PASSWORD is unset or shorter than 8 characters, nobody
// can sign in.

import { createHash, timingSafeEqual } from "node:crypto";
// `useSession` is a server cookie-session helper, not a React hook.
import { useSession as openSession } from "@tanstack/react-start/server";

type AdminSession = { admin?: boolean };

function adminPassword(): string | null {
  const p = process.env["BLACK_FRIDAY_ADMIN_PASSWORD"] ?? "";
  return p.length >= 8 ? p : null;
}

function sessionConfig(password: string) {
  return {
    name: "bf_admin",
    // 64 hex chars, derived so there is only one secret to manage.
    password: createHash("sha256").update(`bf-admin-session:${password}`).digest("hex"),
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function sameString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Checks the password and, if right, starts an admin session. */
export async function signIn(attempt: string): Promise<"ok" | "wrong" | "not_configured"> {
  const password = adminPassword();
  if (!password) return "not_configured";
  if (!sameString(attempt, password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    return "wrong";
  }
  const session = await openSession<AdminSession>(sessionConfig(password));
  await session.update({ admin: true });
  return "ok";
}

export async function signOut(): Promise<void> {
  const password = adminPassword();
  if (!password) return;
  const session = await openSession<AdminSession>(sessionConfig(password));
  await session.clear();
}

export async function isAdmin(): Promise<boolean> {
  const password = adminPassword();
  if (!password) return false;
  try {
    const session = await openSession<AdminSession>(sessionConfig(password));
    return session.data.admin === true;
  } catch {
    return false;
  }
}

/** Call FIRST in every admin server function: hiding the UI is not a lock. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorized");
}
