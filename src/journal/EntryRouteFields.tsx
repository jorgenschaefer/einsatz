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
 * vorher.
 */
export function EntryChannelSelect({
  value,
  onChange,
  onKeyDown,
}: {
  value: string | null;
  onChange: (channel: string | null) => void;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [backFromOther, setBackFromOther] = useState(false);
  const [channelBeforeOther, setChannelBeforeOther] = useState(value);

  const openOther = () => {
    setChannelBeforeOther(value);
    setOtherOpen(true);
    onChange(null);
  };

  const closeOther = () => {
    setOtherOpen(false);
    setBackFromOther(true);
    onChange(channelBeforeOther);
  };

  if (otherOpen) {
    return (
      // Das „×" steht im Feld, damit es bei 360 px neben dem Knopf „Eintrag
      // hinzufügen" noch 150 px breit ist.
      <TextInput
        className="entry-channel-other"
        aria-label="Weg"
        autoFocus
        value={value ?? ""}
        onChange={(e) => onChange(e.currentTarget.value || null)}
        onKeyDown={onKeyDown}
        rightSectionPointerEvents="all"
        rightSection={
          <CloseButton aria-label="Zurück zur Auswahl" onClick={closeOther} />
        }
      />
    );
  }

  return (
    <NativeSelect
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
  otherOpen,
  onOtherOpenChange,
  onSubmit,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
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
          {alphabetically(withChosen(options, value)).map((option) => (
            <Chip
              key={option}
              size="sm"
              variant="light"
              checked={option === value}
              onChange={() => onChange(option === value ? null : option)}
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
 * Verschwindet der gewählte Wert aus der Liste (umbenannte Stelle, annullierter
 * Eintrag), bleibt er als Chip stehen: gespeichert wird, was zu sehen ist.
 */
const withChosen = (options: string[], value: string | null) =>
  value === null || options.includes(value) ? options : [...options, value];

const alphabetically = (values: string[]) =>
  values.toSorted((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
