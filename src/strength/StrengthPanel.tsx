"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useState } from "react";
import type { ActionResult } from "@/app/operations/[id]/action-result";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

export interface StationView {
  id: string;
  name: string;
}

export interface StrengthPanelProps {
  stations: StationView[];
  onCreateStation: (name: string) => Promise<ActionResult>;
  onRenameStation: (id: string, name: string) => Promise<ActionResult>;
}

export function StrengthPanel({
  stations,
  onCreateStation,
  onRenameStation,
}: StrengthPanelProps) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Führt die Action aus; nur bei Erfolg wird `done` aufgerufen. */
  const save = async (
    action: () => Promise<ActionResult>,
    done: () => void,
  ) => {
    try {
      const { error: err } = await action();
      setError(err ?? null);
      if (!err) done();
    } catch {
      setError(SAVE_ERROR);
    }
  };

  const closeForms = () => {
    setCreating(false);
    setRenamingId(null);
    setError(null);
  };

  return (
    <Stack>
      {error && (
        <Alert
          color="red"
          role="alert"
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      )}

      {stations.map((station) => (
        <Paper key={station.id} data-station withBorder p="sm">
          {renamingId === station.id ? (
            <NameForm
              label="Neuer Name"
              initial={station.name}
              submitLabel="Speichern"
              onSubmit={(name) =>
                save(() => onRenameStation(station.id, name), closeForms)
              }
              onCancel={closeForms}
            />
          ) : (
            <Group justify="space-between" wrap="nowrap">
              <Title order={3} size="h5">
                {station.name}
              </Title>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`${station.name} umbenennen`}
                onClick={() => {
                  closeForms();
                  setRenamingId(station.id);
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Group>
          )}
        </Paper>
      ))}

      {creating ? (
        <Paper withBorder p="sm">
          <NameForm
            label="Name der Stelle"
            initial=""
            submitLabel="Anlegen"
            onSubmit={(name) => save(() => onCreateStation(name), closeForms)}
            onCancel={closeForms}
          />
        </Paper>
      ) : (
        <Button
          variant="default"
          w="fit-content"
          onClick={() => {
            closeForms();
            setCreating(true);
          }}
        >
          + Stelle
        </Button>
      )}
    </Stack>
  );
}

function NameForm({
  label,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(name);
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
