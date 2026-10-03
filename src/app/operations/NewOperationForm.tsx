"use client";

import {
  Alert,
  Button,
  Group,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useActionState, useState } from "react";

export interface OperationFormState {
  error?: string;
}

export type OperationFormAction = (
  prev: OperationFormState,
  formData: FormData,
) => Promise<OperationFormState>;

export function NewOperationForm({ action }: { action: OperationFormAction }) {
  const [state, formAction, pending] = useActionState(action, {});
  // Gesteuert, damit eine abgelehnte Eingabe nach dem Absenden stehen bleibt.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form action={formAction}>
      <Stack>
        {state.error && (
          <Alert color="red" role="alert">
            {state.error}
          </Alert>
        )}
        <TextInput
          name="name"
          label="Bezeichnung"
          required
          data-autofocus
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Textarea
          name="description"
          label="Beschreibung"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={pending}>
            Einsatz eröffnen
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
