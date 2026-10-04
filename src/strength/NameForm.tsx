"use client";

import { Button, Group, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { runAction } from "./run-action";

/** Name einer Stelle, zum Anlegen oder Umbenennen. */
export function NameForm({
  label,
  initial,
  submitLabel,
  onSubmit,
  onSaved,
  onCancel,
}: {
  label: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<ActionResult>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Am Feld statt oben im Bereich: auf dem Smartphone steht das Formular oft weit unten.
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await runAction(() => onSubmit(name), setError, onSaved);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Stack gap="xs">
        <TextInput
          label={label}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={error}
          errorProps={{ role: "alert" }}
          autoFocus
        />
        <Group gap="xs">
          <Button type="submit" size="xs" loading={busy}>
            {submitLabel}
          </Button>
          <Button size="xs" variant="subtle" onClick={onCancel}>
            Abbrechen
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
