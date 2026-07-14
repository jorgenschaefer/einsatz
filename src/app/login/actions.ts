"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setSessionCookie } from "@/server/auth/current-user";
import { attemptLogin, createSession } from "@/server/auth/login";
import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { getDb } from "@/server/db/pg";
import { clientIpFromForwardedFor } from "@/server/http/client-ip";
import type { LoginState } from "./LoginForm";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const ip = clientIpFromForwardedFor((await headers()).get("x-forwarded-for"));

  const db = getDb();
  const result = await attemptLogin(
    db,
    loginRateLimiter,
    ip,
    username,
    password,
  );
  if (result.status === "rate-limited") {
    return {
      error:
        "Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.",
    };
  }
  if (result.status === "invalid") {
    return {
      error: "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen.",
    };
  }

  const { token, expiresAt } = await createSession(db, result.user.id);
  await setSessionCookie(token, expiresAt);

  redirect("/operations");
}
