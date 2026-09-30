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

/** Die Route eines Eintrags ohne Von, An und Weg, etwa eines automatischen. */
export const NO_ROUTE: EntryRoute = {
  sender: null,
  recipient: null,
  channel: null,
};
