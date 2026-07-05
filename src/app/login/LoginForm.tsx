"use client";

import {
  Alert,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useActionState } from "react";

export interface LoginState {
  error?: string;
}

export type LoginAction = (
  prev: LoginState,
  formData: FormData,
) => Promise<LoginState>;

export function LoginForm({ action }: { action: LoginAction }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Paper
      component="form"
      action={formAction}
      withBorder
      shadow="sm"
      p="lg"
      maw={360}
      mx="auto"
      mt="xl"
    >
      <Stack>
        <Title order={2}>Anmelden</Title>
        {state.error && (
          <Alert color="red" role="alert">
            {state.error}
          </Alert>
        )}
        <TextInput
          name="username"
          label="Nutzername"
          autoComplete="username"
          required
        />
        <PasswordInput
          name="password"
          label="Passwort"
          autoComplete="current-password"
          required
        />
        <Button type="submit" loading={pending} fullWidth>
          Anmelden
        </Button>
        <Text size="xs" c="dimmed">
          Du bleibst rund 30 Tage angemeldet.
        </Text>
      </Stack>
    </Paper>
  );
}
