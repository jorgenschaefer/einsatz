import { type EntryRoute, type LastUsed, trimRouteValue } from "./entry-route";

/** Was ein Gerät sich je Gesamteinsatz von seinen neuen ETB-Einträgen merkt. */
export interface EntryRouteMemory {
  sender: LastUsed;
  recipient: LastUsed;
  /** Der Weg des zuletzt gespeicherten neuen Eintrags; fehlt, solange es keinen gibt. */
  channel?: string | null;
}

export const NOTHING_REMEMBERED: EntryRouteMemory = {
  sender: {},
  recipient: {},
};

const storageKey = (operationId: string) => `einsatz:entryRoute:${operationId}`;

/** Liest, was dieser Browser sich zu den neuen Einträgen eines Gesamteinsatzes gemerkt hat. */
export function readEntryRouteMemory(operationId: string): EntryRouteMemory {
  try {
    const raw = localStorage.getItem(storageKey(operationId));
    if (!raw) return NOTHING_REMEMBERED;
    const parsed: unknown = JSON.parse(raw);
    return isEntryRouteMemory(parsed) ? parsed : NOTHING_REMEMBERED;
  } catch {
    return NOTHING_REMEMBERED;
  }
}

/**
 * Merkt sich Von, An und Weg eines neu gespeicherten Eintrags als jüngste
 * Verwendung, getrimmt wie auf dem Server gespeichert.
 */
export function rememberEntryRoute(
  operationId: string,
  { sender, recipient, channel }: EntryRoute,
): void {
  const memory = readEntryRouteMemory(operationId);
  const remembered: EntryRouteMemory = {
    sender: withUse(memory.sender, trimRouteValue(sender)),
    recipient: withUse(memory.recipient, trimRouteValue(recipient)),
    channel: trimRouteValue(channel),
  };
  try {
    localStorage.setItem(storageKey(operationId), JSON.stringify(remembered));
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus) – es bleibt alphabetisch und bei Funk.
  }
}

function withUse(lastUsed: LastUsed, value: string | null): LastUsed {
  if (value === null) return lastUsed;
  const latest = Math.max(0, ...Object.values(lastUsed));
  return { ...lastUsed, [value.toLowerCase()]: latest + 1 };
}

function isEntryRouteMemory(value: unknown): value is EntryRouteMemory {
  if (typeof value !== "object" || value === null) return false;
  const { sender, recipient, channel } = value as Record<string, unknown>;
  return (
    isLastUsed(sender) &&
    isLastUsed(recipient) &&
    (channel === undefined || channel === null || typeof channel === "string")
  );
}

const isLastUsed = (value: unknown): value is LastUsed =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((usedAt) => typeof usedAt === "number");
