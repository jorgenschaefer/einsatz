"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { changePassword } from "@/server/auth/account-admin";
import {
  clearSessionCookie,
  currentSessionToken,
  requireUser,
  setSessionCookie,
} from "@/server/auth/current-user";
import { createSession } from "@/server/auth/login";
import { loginRateLimiter } from "@/server/auth/rate-limit-instance";
import { deleteSession } from "@/server/auth/sessions";
import { getDb } from "@/server/db/pg";
import { clientIpFromForwardedFor } from "@/server/http/client-ip";
import { ValidationError } from "@/server/validation";
import type { ChangePasswordState } from "./ChangePasswordForm";

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = clientIpFromForwardedFor((await headers()).get("x-forwarded-for"));
  try {
    await changePassword(
      getDb(),
      loginRateLimiter,
      ip,
      user.id,
      currentPassword,
      password,
    );
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
  // changePassword hat alle Sessions widerrufen – dieses Gerät neu anmelden.
  const { token, expiresAt } = await createSession(getDb(), user.id);
  await setSessionCookie(token, expiresAt);
  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const token = await currentSessionToken();
  if (token) await deleteSession(getDb(), token);
  await clearSessionCookie();
  redirect("/login");
}
