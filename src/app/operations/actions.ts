"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { createOperation } from "@/server/operations/create-operation";
import { ValidationError } from "@/server/validation";
import type { OperationFormState } from "./NewOperationForm";

export async function createOperationAction(
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  await requireUser();
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");

  let operationId: string;
  try {
    const operation = await createOperation(getDb(), { name, description });
    operationId = operation.id;
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }

  redirect(`/operations/${operationId}`);
}
