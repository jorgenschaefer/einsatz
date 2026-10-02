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
  let inlined = "";
  let copied = 0;
  for (const { start, end } of hrefTexts(kml)) {
    const dataUri = assetDataUri(assets, kml.slice(start, end));
    if (!dataUri) continue;
    inlined += kml.slice(copied, start) + dataUri;
    copied = end;
  }
  return inlined + kml.slice(copied);
}

function assetDataUri(
  assets: Map<string, Uint8Array>,
  href: string,
): string | null {
  const path = normalizePath(href);
  const bytes = assets.get(path);
  const mime = IMAGE_MIME[path.split(".").pop() ?? ""];
  return bytes && mime ? bytesToDataUri(bytes, mime) : null;
}

/** Lage des Texts jedes `<href>…</href>` (genau so geschrieben), dessen Text
 *  nicht leer ist und kein `<` enthält. */
function* hrefTexts(kml: string): Generator<{ start: number; end: number }> {
  let at = kml.indexOf("<href>");
  while (at >= 0) {
    const start = at + "<href>".length;
    const end = kml.indexOf("<", start);
    if (end < 0) return;
    if (end > start && kml.startsWith("</href>", end)) yield { start, end };
    at = kml.indexOf("<href>", end);
  }
}

/**
 * Normalisiert einen KML- oder KMZ-Puffer zu KML-Text. Ein KMZ (ZIP) wird
 * entpackt, dessen Haupt-KML extrahiert und gebündelte Bilder als `data:`-URLs
 * eingebettet; alles andere wird als UTF-8-Text gelesen. So speichert und
 * rendert der Rest der App einheitlich rohes, in sich geschlossenes KML.
 */
export function extractKml(
  bytes: Uint8Array,
  maxBytes = MAX_KML_BYTES,
): string {
  if (!looksLikeZip(bytes)) return utf8.decode(bytes);
  let entries: Record<string, Uint8Array>;
  try {
    // Entpackte Gesamtgröße vor der Dekompression deckeln (Zip-Bombe): der
    // filter summiert die im ZIP-Verzeichnis deklarierte Größe je Eintrag und
    // bricht ab, bevor ein ehrlich groß deklariertes Archiv entpackt wird. Eine
    // zu klein deklarierte Größe unterläuft das nicht: fflate entpackt in einen
    // fest auf diese Größe dimensionierten Puffer und verwirft Überlauf (Inhalt
    // wird abgeschnitten, kein Fehler) – der Speicher bleibt so in jedem Fall
    // begrenzt. Der catch unten deckt nur echte, kaputte DEFLATE-Ströme ab.
    let total = 0;
    entries = unzipSync(bytes, {
      filter: ({ originalSize }) => {
        total += originalSize;
        if (total > maxBytes) {
          throw new ValidationError("Das entpackte KMZ-Archiv ist zu groß.");
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Das KMZ-Archiv konnte nicht entpackt werden.");
  }
  const entry = pickKmlEntry(entries);
  if (!entry) {
    throw new ValidationError("Das KMZ-Archiv enthält keine KML-Datei.");
  }
  return inlineKmzAssets(utf8.decode(entry.bytes), entries, entry.name);
}

/**
 * Sammelt die http(s)-Ziele aller `<NetworkLink>`-Elemente (aus dem neuen
 * `<Link>`- wie dem alten `<Url>`-Element, beide enthalten `<href>`). Google-
 * „Meine Karten“-KMZ enthalten statt Geometrie nur einen solchen Verweis auf
 * die eigentlichen Daten – ohne Auflösung bliebe das Overlay leer, weil
 * togeojson NetworkLinks nicht folgt.
 */
export function networkLinkHrefs(kml: string): string[] {
  const hrefs: string[] = [];
  for (const link of elementBodies(kml, "NetworkLink")) {
    const href = elementBodies(link, "href")[0]?.trim();
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
  const bodies = docs.map((doc) => outermostElementBody(doc, "Document"));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${bodies.join("")}</Document></kml>`;
}

// Die folgenden Helfer suchen Tags mit indexOf statt mit Regexes: deren
// Backtracking braucht bei nicht geschlossenen Tags oder langem Leerraum
// überlinear lange und würde den Server blockieren. Tag-Namen werden ohne
// Rücksicht auf Groß-/Kleinschreibung verglichen.

/** Inhalt jedes `<tag …>…</tag>` in Reihenfolge, jeweils bis zum ersten
 *  schließenden Tag. */
function elementBodies(kml: string, tag: string): string[] {
  const text = asciiLowerCase(kml);
  const open = `<${tag.toLowerCase()}`;
  const close = `</${tag.toLowerCase()}>`;
  const bodies: string[] = [];
  let at = openingTagIndex(text, open, 0);
  while (at >= 0) {
    const start = text.indexOf(">", at) + 1;
    const end = start > 0 ? text.indexOf(close, start) : -1;
    if (end < 0) return bodies;
    bodies.push(kml.slice(start, end));
    at = openingTagIndex(text, open, end + close.length);
  }
  return bodies;
}

/** Inhalt vom ersten `<tag …>` bis zum letzten `</tag>`, samt verschachtelter
 *  gleichnamiger Elemente; `""`, wenn es keins gibt. */
function outermostElementBody(kml: string, tag: string): string {
  const text = asciiLowerCase(kml);
  const at = openingTagIndex(text, `<${tag.toLowerCase()}`, 0);
  if (at < 0) return "";
  const start = text.indexOf(">", at) + 1;
  const end = text.lastIndexOf(`</${tag.toLowerCase()}>`);
  return start > 0 && end >= start ? kml.slice(start, end) : "";
}

/** Position des nächsten `open` ab `from`, auf das kein weiteres Namenszeichen
 *  folgt (`<NetworkLink` passt so nicht auf `<NetworkLinkControl>`). */
function openingTagIndex(text: string, open: string, from: number): number {
  let at = text.indexOf(open, from);
  while (at >= 0 && /\w/.test(text.charAt(at + open.length))) {
    at = text.indexOf(open, at + 1);
  }
  return at;
}

// Nur ASCII, damit jede Position im Ergebnis der im Original entspricht
// (`toLowerCase` macht etwa aus „İ“ zwei Zeichen).
const asciiLowerCase = (text: string): string =>
  text.replace(/[A-Z]+/g, (letters) => letters.toLowerCase());
