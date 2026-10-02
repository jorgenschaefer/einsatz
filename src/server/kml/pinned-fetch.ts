import type { LookupAddress, LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { ValidationError } from "@/server/validation";
import { isPublicUnicast } from "./public-address";

/**
 * Ein HTTP(S)-GET, dessen Verbindung nur zu den Adressen geht, die
 * {@link checkedLookup} geprüft hat: Der Name wird genau einmal aufgelöst, und
 * der Socket verbindet sich mit eben diesem Ergebnis. So kann ein DNS-Name
 * nicht zwischen Prüfung und Abruf auf eine interne Adresse umschwenken.
 * IP-Literale löst Node nicht auf; sie prüft der Aufrufer vorher.
 * Weiterleitungen werden nicht verfolgt, sondern als Antwort zurückgegeben.
 *
 * Gebaut auf `node:http(s)` statt auf `fetch`, weil nur so die Auflösung des
 * Sockets ohne neue Abhängigkeit (undici) austauschbar ist.
 */
export function pinnedFetch(
  url: URL,
  init: { headers: Record<string, string>; signal: AbortSignal },
): Promise<Response> {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    request(
      url,
      { headers: init.headers, signal: init.signal, lookup: checkedLookup },
      (res) => {
        try {
          resolve(toResponse(res));
        } catch (err) {
          res.destroy();
          reject(err);
        }
      },
    )
      .on("error", reject)
      .end();
  });
}

type LookupCallback = (
  err: Error | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * `lookup` für den Socket: löst `hostname` auf und gibt die Adressen nur
 * heraus, wenn jede davon öffentlich ist.
 */
export function checkedLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  resolvePublicAddresses(hostname).then(
    (addresses) =>
      options.all
        ? callback(null, addresses)
        : callback(null, addresses[0].address, addresses[0].family),
    (err: Error) => callback(err, []),
  );
}

async function resolvePublicAddresses(
  hostname: string,
): Promise<LookupAddress[]> {
  let addresses: LookupAddress[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new ValidationError("Die Adresse konnte nicht aufgelöst werden.");
  }
  if (!addresses.every(({ address }) => isPublicUnicast(address))) {
    throw new ValidationError("Diese Adresse ist nicht erlaubt.");
  }
  return addresses;
}

// Status ohne Body; `new Response` lehnt für sie jeden Body ab.
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** Wirft für einen Status, den `Response` nicht kennt (außerhalb 200–599). */
function toResponse(res: IncomingMessage): Response {
  const status = res.statusCode ?? 0;
  const headers = new Headers();
  for (const [name, value] of Object.entries(res.headers)) {
    for (const v of [value ?? []].flat()) headers.append(name, v);
  }
  if (NULL_BODY_STATUSES.has(status)) {
    res.resume();
    return new Response(null, { status, headers });
  }
  const body = Readable.toWeb(res) as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
}
