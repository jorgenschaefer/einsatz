import { kmlTooLarge, MAX_KML_BYTES } from "@/kml/kmz";
import { BodyTooLargeError, readBody } from "@/server/http/read-body";

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
 * Liest den Body wie {@link readBody} und bricht ab, sobald er `cap` oder die im
 * Budget übrigen Bytes übersteigt. Das Gelesene geht vom Budget ab, auch beim
 * Abbruch.
 */
export async function readCapped(
  response: Response,
  budget: FetchBudget,
  cap: number,
): Promise<Uint8Array> {
  let read = 0;
  try {
    return await readBody(
      response,
      Math.min(cap, budget.bytesLeft),
      (bytes) => {
        read += bytes;
      },
    );
  } catch (error) {
    throw error instanceof BodyTooLargeError ? kmlTooLarge() : error;
  } finally {
    budget.bytesLeft = Math.max(0, budget.bytesLeft - read);
  }
}
