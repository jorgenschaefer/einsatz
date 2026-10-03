import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/pg";
import { findUserBySessionToken, recordSessionUse } from "./sessions";
import type { AuthenticatedUser } from "./users";

/** Setzt das Session-Cookie mit den festen Sicherheitsflags. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const { name, attributes } = sessionCookie();
  (await cookies()).set(name, token, { ...attributes, expires: expiresAt });
}

/** Entfernt das Session-Cookie (Abmelden). */
export async function clearSessionCookie(): Promise<void> {
  // Ohne dieselben Flags verwirft der Browser das Löschen eines __Host-Cookies.
  const { name, attributes } = sessionCookie();
  (await cookies()).delete({ name, ...attributes });
}

/** Der Token aus dem Session-Cookie dieses Browsers, falls gesetzt. */
export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookie().name)?.value;
}

/**
 * `__Host-` verlangt `Secure`, das es nur in Produktion (HTTPS) gibt; Name und
 * Flag hängen deshalb an derselben Entscheidung.
 */
function sessionCookie() {
  const secure = process.env.NODE_ENV === "production";
  return {
    name: secure ? "__Host-einsatz_session" : "einsatz_session",
    attributes: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
    } as const,
  };
}

/**
 * Der aktuell angemeldete Nutzer anhand des Session-Cookies, oder null. War
 * die Anfrage eine Nutzung, verlängert sie die Sitzung; `recordUse: true` sagt
 * das für Anfragen, denen man es an den Headern nicht ansieht (Uploads per
 * `fetch`).
 */
export async function getCurrentUser(options?: {
  recordUse?: boolean;
}): Promise<AuthenticatedUser | null> {
  const token = await currentSessionToken();
  if (!token) return null;
  const db = getDb();
  const user = await findUserBySessionToken(db, token);
  if (user && (options?.recordUse || isUserActivity(await headers()))) {
    await recordSessionUse(db, token);
  }
  return user;
}

/**
 * Was der Nutzer selbst tut: eine Server Action, oder eine Seite, die der
 * Browser als Dokument lädt (aufgerufen oder neu geladen). Das automatische
 * Neuladen nach Änderungen, Link-Klicks innerhalb der App (beides RSC-Abrufe),
 * die Live-Verbindung und Bilder zählen nicht.
 */
function isUserActivity(requestHeaders: Headers): boolean {
  return (
    requestHeaders.has("next-action") ||
    requestHeaders.get("sec-fetch-mode") === "navigate"
  );
}

/** Wie {@link getCurrentUser}, leitet aber unangemeldete Zugriffe auf /login um. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Erzwingt Admin-Rechte; Nicht-Admins werden auf die Einsatzübersicht umgeleitet. */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/operations");
  return user;
}
