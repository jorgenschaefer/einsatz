import { redirect } from "next/navigation";

/**
 * Der Fehler, mit dem eine Server-Action auf dem Client ablehnt, wenn sie
 * `redirect` ruft – etwa zur Anmeldung bei abgelaufener Sitzung.
 */
export function redirectError(): unknown {
  try {
    redirect("/login");
  } catch (error) {
    return error;
  }
}
