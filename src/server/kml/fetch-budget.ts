import { MAX_KML_BYTES } from "@/kml/kmz";
import { ValidationError } from "@/server/validation";

const MAX_ADDRESSES = 20;

/** Was ein Einbinden oder „Neu laden“ einer KML-Ebene insgesamt abrufen darf. */
export type FetchBudget = { addressesLeft: number; bytesLeft: number };

export function createFetchBudget(): FetchBudget {
  return { addressesLeft: MAX_ADDRESSES, bytesLeft: MAX_KML_BYTES };
}

/** Verbraucht eine Adresse; `false`, wenn keine Adresse oder keine Bytes mehr
 *  übrig sind. */
export function takeAddress(budget: FetchBudget): boolean {
  if (budget.addressesLeft <= 0 || budget.bytesLeft <= 0) return false;
  budget.addressesLeft--;
  return true;
}

/**
 * Liest den Body Stück für Stück und bricht ab, sobald er `cap` oder die im
 * Budget übrigen Bytes übersteigt. Das Gelesene geht vom Budget ab, auch beim
 * Abbruch.
 */
export async function readCapped(
  response: Response,
  budget: FetchBudget,
  cap: number,
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const limit = Math.min(cap, budget.bytesLeft);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      read += value.byteLength;
      if (read > limit) {
        await reader.cancel();
        throw kmlTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    budget.bytesLeft = Math.max(0, budget.bytesLeft - read);
  }
}

export const kmlTooLarge = (): ValidationError =>
  new ValidationError("Die KML-Datei ist größer als 20 MB.");
