import { unzipSync } from "fflate";
import { ValidationError } from "@/server/validation";

export const MAX_KML_BYTES = 20 * 1024 * 1024; // 20 MB

// ZIP-Dateien (und damit KMZ) beginnen mit der lokalen Datei-Signatur "PK\x03\x04".
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

const utf8 = new TextDecoder("utf-8");

/** Ob der Puffer wie ein ZIP-Archiv (also ein KMZ) aussieht. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((byte, i) => bytes[i] === byte);
}

/** Wählt aus den Einträgen eines KMZ die Haupt-KML: bevorzugt `doc.kml`,
 *  sonst die erste `.kml` (Verzeichnistiefe ignoriert). Gibt Name und Bytes
 *  zurück, damit der KML-Eintrag beim Inlinen der übrigen Assets ausgenommen
 *  werden kann. */
function pickKmlEntry(
  entries: Record<string, Uint8Array>,
): { name: string; bytes: Uint8Array } | null {
  const names = Object.keys(entries);
  const name =
    names.find((n) => n.toLowerCase() === "doc.kml") ??
    names.find((n) => n.toLowerCase().endsWith(".kml"));
  return name ? { name, bytes: entries[name] } : null;
}

// Endung → MIME-Typ für die in KMZ üblichen Symbolbilder.
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
};

/** Normalisiert einen KMZ-internen Pfad für den Abgleich (klein, ohne `./`). */
const normalizePath = (path: string): string =>
  path.trim().replace(/^\.\//, "").toLowerCase();

/** Base64-kodiert Bytes zu einer `data:`-URL. Kodiert den Binärstring in
 *  Blöcken, damit `btoa` bei großen Bildern nicht am Argumentlimit von
 *  `String.fromCharCode` scheitert. Läuft auch clientseitig (kein `Buffer`). */
export function bytesToDataUri(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Ersetzt relative `<href>`-Verweise auf KMZ-interne Bilder durch eingebettete
 * `data:`-URLs, damit die gebündelten Symbole ohne separate Auslieferung
 * erscheinen. Der KML-Eintrag selbst, absolute (`http(s)`) Verweise und
 * unbekannte Dateitypen bleiben unverändert.
 */
export function inlineKmzAssets(
  kml: string,
  entries: Record<string, Uint8Array>,
  kmlEntryName: string,
): string {
  const assets = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (name !== kmlEntryName) assets.set(normalizePath(name), bytes);
  }
  return kml.replace(/<href>\s*([^<]+?)\s*<\/href>/g, (whole, href) => {
    const bytes = assets.get(normalizePath(href));
    if (!bytes) return whole;
    const ext = normalizePath(href).split(".").pop() ?? "";
    const mime = IMAGE_MIME[ext];
    return mime ? `<href>${bytesToDataUri(bytes, mime)}</href>` : whole;
  });
}

/**
 * Normalisiert einen KML- oder KMZ-Puffer zu KML-Text. Ein KMZ (ZIP) wird
 * entpackt, dessen Haupt-KML extrahiert und gebündelte Bilder als `data:`-URLs
 * eingebettet; alles andere wird als UTF-8-Text gelesen. So speichert und
 * rendert der Rest der App einheitlich rohes, in sich geschlossenes KML.
 */
export function extractKml(bytes: Uint8Array): string {
  if (!looksLikeZip(bytes)) return utf8.decode(bytes);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new ValidationError("Das KMZ-Archiv konnte nicht entpackt werden.");
  }
  const entry = pickKmlEntry(entries);
  if (!entry) {
    throw new ValidationError("Das KMZ-Archiv enthält keine KML-Datei.");
  }
  return inlineKmzAssets(utf8.decode(entry.bytes), entries, entry.name);
}

// <NetworkLink>…<href>URL</href>…</NetworkLink>; erfasst sowohl das neue
// <Link>- als auch das alte <Url>-Element (beide enthalten <href>).
const NETWORK_LINK = /<NetworkLink\b[\s\S]*?<\/NetworkLink>/gi;
const HREF = /<href>\s*([\s\S]*?)\s*<\/href>/i;
// Greift den Inhalt des äußersten <Document>…</Document> (greedy, damit auch
// verschachtelte Documents/Folder mitgenommen werden).
const DOCUMENT_BODY = /<Document\b[^>]*>([\s\S]*)<\/Document>/i;

/**
 * Sammelt die http(s)-Ziele aller `<NetworkLink>`-Elemente. Google-„Meine
 * Karten“-KMZ enthalten statt Geometrie nur einen solchen Verweis auf die
 * eigentlichen Daten – ohne Auflösung bliebe das Overlay leer, weil togeojson
 * NetworkLinks nicht folgt.
 */
export function networkLinkHrefs(kml: string): string[] {
  const hrefs: string[] = [];
  for (const block of kml.match(NETWORK_LINK) ?? []) {
    const href = block.match(HREF)?.[1]?.trim();
    if (href && /^https?:\/\//i.test(href)) hrefs.push(href);
  }
  return hrefs;
}

/**
 * Fasst mehrere KML-Dokumente zu einem zusammen, indem der Inhalt jedes
 * `<Document>` in ein neues `<Document>` kopiert wird. Ein einzelnes Dokument
 * wird unverändert durchgereicht.
 */
export function mergeKmlDocuments(docs: string[]): string {
  if (docs.length === 1) return docs[0];
  const bodies = docs.map((doc) => doc.match(DOCUMENT_BODY)?.[1] ?? "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${bodies.join("")}</Document></kml>`;
}
