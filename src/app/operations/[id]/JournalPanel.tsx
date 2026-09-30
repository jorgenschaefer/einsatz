"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type Ref, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import type {
  JournalEntryState,
  JournalEntryType,
} from "@/server/journal/journal";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";

interface JournalRevisionView {
  text: string;
  author: string | null;
  createdAt: string;
}

export interface JournalEntryView {
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
  onAdd: (text: string) => Promise<ActionResult>;
  onCorrect: (id: string, text: string) => Promise<ActionResult>;
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

const isAutomatic = (entry: JournalEntryView) =>
  entry.type === "einsatz-eröffnet" ||
  entry.type === "einsatz-geschlossen" ||
  entry.type === "stelle-angelegt";

export function JournalPanel({
  entries,
  onAdd,
  onCorrect,
  onAnnul,
  newEntryRef,
  visible,
}: JournalPanelProps) {
  const [hideAuto, setHideAuto] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [annulTarget, setAnnulTarget] = useState<JournalEntryView | null>(null);
  const [annulConfirmationOpen, annulConfirmation] = useDisclosure(false);
  const [error, setError] = useState<string | null>(null);

  const shown = hideAuto ? entries.filter((e) => !isAutomatic(e)) : entries;
  const scroll = useScrollToEnd(visible, entries.at(-1)?.id);

  const submitNew = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      const { error: err } = await onAdd(text);
      if (err) {
        setError(err);
        return;
      }
      setDraft("");
      setError(null);
      scroll.scrollToEnd();
    } catch {
      setError(SAVE_ERROR);
    }
  };

  const submitEdit = async () => {
    const text = editText.trim();
    if (!text || editingId === null) return;
    try {
      const { error: err } = await onCorrect(editingId, text);
      if (err) {
        setError(err);
        return;
      }
      setEditingId(null);
      setError(null);
    } catch {
      setError(SAVE_ERROR);
    }
  };

  const startCorrection = (entry: JournalEntryView) => {
    setEditingId(entry.id);
    setEditText(entry.text);
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
                          <Menu.Item onClick={() => startCorrection(entry)}>
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
                <Text key={`${entry.id}-${index}`} size="sm" c="dimmed" mt={4}>
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

              {editingId === entry.id && (
                <Stack mt="xs" gap="xs">
                  <Textarea
                    aria-label="Korrektur"
                    value={editText}
                    onChange={(e) => setEditText(e.currentTarget.value)}
                    onKeyDown={submitOnCtrlEnter(submitEdit)}
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
        {/* Deckt die letzten 8 px der Liste ab: Am Ende gescrollt fehlen dem
            Rand sonst Bruchteile eines Pixels, und es gilt nicht als „am Ende".
            Ohne flexShrink schrumpft er in der scrollenden Liste (Desktop) auf 0. */}
        <div
          ref={scroll.endRef}
          style={{ height: 8, marginTop: -8, flexShrink: 0 }}
        />
      </Stack>

      <Stack gap="xs" className="journal-new-entry" ref={scroll.newEntryRef}>
        <Textarea
          ref={newEntryRef}
          aria-label="Neuer Eintrag"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={submitOnCtrlEnter(submitNew)}
          placeholder="Ereignis festhalten …"
        />
        <Button onClick={submitNew} w="fit-content">
          Eintrag hinzufügen
        </Button>
      </Stack>

      {annulTarget && (
        <ConfirmationModal
          opened={annulConfirmationOpen}
          onClose={annulConfirmation.close}
          title={`Eintrag #${annulTarget.number} annullieren`}
          confirmLabel="Annullieren"
          confirmColor="red"
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

/** Strg/⌘+Enter schickt das Textfeld ab. */
const submitOnCtrlEnter =
  (submit: () => Promise<void>) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  };
