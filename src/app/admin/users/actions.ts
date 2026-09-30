"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/action-result";
import {
  createAccount,
  deleteAccount,
  resetPassword,
  setRole,
} from "@/server/auth/account-admin";
import { requireAdmin } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { ValidationError } from "@/server/validation";

const ADMIN_USERS_PATH = "/admin/users";

async function guarded(fn: () => Promise<unknown>): Promise<ActionResult> {
  await requireAdmin();
  try {
    await fn();
    revalidatePath(ADMIN_USERS_PATH);
    return {};
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

export async function createAccountAction(
  username: string,
  password: string,
  admin: boolean,
): Promise<ActionResult> {
  return guarded(() =>
    createAccount(getDb(), {
      username,
      password,
      role: admin ? "admin" : "user",
    }),
  );
}

export async function setRoleAction(
  id: string,
  role: "admin" | "user",
): Promise<ActionResult> {
  return guarded(() => setRole(getDb(), id, role));
}

export async function resetPasswordAction(
  id: string,
  password: string,
): Promise<ActionResult> {
  return guarded(() => resetPassword(getDb(), id, password));
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  return guarded(() => deleteAccount(getDb(), id));
}
