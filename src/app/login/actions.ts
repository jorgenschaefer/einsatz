"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  currentSessionToken,
  setSessionCookie,
} from "@/server/auth/current-user";
import { attemptLogin, createSession } from "@/server/auth/login";
import { RATE_LIMITED_MESSAGE } from "@/server/auth/rate-limit";
import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { deleteSession } from "@/server/auth/sessions";
import { getDb } from "@/server/db/pg";
import { clientIpFromForwardedFor } from "@/server/http/client-ip";
import {
  formText,
  INVALID_FORM_DATA,
  ValidationError,
} from "@/server/validation";
import type { LoginState } from "./LoginForm";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!(formData instanceof FormData)) return { error: INVALID_FORM_DATA };
  let username: string;
  let password: string;
  try {
    username = formText(formData, "username", "Der Nutzername").trim();
    password = formText(formData, "password", "Das Passwort");
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }

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
    return { error: RATE_LIMITED_MESSAGE };
  }
  if (result.status === "invalid") {
    return {
      error: "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen.",
    };
  }

  const previousToken = await currentSessionToken();
  if (previousToken) await deleteSession(db, previousToken);
  const { token, expiresAt } = await createSession(db, result.user.id);
  await setSessionCookie(token, expiresAt);

  redirect("/operations");
}
