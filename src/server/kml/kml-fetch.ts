import { lookup } from "node:dns/promises";
import { ValidationError } from "@/server/validation";
import { extractKml, mergeKmlDocuments, networkLinkHrefs } from "./kmz";

export const MAX_KML_BYTES = 20 * 1024 * 1024; // 20 MB
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const MAX_NETWORK_LINK_DEPTH = 3;
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

/** Deckelt KML-Inhalte (Text oder rohe Bytes) bei 20 MB. */
export function enforceKmlSizeLimit(content: string | Uint8Array): void {
  const size =
    typeof content === "string"
      ? Buffer.byteLength(content, "utf8")
      : content.byteLength;
  if (size > MAX_KML_BYTES) {
    throw new ValidationError("Die KML-Datei ist größer als 20 MB.");
  }
}

/** Lehnt eine bereits im Content-Length angekündigte Übergröße ab, bevor der Body gelesen wird. */
export function enforceContentLength(header: string | null): void {
  if (header && Number(header) > MAX_KML_BYTES) {
    throw new ValidationError("Die KML-Datei ist größer als 20 MB.");
  }
}

const isBlockedIpv4 = (a: number, b: number): boolean =>
  a === 0 || // 0.0.0.0/8 (routet unter Linux auf localhost)
  a === 127 ||
  a === 10 ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 169 && b === 254);

/** Zieht die eingebettete IPv4 aus einer IPv4-mapped-IPv6-Adresse (`::ffff:…`). */
const mappedIpv4 = (h: string): string | null => {
  const m = h.match(/^::ffff:(.+)$/);
  if (!m) return null;
  const rest = m[1];
  if (rest.includes(".")) return rest; // ::ffff:169.254.169.254
  const parts = rest.split(":"); // ::ffff:a9fe:a9fe
  if (parts.length !== 2) return null;
  const hi = Number.parseInt(parts[0], 16);
  const lo = Number.parseInt(parts[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
};

/** Ob eine IP (v4 dotted oder v6-Literal) in einen gesperrten Bereich fällt.
 *  Nicht-IP-Hostnamen liefern `false` (werden erst nach DNS-Auflösung geprüft). */
export const isBlockedIp = (host: string): boolean => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return isBlockedIpv4(Number(v4[1]), Number(v4[2]));
  if (!h.includes(":")) return false; // Hostname, keine IP
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fe80")) return true; // Link-Local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // Unique-Local fc00::/7
  // IPv4-mapped (::ffff:…) wird zur eingebetteten IPv4 aufgelöst. IPv4-kompatible
  // Adressen (::a.b.c.d) sind deprecated und werden vom OS nicht nach IPv4
  // geroutet – außer Betrachtung.
  const mapped = mappedIpv4(h);
  return mapped ? isBlockedIp(mapped) : false;
};

const isBlockedHost = (host: string): boolean => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  return isBlockedIp(h);
};

/**
 * Löst den Host auf und blockt, wenn eine der Adressen intern ist. Fängt einen
 * *statischen* öffentlich klingenden Namen, dessen DNS-Eintrag auf eine private
 * IP zeigt (z. B. `evil.example → 169.254.169.254`) – das sieht die reine
 * Stringprüfung nicht. Aktives DNS-Rebinding schließt es nicht: `fetch` löst
 * erneut auf, es bleibt ein TOCTOU-Fenster. Für das kleine, vertrauenswürdige
 * Team hinnehmbar; die DNS-Auflösung ist die dünne IO-Grenze.
 */
async function assertResolvedHostAllowed(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new ValidationError("Die Adresse konnte nicht aufgelöst werden.");
  }
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new ValidationError("Diese Adresse ist nicht erlaubt.");
    }
  }
}

/**
 * Prüft eine nutzergelieferte KML-URL, bevor der Server sie holt: nur http(s),
 * keine Loopback-/Privat-/Link-Local-Ziele (SSRF-Schutz). Gibt die URL zurück.
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
  if (isBlockedHost(parsed.hostname)) {
    throw new ValidationError("Diese Adresse ist nicht erlaubt.");
  }
  return parsed;
}

/**
 * Folgt Weiterleitungen von Hand und prüft jeden Sprung erneut gegen die
 * SSRF-Sperren. Nötig, weil Google-Downloads (z. B. „Meine Karten“) über eine
 * 302 auf `googleusercontent.com` ausgeliefert werden – automatisches Folgen
 * (`redirect: "follow"`) würde die Ziel-Prüfung umgehen, `redirect: "error"`
 * bräche den Download ab.
 */
async function fetchFollowingRedirects(start: URL): Promise<Response> {
  let target = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchableKmlUrl(target.href);
    await assertResolvedHostAllowed(target.hostname);
    const response = await fetch(target, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
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
 * Lässt sich ein Verweis nicht laden, bleibt das ursprüngliche KML erhalten.
 */
export async function resolveKmlNetworkLinks(
  kml: string,
  depth = 0,
): Promise<string> {
  const hrefs = networkLinkHrefs(kml);
  if (hrefs.length === 0 || depth >= MAX_NETWORK_LINK_DEPTH) return kml;
  const docs: string[] = [];
  for (const href of hrefs) {
    try {
      docs.push(await fetchKmlFromUrl(href, depth + 1));
    } catch {
      // Einzelner toter Verweis: überspringen, restliche Links weiter auflösen.
    }
  }
  return docs.length > 0 ? mergeKmlDocuments(docs) : kml;
}

/**
 * Holt KML- oder KMZ-Inhalt serverseitig (umgeht CORS), entpackt KMZ zu KML,
 * löst NetworkLinks auf und deckelt bei 20 MB. Die dünne, ungetestete
 * HTTP-Grenze; Validierung, Deckel, KMZ-Entpackung und Link-Erkennung sind
 * getestet.
 */
export async function fetchKmlFromUrl(url: string, depth = 0): Promise<string> {
  const target = assertFetchableKmlUrl(normalizeKmlSourceUrl(url));
  const response = await fetchFollowingRedirects(target);
  if (!response.ok)
    throw new ValidationError(
      `KML konnte nicht geladen werden (${response.status}).`,
    );
  enforceContentLength(response.headers.get("content-length"));
  const bytes = new Uint8Array(await response.arrayBuffer());
  enforceKmlSizeLimit(bytes); // deckelt den (ggf. komprimierten) Download
  const content = await resolveKmlNetworkLinks(extractKml(bytes), depth);
  enforceKmlSizeLimit(content); // deckelt das entpackte/aufgelöste KML
  return content;
}
