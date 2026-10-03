import { isIP } from "node:net";
import {
  extractKml,
  MAX_KML_BYTES,
  mergeKmlDocuments,
  networkLinkHrefs,
} from "@/kml/kmz";
import { ValidationError } from "@/server/validation";
import {
  type FetchBudget,
  kmlTooLarge,
  readCapped,
  takeAddress,
} from "./fetch-budget";
import { pinnedFetch } from "./pinned-fetch";
import { isPublicUnicast } from "./public-address";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
export const MAX_NETWORK_LINK_DEPTH = 3;
const USER_AGENT = "einsatz-lagefuehrung (DRK Katastrophenschutz)";

const GOOGLE_HOSTS = new Set(["www.google.com", "google.com"]);
// Pfade der „Meine Karten“-Oberfläche, optional mit Kontoscope (/u/0/…).
const MY_MAPS_PATH = /^\/maps\/d\/(?:u\/\d+\/)?(?:viewer|edit|kml)$/;

/**
 * Übersetzt eine Google-„Meine Karten“-Ansichts-/Bearbeiten-URL in die
 * KML-Export-URL (`/maps/d/kml?mid=…&forcekml=1`). `forcekml=1` liefert rohes
 * KML mit eingebetteten Platzmarken statt eines KMZ mit NetworkLinks. Andere
 * URLs (direkte .kml/.kmz-Downloads, Nicht-URLs) bleiben unverändert; die
 * eigentliche Prüfung übernimmt {@link assertFetchableKmlUrl}.
 */
export function normalizeKmlSourceUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return input;
  }
  const mid = parsed.searchParams.get("mid");
  if (
    !GOOGLE_HOSTS.has(parsed.hostname.toLowerCase()) ||
    !MY_MAPS_PATH.test(parsed.pathname) ||
    !mid
  ) {
    return input;
  }
  const out = new URL("https://www.google.com/maps/d/kml");
  out.searchParams.set("mid", mid);
  out.searchParams.set("forcekml", "1");
  return out.toString();
}

/** Lehnt Inhalt ab, dessen Wurzelelement nicht `<kml>` ist (etwa eine
 *  HTML-Anmeldeseite), mit `message` als Meldung. */
export function assertKmlDocument(text: string, message: string): void {
  if (!hasKmlRoot(text)) throw new ValidationError(message);
}

const KML_ROOT_TAG = /^<(?:[\w.-]+:)?kml[\s/>]/;

// Vor dem Wurzelelement nur Leerraum, eine XML-Deklaration und Kommentare.
// Schrittweise statt mit einem einzigen Regex, weil dessen Backtracking bei
// vielen Kommentaren oder viel Leerraum den Server blockieren würde.
function hasKmlRoot(text: string): boolean {
  let at = skipWhitespace(text, 0);
  if (/^<\?xml\s/.test(text.slice(at, at + 6))) {
    at = skipWhitespace(text, skipPast(text, at, "?>"));
  }
  while (text.startsWith("<!--", at)) {
    at = skipWhitespace(text, skipPast(text, at + 4, "-->"));
  }
  return KML_ROOT_TAG.test(text.slice(at));
}

const skipPast = (text: string, from: number, end: string): number => {
  const found = text.indexOf(end, from);
  return found < 0 ? text.length : found + end.length;
};

const skipWhitespace = (text: string, from: number): number => {
  const nonWhitespace = /\S/g;
  nonWhitespace.lastIndex = from;
  return nonWhitespace.exec(text)?.index ?? text.length;
};

/** Deckelt KML-Inhalte (Text oder rohe Bytes) bei 20 MB. */
export function enforceKmlSizeLimit(content: string | Uint8Array): void {
  const size =
    typeof content === "string"
      ? Buffer.byteLength(content, "utf8")
      : content.byteLength;
  if (size > MAX_KML_BYTES) throw kmlTooLarge();
}

/** Lehnt eine bereits im Content-Length angekündigte Übergröße ab, bevor der Body gelesen wird. */
export function enforceContentLength(header: string | null): void {
  if (header && Number(header) > MAX_KML_BYTES) throw kmlTooLarge();
}

const isLocalhostName = (hostname: string): boolean => {
  const h = hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost");
};

/** Ein Host aus einer URL als IP-Literal, ohne die Klammern um IPv6. */
const ipLiteral = (hostname: string): string | null => {
  const h = hostname.replace(/^\[|\]$/g, "");
  return isIP(h) ? h : null;
};

/**
 * Prüft eine nutzergelieferte KML-URL, bevor der Server sie holt (SSRF-Schutz):
 * nur http(s), kein `localhost`, ein IP-Literal nur als öffentliche
 * Unicast-Adresse. Host-Namen prüft {@link pinnedFetch} beim Verbinden.
 * Gibt die URL zurück.
 */
export function assertFetchableKmlUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError("Bitte eine gültige URL angeben.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("Nur http(s)-URLs werden unterstützt.");
  }
  const literal = ipLiteral(parsed.hostname);
  if (
    isLocalhostName(parsed.hostname) ||
    (literal !== null && !isPublicUnicast(literal))
  ) {
    throw new ValidationError("Diese Adresse ist nicht erlaubt.");
  }
  return parsed;
}

/**
 * Folgt Weiterleitungen von Hand und prüft jeden Sprung erneut gegen die
 * SSRF-Sperren. Nötig, weil Google-Downloads (z. B. „Meine Karten“) über eine
 * 302 auf `googleusercontent.com` ausgeliefert werden.
 */
async function fetchFollowingRedirects(start: URL): Promise<Response> {
  let target = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchableKmlUrl(target.href);
    const response = await pinnedFetch(target, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      target = new URL(location, target); // relative Location auflösen
      continue;
    }
    return response;
  }
  throw new ValidationError("Zu viele Weiterleitungen beim Laden der KML.");
}

/**
 * Ersetzt `<NetworkLink>`-Verweise durch ihren tatsächlichen Inhalt: jeder
 * Ziel-Link wird serverseitig geholt (rekursiv, mit Tiefenlimit) und die
 * Dokumente werden zusammengeführt. Ohne Verweise bleibt das KML unverändert.
 * Nötig für Google-„Meine Karten“-Exporte, die nur einen NetworkLink enthalten;
 * togeojson selbst folgt diesen nicht, sonst bliebe das Overlay leer.
 * Lässt sich ein Verweis nicht laden oder reicht das Budget nicht, wird er
 * übersprungen; lädt keiner, bleibt das ursprüngliche KML erhalten.
 */
export async function resolveKmlNetworkLinks(
  kml: string,
  budget: FetchBudget,
  depth = 0,
): Promise<string> {
  const hrefs = networkLinkHrefs(kml);
  if (hrefs.length === 0 || depth >= MAX_NETWORK_LINK_DEPTH) return kml;
  const docs: string[] = [];
  for (const href of hrefs) {
    try {
      docs.push(await fetchKmlFromUrl(href, budget, depth + 1));
    } catch {
      // Einzelner toter Verweis: überspringen, restliche Links weiter auflösen.
    }
  }
  return docs.length > 0 ? mergeKmlDocuments(docs) : kml;
}

/**
 * Holt KML- oder KMZ-Inhalt serverseitig (umgeht CORS), entpackt KMZ zu KML,
 * löst NetworkLinks auf und deckelt bei 20 MB. Verbraucht eine Adresse und
 * die gelesenen Bytes aus `budget`.
 */
export async function fetchKmlFromUrl(
  url: string,
  budget: FetchBudget,
  depth = 0,
): Promise<string> {
  const target = assertFetchableKmlUrl(normalizeKmlSourceUrl(url));
  if (!takeAddress(budget))
    throw new ValidationError("Das Abruf-Budget dieser KML ist aufgebraucht.");
  const response = await fetchFollowingRedirects(target);
  if (!response.ok)
    throw new ValidationError(
      `KML konnte nicht geladen werden (${response.status}).`,
    );
  enforceContentLength(response.headers.get("content-length"));
  const bytes = await readCapped(response, budget, MAX_KML_BYTES); // ggf. komprimiert
  const kml = extractKml(bytes);
  assertKmlDocument(kml, "Die Adresse liefert keine KML-Datei.");
  const content = await resolveKmlNetworkLinks(kml, budget, depth);
  enforceKmlSizeLimit(content); // deckelt das entpackte/aufgelöste KML
  return content;
}
