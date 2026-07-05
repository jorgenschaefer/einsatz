"use client";

import {
  Alert,
  Button,
  Group,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useActionState } from "react";

export interface OperationFormState {
  error?: string;
}

export type OperationFormAction = (
  prev: OperationFormState,
  formData: FormData,
) => Promise<OperationFormState>;

export function NewOperationForm({ action }: { action: OperationFormAction }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <Stack>
        {state.error && (
          <Alert color="red" role="alert">
            {state.error}
          </Alert>
        )}
        <TextInput name="name" label="Bezeichnung" required data-autofocus />
        <Textarea name="description" label="Beschreibung" />
        <Group justify="flex-end">
          <Button type="submit" loading={pending}>
            Einsatz eröffnen
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
