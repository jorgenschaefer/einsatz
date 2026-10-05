"use client";

import { Button, Group, Stack, Textarea } from "@mantine/core";
import { type Ref, useEffect, useRef, useState } from "react";
import { ErrorAlert } from "@/app/ErrorAlert";
import {
  EntryChannelSelect,
  EntryRouteChips,
  isSubmitShortcut,
} from "@/journal/EntryRouteFields";
import type { EntryContent, EntryRoute, LastUsed } from "@/journal/entry-route";

/** Ob bei Von und An statt der Chips das Feld „andere …" offen ist. */
const NO_OTHER_OPEN = { sender: false, recipient: false };

/**
 * Text, Von, An und Weg eines Eintrags, für einen neuen Eintrag wie für eine
 * Korrektur. Nach dem Speichern sind Text, Von und An leer für den nächsten
 * Eintrag; der Weg bleibt.
 */
export function EntryForm({
  label,
  placeholder,
  textRef,
  initial,
  pinned = false,
  compact = false,
  correspondents,
  lastUsed,
  presetChannel,
  submitLabel,
  onSubmit,
  onCancel,
  error,
  onDismissError,
}: {
  /** Das unsichtbare Label des Textfelds. */
  label: string;
  placeholder?: string;
  textRef?: Ref<HTMLTextAreaElement>;
  initial: EntryContent;
  /** Von und An aus `initial` stehen vorne in ihren Zeilen. */
  pinned?: boolean;
  /** Kleine Weg-Auswahl und Knöpfe, damit sie im schmaleren Eintrag in eine Zeile passen. */
  compact?: boolean;
  correspondents: string[];
  /** Ordnet die Chips von Von und An, die zuletzt benutzten vorne. */
  lastUsed: { sender: LastUsed; recipient: LastUsed };
  /**
   * Ersetzt den Weg aus `initial`, auch wenn er sich später ändert, solange die
   * Weg-Auswahl nicht bedient wurde.
   */
  presetChannel?: string | null;
  submitLabel: string;
  /** Liefert, ob gespeichert wurde. */
  onSubmit: (content: EntryContent) => Promise<boolean>;
  onCancel?: () => void;
  /** Warum das letzte Speichern scheiterte; steht über Weg und Knöpfen. */
  error: string | null;
  onDismissError: () => void;
}) {
  const [text, setText] = useState(initial.text);
  const [route, setRoute] = useState<EntryRoute>({
    sender: initial.sender,
    recipient: initial.recipient,
    channel: initial.channel,
  });
  const [otherOpen, setOtherOpen] = useState(NO_OTHER_OPEN);
  // Neu gemountet stehen die Chip-Zeilen für den nächsten Eintrag wieder vorne.
  const [chipRowsKey, setChipRowsKey] = useState(0);
  const channelChosen = useRef(false);
  // Ein Ref, weil ein zweites Abschicken vor dem nächsten Render ankommen kann.
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const size = compact ? "xs" : "sm";

  useEffect(() => {
    if (presetChannel === undefined || channelChosen.current) return;
    setRoute((current) => ({ ...current, channel: presetChannel }));
  }, [presetChannel]);

  /** `chosen` ist, was ein Feld beim Abschicken noch übernimmt. */
  const submit = async (chosen: Partial<EntryRoute> = {}) => {
    const trimmed = text.trim();
    if (!trimmed || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      if (!(await onSubmit({ text: trimmed, ...route, ...chosen }))) return;
    } finally {
      saving.current = false;
      setBusy(false);
    }
    setText("");
    setRoute((current) => ({ ...current, sender: null, recipient: null }));
    setOtherOpen(NO_OTHER_OPEN);
    setChipRowsKey((key) => key + 1);
  };

  return (
    <Stack gap="xs">
      <EntryRouteChips
        key={`sender-${chipRowsKey}`}
        label="Von"
        value={route.sender}
        onChange={(sender) => setRoute({ ...route, sender })}
        options={correspondents}
        lastUsed={lastUsed.sender}
        pinned={pinned ? initial.sender : null}
        otherOpen={otherOpen.sender}
        onOtherOpenChange={(sender) => setOtherOpen({ ...otherOpen, sender })}
        onSubmit={(sender) => submit({ sender })}
      />
      <EntryRouteChips
        key={`recipient-${chipRowsKey}`}
        label="An"
        value={route.recipient}
        onChange={(recipient) => setRoute({ ...route, recipient })}
        options={correspondents}
        lastUsed={lastUsed.recipient}
        pinned={pinned ? initial.recipient : null}
        otherOpen={otherOpen.recipient}
        onOtherOpenChange={(recipient) =>
          setOtherOpen({ ...otherOpen, recipient })
        }
        onSubmit={(recipient) => submit({ recipient })}
      />
      <Textarea
        ref={textRef}
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={submitOnCtrlEnter(submit)}
        placeholder={placeholder}
        readOnly={busy}
      />
      <ErrorAlert error={error} onClose={onDismissError} />
      {/* gap="sm": Neben dem 150 px breiten Freitext-Weg bleibt „Eintrag
          hinzufügen" bei 360 px ungekürzt. Passen die Knöpfe nicht daneben,
          etwa neben dem Freitext-Weg einer Korrektur, rutschen sie in die
          nächste Zeile. */}
      <Group justify="space-between" gap={compact ? "xs" : "sm"}>
        <EntryChannelSelect
          size={size}
          value={route.channel}
          onChange={(channel) => {
            channelChosen.current = true;
            setRoute({ ...route, channel });
          }}
          onKeyDown={submitOnCtrlEnter(submit)}
        />
        <Group gap="xs" wrap="nowrap">
          <Button size={size} loading={busy} onClick={() => submit()}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button size={size} variant="subtle" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
}

/** Strg/⌘+Enter schickt das Eingabefeld ab. */
const submitOnCtrlEnter =
  (submit: () => Promise<void>) => (e: React.KeyboardEvent) => {
    if (isSubmitShortcut(e)) {
      e.preventDefault();
      void submit();
    }
  };
