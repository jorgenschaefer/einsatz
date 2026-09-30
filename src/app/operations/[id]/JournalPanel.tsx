"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Checkbox,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type Ref, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import { EntryForm } from "@/journal/EntryForm";
import { DEFAULT_CHANNEL } from "@/journal/EntryRouteFields";
import {
  type EntryContent,
  type EntryRoute,
  formatEntryRoute,
  NO_ROUTE,
} from "@/journal/entry-route";
import type {
  JournalEntryState,
  JournalEntryType,
} from "@/server/journal/journal";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

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

export interface JournalPanelProps {
  entries: JournalEntryView[];
  /** Die Werte für Von und An eines neuen Eintrags und einer Korrektur. */
  correspondents: string[];
  onAdd: (entry: EntryContent) => Promise<ActionResult>;
  onCorrect: (id: string, content: EntryContent) => Promise<ActionResult>;
  onAnnul: (id: string) => Promise<ActionResult>;
  newEntryRef?: Ref<HTMLTextAreaElement>;
  /** Wird das ETB sichtbar, zeigt es den letzten Eintrag. */
  visible: boolean;
}

const berlinTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));

const NEW_ENTRY: EntryContent = {
  text: "",
  ...NO_ROUTE,
  channel: DEFAULT_CHANNEL,
};

const isAutomatic = (entry: JournalEntryView) =>
  entry.type === "einsatz-eröffnet" ||
  entry.type === "einsatz-geschlossen" ||
  entry.type === "stelle-angelegt";

export function JournalPanel({
  entries,
  correspondents,
  onAdd,
  onCorrect,
  onAnnul,
  newEntryRef,
  visible,
}: JournalPanelProps) {
  const [hideAuto, setHideAuto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [annulTarget, setAnnulTarget] = useState<JournalEntryView | null>(null);
  const [annulConfirmationOpen, annulConfirmation] = useDisclosure(false);
  const [error, setError] = useState<string | null>(null);

  const shown = hideAuto ? entries.filter((e) => !isAutomatic(e)) : entries;
  const scroll = useScrollToEnd(visible, entries.at(-1)?.id);

  const addEntry = async (content: EntryContent) => {
    try {
      const { error: err } = await onAdd(content);
      if (err) {
        setError(err);
        return false;
      }
      setError(null);
      scroll.scrollToEnd();
      return true;
    } catch {
      setError(SAVE_ERROR);
      return false;
    }
  };

  const correctEditedEntry = async (content: EntryContent) => {
    if (editingId === null) return false;
    try {
      const { error: err } = await onCorrect(editingId, content);
      if (err) {
        setError(err);
        return false;
      }
      setEditingId(null);
      setError(null);
      return true;
    } catch {
      setError(SAVE_ERROR);
      return false;
    }
  };

  const openAnnulConfirmation = (entry: JournalEntryView) => {
    setAnnulTarget(entry);
    annulConfirmation.open();
  };

  // Die journal-*-Klassen tragen das Desktop-Layout der Seitenleiste
  // (situation-workspace.css): nur die Liste scrollt, das Feld steht fest.
  return (
    // Lange Wörter umbrechen statt waagerecht zu scrollen (360 px).
    <Stack className="journal-panel" style={{ overflowWrap: "break-word" }}>
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

      <Stack gap="sm" className="journal-entries">
        {shown.map((entry) => {
          const isAuto = isAutomatic(entry);
          const isValid = entry.state === "gueltig";
          const canCorrect = isValid && entry.type === "manuell";
          const canAnnul =
            isValid &&
            (entry.type === "manuell" ||
              entry.type === "gesamtstärke-gemeldet");
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
                <Group gap="xs" wrap="nowrap">
                  {entry.author && (
                    <Text size="xs" c="dimmed">
                      {entry.author}
                    </Text>
                  )}
                  {canAnnul && editingId !== entry.id && (
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
                          <Menu.Item onClick={() => setEditingId(entry.id)}>
                            Korrigieren
                          </Menu.Item>
                        )}
                        <Menu.Item
                          color="red"
                          onClick={() => openAnnulConfirmation(entry)}
                        >
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
                    {rev.author &&
                      ` – ${rev.author}, ${berlinTime(rev.createdAt)}`}
                  </Text>
                </Box>
              ))}

              <EntryRouteHeader
                route={entry}
                struck={entry.state === "annulliert"}
              />
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

              {editingId === entry.id && (
                <Box mt="xs">
                  <EntryForm
                    label="Korrektur"
                    initial={entry}
                    pinned
                    compact
                    correspondents={correspondents}
                    submitLabel="Speichern"
                    onSubmit={correctEditedEntry}
                    onCancel={() => setEditingId(null)}
                  />
                </Box>
              )}
            </Paper>
          );
        })}
        {/* Deckt die letzten 8 px der Liste ab: Am Ende gescrollt fehlen dem
            Rand sonst Bruchteile eines Pixels, und es gilt nicht als „am Ende".
            Ohne flexShrink schrumpft er in der scrollenden Liste (Desktop) auf 0. */}
        <div
          ref={scroll.endRef}
          style={{ height: 8, marginTop: -8, flexShrink: 0 }}
        />
      </Stack>

      <div className="journal-new-entry" ref={scroll.newEntryRef}>
        <EntryForm
          label="Neuer Eintrag"
          placeholder="Ereignis festhalten …"
          textRef={newEntryRef}
          initial={NEW_ENTRY}
          correspondents={correspondents}
          submitLabel="Eintrag hinzufügen"
          onSubmit={addEntry}
        />
      </div>

      {annulTarget && (
        <ConfirmationModal
          opened={annulConfirmationOpen}
          onClose={annulConfirmation.close}
          title={`Eintrag #${annulTarget.number} annullieren`}
          confirmLabel="Annullieren"
          onConfirm={() => onAnnul(annulTarget.id)}
        >
          <Text>
            Der Eintrag bleibt durchgestrichen im Einsatztagebuch stehen. Das
            lässt sich nicht rückgängig machen.
          </Text>
        </ConfirmationModal>
      )}
    </Stack>
  );
}

/**
 * „Von X an Y" fett, der Weg gedimmt dahinter; nichts ohne alle drei Angaben.
 * Durchgestrichen bei früheren Fassungen und annullierten Einträgen.
 */
function EntryRouteHeader({
  route,
  struck = false,
}: {
  route: EntryRoute;
  struck?: boolean;
}) {
  const header = formatEntryRoute(route);
  if (!header) return null;
  const { parties, channel } = header;
  const content = (
    <>
      {parties}
      {channel && (
        <Text span inherit fw={400} c="dimmed">
          {parties ? ` · ${channel}` : channel}
        </Text>
      )}
    </>
  );
  return (
    <Text size="sm" fw={600} mt={4}>
      {struck ? <del>{content}</del> : content}
    </Text>
  );
}

/**
 * Hält das ETB am letzten Eintrag wie einen Chat: beim Sichtbarwerden, nach
 * `scrollToEnd` und bei einem neuen Eintrag, solange das Listenende zu sehen
 * war. Wer hochgescrollt hat, bleibt, wo er ist.
 */
function useScrollToEnd(visible: boolean, lastEntryId: string | undefined) {
  const endRef = useRef<HTMLDivElement>(null);
  const newEntryRef = useRef<HTMLDivElement>(null);
  const endInView = useRef(false);

  useEffect(() => {
    if (!endRef.current) return;
    // Mehrere Beobachtungen seit dem letzten Aufruf: Es zählt die neueste.
    const observer = new IntersectionObserver((observations) => {
      endInView.current = observations.at(-1)?.isIntersecting ?? false;
    });
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visible) scrollToEnd(endRef.current, newEntryRef.current);
  }, [visible]);

  useEffect(() => {
    if (lastEntryId !== undefined && endInView.current) {
      scrollToEnd(endRef.current, newEntryRef.current);
    }
  }, [lastEntryId]);

  return {
    endRef,
    newEntryRef,
    // Das eigene Scrollen gilt sofort als „am Ende": Der IntersectionObserver
    // meldet es erst nach dem nächsten Frame, der neue Eintrag kommt oft vorher.
    scrollToEnd: () => {
      endInView.current = true;
      scrollToEnd(endRef.current, newEntryRef.current);
    },
  };
}

/**
 * Am Desktop scrollt nur die Liste ans Ende; am Handy scrollt das ganze ETB,
 * dort gehört Neuer Eintrag unter dem letzten Eintrag mit ins Bild.
 */
function scrollToEnd(listEnd: Element | null, newEntry: Element | null) {
  listEnd?.scrollIntoView({ block: "end" });
  newEntry?.scrollIntoView({ block: "end" });
}
