"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { createOperation } from "@/server/operations/create-operation";
import {
  formText,
  INVALID_FORM_DATA,
  ValidationError,
} from "@/server/validation";
import type { OperationFormState } from "./NewOperationForm";

export async function createOperationAction(
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  await requireUser();
  if (!(formData instanceof FormData)) return { error: INVALID_FORM_DATA };
  let operationId: string;
  try {
    const name = formText(formData, "name", "Die Bezeichnung");
    const description = formText(formData, "description", "Die Beschreibung");
    const operation = await createOperation(getDb(), { name, description });
    operationId = operation.id;
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }

  redirect(`/operations/${operationId}`);
}
