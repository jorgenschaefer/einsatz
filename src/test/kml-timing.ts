import { expect } from "vitest";

// Linear braucht ein Scan über eines dieser Stücke etwa 10 ms, unter voller
// Last bis 500 ms; quadratisch braucht er 3 s, die früheren Regexes 5 s bis
// gar kein Ende. Eine feste Grenze dazwischen genügt, ohne Polster,
// Wiederholungen oder Vergleichsmessung.
const BUDGET_MS = 1_500;

const HREF_WITHOUT_END = `<href>${" ".repeat(100_000)}`;

/** KML-Stücke, über die ein Scan mit Regexes quadratisch lange braucht. */
export const PATHOLOGICAL_PIECES: [name: string, piece: string][] = [
  ["<href> followed by 100,000 spaces without </href>", HREF_WITHOUT_END],
  [
    "the same <href> inside a closed NetworkLink",
    `<NetworkLink><Link>${HREF_WITHOUT_END}</Link></NetworkLink>`,
  ],
  [
    "the same <href> inside a closed IconStyle",
    `<IconStyle><Icon>${HREF_WITHOUT_END}</Icon></IconStyle>`,
  ],
  ["50,000 unclosed <NetworkLink>", "<NetworkLink>".repeat(50_000)],
];

export const UNCLOSED_DOCUMENTS = "<Document>".repeat(50_000);

/** Ein minimales KML-Dokument mit `piece` als letztem Inhalt seines `<Folder>`. */
export const kmlEndingWith = (piece: string): string =>
  `<kml xmlns="http://www.opengis.net/kml/2.2"><Folder>${piece}</Folder></kml>`;

/** Erwartet, dass `run` in linearer Zeit fertig wird: in höchstens BUDGET_MS. */
export function expectLinearTime(run: () => unknown) {
  const start = performance.now();
  run();
  expect(performance.now() - start).toBeLessThanOrEqual(BUDGET_MS);
}
