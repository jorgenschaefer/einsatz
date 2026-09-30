"use client";

import { NativeSelect } from "@mantine/core";
import type { KeyboardEventHandler } from "react";

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
