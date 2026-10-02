/** Was einen ETB-Eintrag geschrieben hat: ein Mensch oder ein Anlass. */
export type JournalEntryType =
  | "manuell"
  | "einsatz-eröffnet"
  | "einsatz-geschlossen"
  | "stelle-angelegt"
  | "stelle-umbenannt"
  | "stärkemeldung"
  | "gesamtstärke-gemeldet";

/** Automatische Einträge lassen sich im ETB ausblenden. */
export function isAutomaticEntry(type: JournalEntryType): boolean {
  return (
    type === "einsatz-eröffnet" ||
    type === "einsatz-geschlossen" ||
    type === "stelle-angelegt"
  );
}

/** Im ETB lassen sich nur manuelle Einträge korrigieren. */
export function canCorrectEntry(type: JournalEntryType): boolean {
  return type === "manuell";
}

/** Im ETB lassen sich manuelle Einträge und gemeldete Gesamtstärken annullieren. */
export function canAnnulEntry(type: JournalEntryType): boolean {
  return type === "manuell" || type === "gesamtstärke-gemeldet";
}
