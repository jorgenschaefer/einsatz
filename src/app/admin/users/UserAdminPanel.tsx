"use client";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";

export interface AccountSummary {
  id: string;
  username: string;
  role: "admin" | "user";
}

export interface UserAdminPanelProps {
  accounts: AccountSummary[];
  onCreate: (
    username: string,
    password: string,
    admin: boolean,
  ) => Promise<ActionResult>;
  onSetRole: (id: string, role: "admin" | "user") => Promise<ActionResult>;
  onResetPassword: (id: string, password: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}

export function UserAdminPanel({
  accounts,
  onCreate,
  onSetRole,
  onResetPassword,
  onDelete,
}: UserAdminPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");
  // Bleibt nach dem Schließen gesetzt, damit der Name beim Ausblenden
  // stehen bleibt.
  const [deleteTarget, setDeleteTarget] = useState<AccountSummary | null>(null);
  const [deleteAsked, setDeleteAsked] = useState(false);
  const [pending, setPending] = useState(false);

  const run = async (action: Promise<ActionResult>): Promise<ActionResult> => {
    setPending(true);
    try {
      const result = await action;
      setError(result.error ?? null);
      return result;
    } finally {
      setPending(false);
    }
  };

  const create = async () => {
    const result = await run(onCreate(username, password, admin));
    if (!result.error) {
      setUsername("");
      setPassword("");
      setAdmin(false);
    }
  };

  const submitReset = async (id: string) => {
    const result = await run(onResetPassword(id, resetValue));
    if (!result.error) {
      setResettingId(null);
      setResetValue("");
    }
  };

  return (
    <Stack>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <Paper withBorder p="md">
        <Stack>
          <Title order={4}>Konto anlegen</Title>
          <TextInput
            label="Nutzername"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Start-Passwort"
            description="Mindestens 12 Zeichen."
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />
          <Checkbox
            label="Administrator"
            checked={admin}
            onChange={(e) => setAdmin(e.currentTarget.checked)}
          />
          <Button onClick={create} w="fit-content" disabled={pending}>
            Konto anlegen
          </Button>
        </Stack>
      </Paper>

      <Stack gap="sm">
        {accounts.map((account) => (
          <Paper key={account.id} data-account withBorder p="sm">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" miw={0}>
                <Text fw={600} style={{ overflowWrap: "anywhere" }}>
                  {account.username}
                </Text>
                <Badge color={account.role === "admin" ? "drk" : "gray"}>
                  {account.role === "admin" ? "Admin" : "Nutzer"}
                </Badge>
              </Group>
              <Group gap="xs">
                {account.role === "user" ? (
                  <Button
                    size="xs"
                    variant="light"
                    disabled={pending}
                    onClick={() => run(onSetRole(account.id, "admin"))}
                  >
                    Zu Admin
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="light"
                    disabled={pending}
                    onClick={() => run(onSetRole(account.id, "user"))}
                  >
                    Zu Nutzer
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="light"
                  disabled={pending}
                  onClick={() => {
                    setResettingId(account.id);
                    setResetValue("");
                  }}
                >
                  Passwort zurücksetzen
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setDeleteTarget(account);
                    setDeleteAsked(true);
                  }}
                >
                  Löschen
                </Button>
              </Group>
            </Group>
            {resettingId === account.id && (
              <Group mt="xs" gap="xs">
                <PasswordInput
                  aria-label="Neues Passwort"
                  value={resetValue}
                  onChange={(e) => setResetValue(e.currentTarget.value)}
                />
                <Button
                  size="xs"
                  disabled={pending}
                  onClick={() => submitReset(account.id)}
                >
                  Setzen
                </Button>
              </Group>
            )}
          </Paper>
        ))}
      </Stack>

      <ConfirmationModal
        opened={deleteAsked}
        onClose={() => setDeleteAsked(false)}
        title="Konto löschen"
        confirmLabel="Endgültig löschen"
        onConfirm={async () => (deleteTarget ? onDelete(deleteTarget.id) : {})}
      >
        <Text style={{ overflowWrap: "anywhere" }}>
          Das Konto <strong>{deleteTarget?.username}</strong> wird
          unwiderruflich gelöscht.
        </Text>
      </ConfirmationModal>
    </Stack>
  );
}
