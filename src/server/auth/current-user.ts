import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/pg";
import { adminAccess } from "./authorization";
import { findUserBySessionToken } from "./sessions";
import type { AuthenticatedUser } from "./users";

export const SESSION_COOKIE = "einsatz_session";

/** Setzt das Session-Cookie mit den festen Sicherheitsflags. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

/** Entfernt das Session-Cookie (Abmelden). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Der aktuell angemeldete Nutzer anhand des Session-Cookies, oder null. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySessionToken(getDb(), token);
}

/** Wie {@link getCurrentUser}, leitet aber unangemeldete Zugriffe auf /login um. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Erzwingt Admin-Rechte; Nicht-Admins werden auf die Einsatzübersicht umgeleitet. */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  const access = adminAccess(user);
  if (access === "login") redirect("/login");
  if (access === "operations") redirect("/operations");
  if (!user) redirect("/login"); // bei access === "ok" bereits gegeben; macht den Typ non-null
  return user;
}
