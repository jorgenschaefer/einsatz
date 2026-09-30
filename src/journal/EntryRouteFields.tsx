"use client";

import {
  Autocomplete,
  Chip,
  CloseButton,
  NativeSelect,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { type KeyboardEvent, type KeyboardEventHandler, useState } from "react";
import {
  type LastUsed,
  orderCorrespondents,
  sameCorrespondent,
} from "./entry-route";
import "./entry-route-fields.css";

const CHANNELS = ["Funk", "Telefon", "Persönlich"];
/** Der Weg, mit dem ein neuer Eintrag beginnt. */
export const DEFAULT_CHANNEL = CHANNELS[0];
/** Der Wert der Option „ohne"; ein Eintrag ohne Weg hat `null`. */
const NO_CHANNEL = "";
/** Der Wert der Option „Andere …", die aus der Auswahl ein Textfeld macht. */
const OTHER_CHANNEL = "andere";

/**
 * Der Weg eines Eintrags als Auswahl ohne sichtbares Label. „Andere …" macht
 * daraus ein Textfeld; „×" macht wieder die Auswahl daraus, mit dem Weg von
 * vorher. Ein Weg, den die Auswahl nicht bietet, steht im Textfeld, auch
 * wenn er erst später kommt; „×" führt dann zu Funk.
 */
export function EntryChannelSelect({
  size = "sm",
  value,
  onChange,
  onKeyDown,
}: {
  size?: "xs" | "sm";
  value: string | null;
  onChange: (channel: string | null) => void;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}) {
  const offered = value === null || CHANNELS.includes(value);
  const [otherOpen, setOtherOpen] = useState(!offered);
  const [otherChosen, setOtherChosen] = useState(false);
  const [backFromOther, setBackFromOther] = useState(false);
  const [channelBeforeOther, setChannelBeforeOther] = useState(
    offered ? value : DEFAULT_CHANNEL,
  );

  const openOther = () => {
    setChannelBeforeOther(value);
    setOtherOpen(true);
    setOtherChosen(true);
    onChange(null);
  };

  const closeOther = () => {
    setOtherOpen(false);
    setBackFromOther(true);
    onChange(channelBeforeOther);
  };

  // Ein Weg, den die Auswahl nicht bietet, kann auch nach dem Mounten kommen
  // (der gemerkte Weg); das Textfeld bleibt dann auch, wenn es geleert wird.
  if (!offered && !otherOpen) setOtherOpen(true);

  if (otherOpen) {
    return (
      // Das „×" steht im Feld, damit es bei 360 px neben dem Knopf „Eintrag
      // hinzufügen" noch 150 px breit ist.
      <TextInput
        className="entry-channel-other"
        size={size}
        aria-label="Weg"
        // Nur nach „Andere …", nicht beim Öffnen einer Korrektur.
        autoFocus={otherChosen}
        value={value ?? ""}
        onChange={(e) => onChange(e.currentTarget.value || null)}
        onKeyDown={onKeyDown}
        rightSectionPointerEvents="all"
        rightSection={
          <CloseButton
            size={size}
            aria-label="Zurück zur Auswahl"
            onClick={closeOther}
          />
        }
      />
    );
  }

  return (
    <NativeSelect
      size={size}
      aria-label="Weg"
      // Nach „×" steht der Fokus wieder auf der Auswahl, die das Textfeld ersetzt.
      autoFocus={backFromOther}
      data={[
        ...CHANNELS,
        { value: OTHER_CHANNEL, label: "Andere …" },
        { value: NO_CHANNEL, label: "ohne" },
      ]}
      value={value ?? NO_CHANNEL}
      onChange={(e) => {
        const chosen = e.currentTarget.value;
        if (chosen === OTHER_CHANNEL) openOther();
        else onChange(chosen || null);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * Von oder An als eine Zeile Chips, die waagerecht scrollt statt umzubrechen.
 * Ein Tipp wählt einen Wert, ein erneuter Tipp wählt ihn ab. „andere …" am
 * rechten Rand ersetzt die Chips durch ein Feld mit Vorschlägen.
 */
export function EntryRouteChips({
  label,
  value,
  onChange,
  options,
  lastUsed,
  pinned = null,
  otherOpen,
  onOtherOpenChange,
  onSubmit,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  /** Die zuletzt benutzten Werte stehen vorne, die übrigen alphabetisch dahinter. */
  lastUsed: LastUsed;
  /** Steht vorne in der Zeile, auch wenn er abgewählt wird. */
  pinned?: string | null;
  otherOpen: boolean;
  onOtherOpenChange: (open: boolean) => void;
  /** Strg/⌘+Enter im Feld: schickt den Eintrag mit diesem Wert ab. */
  onSubmit?: (value: string | null) => void;
}) {
  const switchOther = (open: boolean) => {
    onChange(null);
    onOtherOpenChange(open);
  };

  return (
    <fieldset className="entry-route-chips" aria-label={label}>
      <span className="entry-route-chips-label" aria-hidden>
        {label}
      </span>
      {otherOpen ? (
        <Autocomplete
          className="entry-route-other-field"
          aria-label={label}
          size="xs"
          autoFocus
          openOnFocus={false}
          data={options}
          value={value ?? ""}
          onChange={(typed) => onChange(typed || null)}
          onKeyDown={(e) => {
            if (!isSubmitShortcut(e)) return;
            e.preventDefault();
            onSubmit?.(markedSuggestion(e.currentTarget) ?? value);
          }}
        />
      ) : (
        <div className="entry-route-chips-row">
          {chipOrder(options, lastUsed, value, pinned).map((option) => (
            <Chip
              key={option}
              size="sm"
              variant="light"
              checked={sameCorrespondent(option, value)}
              onChange={() =>
                onChange(sameCorrespondent(option, value) ? null : option)
              }
            >
              {option}
            </Chip>
          ))}
        </div>
      )}
      {otherOpen ? (
        <UnstyledButton
          className="entry-route-other"
          aria-label="Zurück zur Auswahl"
          onClick={() => switchOther(false)}
        >
          ×
        </UnstyledButton>
      ) : (
        <UnstyledButton
          className="entry-route-other"
          onClick={() => switchOther(true)}
        >
          andere …
        </UnstyledButton>
      )}
    </fieldset>
  );
}

/** Strg/⌘+Enter schickt den Eintrag ab, aus jedem seiner Eingabefelder. */
export const isSubmitShortcut = (e: KeyboardEvent) =>
  e.key === "Enter" && (e.ctrlKey || e.metaKey);

/**
 * Der mit den Pfeiltasten markierte Vorschlag. Die Autocomplete übernimmt ihn
 * erst nach dem eigenen Tastendruck-Handler, abgeschickt wird aber er.
 */
const markedSuggestion = (field: HTMLInputElement) => {
  const id = field.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent || null : null;
};

/**
 * Die Chips nach letzter Verwendung, `pinned` ganz vorne. Verschwindet der
 * gewählte oder vorangestellte Wert aus der Liste (umbenannte Stelle,
 * annullierter Eintrag), bleibt er als Chip stehen.
 */
function chipOrder(
  options: string[],
  lastUsed: LastUsed,
  value: string | null,
  pinned: string | null,
): string[] {
  const chips = orderCorrespondents(
    withValue(withValue(options, value), pinned),
    lastUsed,
  );
  const first = chips.find((chip) => sameCorrespondent(chip, pinned));
  return first === undefined
    ? chips
    : [first, ...chips.filter((chip) => chip !== first)];
}

const withValue = (options: string[], value: string | null) =>
  value === null || options.some((option) => sameCorrespondent(option, value))
    ? options
    : [...options, value];
