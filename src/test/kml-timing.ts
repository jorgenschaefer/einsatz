import { expect } from "vitest";

// Groß genug, dass eine gewöhnliche Datei so lange braucht, dass die Last
// anderer Prozesse das Verhältnis kaum verschiebt.
const SIZE = 3_000_000;
const PLACEMARK =
  "<Placemark><name>Pegel</name><Point><coordinates>7.1,50.7</coordinates></Point></Placemark>\n";

const HREF_WITHOUT_END = `<href>${" ".repeat(20_000)}`;

/** KML-Stücke, über die ein Scan mit Regexes quadratisch lange braucht. */
export const PATHOLOGICAL_PIECES: [name: string, piece: string][] = [
  ["<href> followed by 20,000 spaces without </href>", HREF_WITHOUT_END],
  [
    "the same <href> inside a closed NetworkLink",
    `<NetworkLink><Link>${HREF_WITHOUT_END}</Link></NetworkLink>`,
  ],
  [
    "the same <href> inside a closed IconStyle",
    `<IconStyle><Icon>${HREF_WITHOUT_END}</Icon></IconStyle>`,
  ],
  ["10,000 unclosed <NetworkLink>", "<NetworkLink>".repeat(10_000)],
];

export const UNCLOSED_DOCUMENTS = "<Document>".repeat(10_000);

/**
 * Misst den Schritt, den `prepare` für gewöhnliches KML liefert, gegen den für
 * gleich großes KML, das auf `piece` endet, und erwartet, dass der zweite
 * höchstens doppelt so lange braucht.
 */
export async function expectAtMostTwiceOrdinary(
  prepare: (kml: string) => () => unknown,
  piece: string,
) {
  const ordinary = kmlOfSize();
  const pathological = kmlOfSize(piece);
  expect(pathological.length).toBe(ordinary.length);

  const [ordinaryMs, pathologicalMs] = await alternatingMedianMs(
    prepare(ordinary),
    prepare(pathological),
  );

  expect(pathologicalMs).toBeLessThanOrEqual(2 * ordinaryMs);
}

/** KML aus genau SIZE Zeichen: Placemarks, dann `piece`. */
function kmlOfSize(piece = ""): string {
  const head = '<kml xmlns="http://www.opengis.net/kml/2.2"><Folder>';
  const tail = "</Folder></kml>";
  const room = SIZE - head.length - tail.length - piece.length;
  const placemarks = PLACEMARK.repeat(Math.floor(room / PLACEMARK.length));
  return `${head}${placemarks}${" ".repeat(room - placemarks.length)}${piece}${tail}`;
}

// Abwechselnd gemessen, damit fremde Last beide Seiten gleich trifft.
async function alternatingMedianMs(
  ...runs: (() => unknown)[]
): Promise<number[]> {
  const RUNS = 9;
  for (const run of runs) await run();
  const times = runs.map((): number[] => []);
  for (let i = 0; i < RUNS; i++) {
    for (const [r, run] of runs.entries()) {
      const start = performance.now();
      await run();
      times[r].push(performance.now() - start);
    }
  }
  return times.map((t) => t.sort((a, b) => a - b)[Math.floor(RUNS / 2)]);
}
