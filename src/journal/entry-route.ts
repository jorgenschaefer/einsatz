/** Von, An und Weg eines ETB-Eintrags; jede Angabe ist optional. */
export interface EntryRoute {
  sender: string | null;
  recipient: string | null;
  channel: string | null;
}

/** Was eine Fassung eines Eintrags sagt: Text samt Von, An und Weg. */
export type EntryContent = { text: string } & EntryRoute;

/**
 * Die Kopfzeile eines Eintrags, „Von X an Y" und Weg getrennt, damit der Weg
 * gedimmt dargestellt werden kann; `null` ohne alle drei Angaben.
 */
export function formatEntryRoute({
  sender,
  recipient,
  channel,
}: EntryRoute): { parties: string | null; channel: string | null } | null {
  if (!sender && !recipient && !channel) return null;
  return { parties: formatParties(sender, recipient), channel };
}

function formatParties(
  sender: string | null,
  recipient: string | null,
): string | null {
  if (sender && recipient) return `Von ${sender} an ${recipient}`;
  if (sender) return `Von ${sender}`;
  if (recipient) return `An ${recipient}`;
  return null;
}

/** Von, An und Weg werden getrimmt gespeichert; leer heißt: keine Angabe. */
export function trimRouteValue(value: string | null): string | null {
  return value?.trim() || null;
}

/** Die Route eines Eintrags ohne Von, An und Weg, etwa eines automatischen. */
export const NO_ROUTE: EntryRoute = {
  sender: null,
  recipient: null,
  channel: null,
};

/**
 * Wann ein Gesprächspartner zuletzt in Von oder An benutzt wurde, je Wert klein
 * geschrieben; die größere Zahl ist die jüngere Verwendung.
 */
export type LastUsed = Record<string, number>;

/**
 * Die zuletzt benutzten Gesprächspartner zuerst, danach die übrigen
 * alphabetisch; beides ohne Rücksicht auf Groß- und Kleinschreibung.
 */
export function orderCorrespondents(
  values: string[],
  lastUsed: LastUsed,
): string[] {
  const usedAt = (value: string) => {
    const key = value.toLowerCase();
    return Object.hasOwn(lastUsed, key) ? lastUsed[key] : 0;
  };
  return values.toSorted(
    (a, b) =>
      usedAt(b) - usedAt(a) ||
      a.localeCompare(b, "de", { sensitivity: "base" }),
  );
}
