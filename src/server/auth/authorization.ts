import type { User } from "./users";

export type AdminAccess = "login" | "operations" | "ok";

/**
 * Autorisierungsentscheid für die Nutzerverwaltung (rein, testbar):
 * nicht angemeldet → zur Anmeldung; angemeldet aber kein Admin → zur
 * Einsatzübersicht; Admin → Zugang.
 */
export function adminAccess(user: User | null): AdminAccess {
  if (!user) return "login";
  return user.role === "admin" ? "ok" : "operations";
}
