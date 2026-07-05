"use client";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useState } from "react";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

export interface JournalRevisionView {
  text: string;
  author: string | null;
  createdAt: string;
}

export interface JournalEntryView {
  id: string;
  number: number;
  createdAt: string;
  text: string;
  type: "manuell" | "einsatz-eröffnet" | "einsatz-geschlossen";
  state: "gueltig" | "annulliert";
  author: string | null;
  editedAt: string | null;
  revisions: JournalRevisionView[];
}

export interface JournalPanelProps {
  entries: JournalEntryView[];
  onAdd: (text: string) => void | Promise<void>;
  onCorrect: (id: string, text: string) => void | Promise<void>;
  onAnnul: (id: string) => void | Promise<void>;
}

const berlinTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));

export function JournalPanel({
  entries,
  onAdd,
  onCorrect,
  onAnnul,
}: JournalPanelProps) {
  const [hideAuto, setHideAuto] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visible = hideAuto
    ? entries.filter((e) => e.type === "manuell")
    : entries;

  const submitNew = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await onAdd(text);
      setDraft("");
      setError(null);
    } catch {
      setError(SAVE_ERROR);
    }
  };

  const submitEdit = async () => {
    const text = editText.trim();
    if (!text || editingId === null) return;
    try {
      await onCorrect(editingId, text);
      setEditingId(null);
      setError(null);
    } catch {
      setError(SAVE_ERROR);
    }
  };

  const onDraftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submitNew();
    }
  };

  const onEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submitEdit();
    }
  };

  const annul = async (id: string) => {
    try {
      await onAnnul(id);
      setError(null);
    } catch {
      setError(SAVE_ERROR);
    }
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
      <Checkbox
        label="Automatische ausblenden"
        checked={hideAuto}
        onChange={(e) => setHideAuto(e.currentTarget.checked)}
      />

      <Stack gap="sm">
        {visible.map((entry) => {
          const isAuto = entry.type !== "manuell";
          const canEdit = !isAuto && entry.state === "gueltig";
          return (
            <Paper key={entry.id} data-entry withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <Text fw={700}>#{entry.number}</Text>
                  <Text size="xs" c="dimmed">
                    {berlinTime(entry.createdAt)}
                  </Text>
                  {isAuto && (
                    <Badge size="xs" variant="light" color="gray">
                      automatisch
                    </Badge>
                  )}
                </Group>
                {entry.author && (
                  <Text size="xs" c="dimmed">
                    {entry.author}
                  </Text>
                )}
              </Group>

              {entry.revisions.map((rev) => (
                <Text
                  key={`${entry.id}-${rev.createdAt}`}
                  size="sm"
                  c="dimmed"
                  mt={4}
                >
                  <del>{rev.text}</del>
                  {rev.author &&
                    ` – ${rev.author}, ${berlinTime(rev.createdAt)}`}
                </Text>
              ))}

              {entry.state === "annulliert" ? (
                <Text mt={4}>
                  <del>{entry.text}</del>
                </Text>
              ) : (
                <Text mt={4}>{entry.text}</Text>
              )}

              {entry.state === "gueltig" && entry.editedAt && (
                <Text size="xs" c="dimmed">
                  korrigiert {berlinTime(entry.editedAt)}
                </Text>
              )}

              {canEdit && editingId !== entry.id && (
                <Group mt="xs" gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditText(entry.text);
                    }}
                  >
                    Korrigieren
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => annul(entry.id)}
                  >
                    Annullieren
                  </Button>
                </Group>
              )}

              {editingId === entry.id && (
                <Stack mt="xs" gap="xs">
                  <Textarea
                    aria-label="Korrektur"
                    value={editText}
                    onChange={(e) => setEditText(e.currentTarget.value)}
                    onKeyDown={onEditKeyDown}
                  />
                  <Group gap="xs">
                    <Button size="xs" onClick={submitEdit}>
                      Speichern
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => setEditingId(null)}
                    >
                      Abbrechen
                    </Button>
                  </Group>
                </Stack>
              )}
            </Paper>
          );
        })}
      </Stack>

      <Stack gap="xs">
        <Textarea
          aria-label="Neuer Eintrag"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={onDraftKeyDown}
          placeholder="Ereignis festhalten …"
        />
        <Button onClick={submitNew} w="fit-content">
          Eintrag hinzufügen
        </Button>
      </Stack>
    </Stack>
  );
}
