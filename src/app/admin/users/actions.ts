"use server";

import { revalidatePath } from "next/cache";
import {
  createAccount,
  deleteAccount,
  resetPassword,
  setRole,
} from "@/server/auth/account-admin";
import { requireAdmin } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { ValidationError } from "@/server/validation";

interface Result {
  error?: string;
}

const ADMIN_USERS_PATH = "/admin/users";

async function guarded(fn: () => Promise<unknown>): Promise<Result> {
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
): Promise<Result> {
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
): Promise<Result> {
  return guarded(() => setRole(getDb(), id, role));
}

export async function resetPasswordAction(
  id: string,
  password: string,
): Promise<Result> {
  return guarded(() => resetPassword(getDb(), id, password));
}

export async function deleteAccountAction(id: string): Promise<Result> {
  return guarded(() => deleteAccount(getDb(), id));
}
