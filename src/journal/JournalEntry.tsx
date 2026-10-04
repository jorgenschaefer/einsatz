"use client";

import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Paper,
  Text,
} from "@mantine/core";
import type { ReactNode } from "react";
import { EntryRouteHeader } from "@/journal/EntryRouteHeader";
import type { EntryRoute } from "@/journal/entry-route";
import {
  canAnnulEntry,
  canCorrectEntry,
  isAutomaticEntry,
  type JournalEntryType,
} from "@/journal/entry-type";
import type { JournalEntryState } from "@/server/journal/journal";

interface JournalRevisionView extends EntryRoute {
  text: string;
  author: string | null;
  createdAt: string;
}

export interface JournalEntryView extends EntryRoute {
  id: string;
  number: number;
  createdAt: string;
  text: string;
  type: JournalEntryType;
  state: JournalEntryState;
  author: string | null;
  editedAt: string | null;
  revisions: JournalRevisionView[];
}

/** Ein Eintrag im ETB samt seinen früheren Fassungen und seinem Menü. */
export function JournalEntry({
  entry,
  onOpenCorrection,
  onOpenAnnulConfirmation,
  correction,
}: {
  entry: JournalEntryView;
  onOpenCorrection: () => void;
  onOpenAnnulConfirmation: () => void;
  /** Die offene Korrektur des Eintrags; solange sie offen ist, fehlt sein Menü. */
  correction?: ReactNode;
}) {
  const isAuto = isAutomaticEntry(entry.type);
  const isValid = entry.state === "gueltig";
  const canCorrect = isValid && canCorrectEntry(entry.type);
  const canAnnul = isValid && canAnnulEntry(entry.type);
  return (
    <Paper data-entry withBorder p="sm">
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
        <Group gap="xs" wrap="nowrap">
          {entry.author && (
            <Text size="xs" c="dimmed">
              {entry.author}
            </Text>
          )}
          {canAnnul && !correction && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Aktionen für Eintrag #${entry.number}`}
                >
                  ⋯
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canCorrect && (
                  <Menu.Item onClick={onOpenCorrection}>Korrigieren</Menu.Item>
                )}
                <Menu.Item color="red" onClick={onOpenAnnulConfirmation}>
                  Annullieren …
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      {entry.revisions.map((rev, index) => (
        // Revisionen tragen weder id noch seq und werden nur angehängt
        // (nie umsortiert/entfernt); der Index innerhalb des Eintrags ist
        // daher ein stabiler, kollisionsfreier Key – anders als der
        // Zeitstempel, den zwei Fassungen teilen können.
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only, stable index
        <Box key={`${entry.id}-${index}`} c="dimmed">
          <EntryRouteHeader route={rev} struck />
          <Text size="sm" mt={4}>
            <del>{rev.text}</del>
            {rev.author && ` – ${rev.author}, ${berlinTime(rev.createdAt)}`}
          </Text>
        </Box>
      ))}

      <EntryRouteHeader route={entry} struck={entry.state === "annulliert"} />
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

      {correction && <Box mt="xs">{correction}</Box>}
    </Paper>
  );
}

const berlinTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
