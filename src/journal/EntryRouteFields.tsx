"use client";

import { Chip, NativeSelect } from "@mantine/core";
import type { KeyboardEventHandler } from "react";
import "./entry-route-fields.css";

const CHANNELS = ["Funk", "Telefon", "Persönlich"];
/** Der Weg, mit dem ein neuer Eintrag beginnt. */
export const DEFAULT_CHANNEL = CHANNELS[0];
/** Der Wert der Option „ohne"; ein Eintrag ohne Weg hat `null`. */
const NO_CHANNEL = "";

/** Der Weg eines Eintrags als Auswahl ohne sichtbares Label. */
export function EntryChannelSelect({
  value,
  onChange,
  onKeyDown,
}: {
  value: string | null;
  onChange: (channel: string | null) => void;
  onKeyDown?: KeyboardEventHandler<HTMLSelectElement>;
}) {
  return (
    <NativeSelect
      aria-label="Weg"
      data={[...CHANNELS, { value: NO_CHANNEL, label: "ohne" }]}
      value={value ?? NO_CHANNEL}
      onChange={(e) => onChange(e.currentTarget.value || null)}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * Von oder An als eine Zeile Chips, die waagerecht scrollt statt umzubrechen.
 * Ein Tipp wählt einen Wert, ein erneuter Tipp wählt ihn ab.
 */
export function EntryRouteChips({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
}) {
  return (
    <fieldset className="entry-route-chips" aria-label={label}>
      <span className="entry-route-chips-label" aria-hidden>
        {label}
      </span>
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
    </fieldset>
  );
}

/**
 * Verschwindet der gewählte Wert aus der Liste (umbenannte Stelle, annullierter
 * Eintrag), bleibt er als Chip stehen: gespeichert wird, was zu sehen ist.
 */
const withChosen = (options: string[], value: string | null) =>
  value === null || options.includes(value) ? options : [...options, value];

const alphabetically = (values: string[]) =>
  values.toSorted((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
