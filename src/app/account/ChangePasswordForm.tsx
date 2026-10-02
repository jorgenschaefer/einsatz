"use client";

import { Alert, Button, PasswordInput, Stack } from "@mantine/core";
import { useActionState } from "react";

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

export type ChangePasswordAction = (
  prev: ChangePasswordState,
  formData: FormData,
) => Promise<ChangePasswordState>;

export function ChangePasswordForm({
  action,
}: {
  action: ChangePasswordAction;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <Stack maw={360}>
        {state.error && (
          <Alert color="red" role="alert">
            {state.error}
          </Alert>
        )}
        {state.success && (
          <Alert color="green">Dein Passwort wurde geändert.</Alert>
        )}
        <PasswordInput
          name="currentPassword"
          label="Aktuelles Passwort"
          autoComplete="current-password"
          required
        />
        <PasswordInput
          name="password"
          label="Neues Passwort"
          description="12 Zeichen bis 72 Byte, nicht der Nutzername, kein verbreitetes Passwort."
          autoComplete="new-password"
          required
        />
        <Button type="submit" loading={pending} w="fit-content">
          Passwort ändern
        </Button>
      </Stack>
    </form>
  );
}
