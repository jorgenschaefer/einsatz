import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { extractKml } from "@/kml/kmz";
import { scriptedFetch } from "@/test/scripted-fetch";

const pinnedFetch = vi.fn();
vi.mock("@/server/kml/pinned-fetch", () => ({
  pinnedFetch: (...args: unknown[]) => pinnedFetch(...args),
}));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", username: "anna", role: "user" }),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => ({ tag: "db" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: () => {},
}));
vi.mock("@/server/kml/kml-overlays", () => ({
  createKmlOverlay: async () => {},
  reloadKmlOverlay: (
    _db: unknown,
    _id: string,
    fetcher: (url: string) => Promise<string>,
  ) => fetcher("http://93.184.216.34/x.kml"),
}));

import {
  addKmlFileAction,
  addKmlUrlAction,
  reloadKmlAction,
} from "./kml-actions";

// Groß genug, dass eine gewöhnliche Datei so lange braucht, dass die Last
// anderer Prozesse das Verhältnis kaum verschiebt.
const SIZE = 3_000_000;
const PLACEMARK =
  "<Placemark><name>Pegel</name><Point><coordinates>7.1,50.7</coordinates></Point></Placemark>\n";

const HREF_WITHOUT_END = `<href>${" ".repeat(20_000)}`;
const PIECES: [string, string][] = [
  ["<href> followed by 20,000 spaces without </href>", HREF_WITHOUT_END],
  [
    "the same <href> inside a closed NetworkLink",
    `<NetworkLink><Link>${HREF_WITHOUT_END}</Link></NetworkLink>`,
  ],
  ["10,000 unclosed <NetworkLink>", "<NetworkLink>".repeat(10_000)],
];
const UNCLOSED_DOCUMENTS = "<Document>".repeat(10_000);

/** KML of exactly SIZE bytes: Placemarks, then `piece`. */
function kmlOfSize(piece = ""): string {
  const head = '<kml xmlns="http://www.opengis.net/kml/2.2"><Folder>';
  const tail = "</Folder></kml>";
  const room = SIZE - head.length - tail.length - piece.length;
  const placemarks = PLACEMARK.repeat(Math.floor(room / PLACEMARK.length));
  return `${head}${placemarks}${" ".repeat(room - placemarks.length)}${piece}${tail}`;
}

const kmz = (kml: string): Uint8Array => zipSync({ "doc.kml": strToU8(kml) });

const serve = (body: (url: string) => string | Uint8Array) =>
  pinnedFetch.mockImplementation(scriptedFetch((url) => ({ body: body(url) })));

/** `prepare` sets up an import of the given KML and returns the step to time. */
async function expectAtMostTwiceOrdinary(
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

const expectAdded = async (result: Promise<unknown>) =>
  expect(await result).toEqual({});

const addFile = (kml: string) => () =>
  expectAdded(addKmlFileAction("op-1", "Abschnitte", kml));

const addByUrl = () =>
  expectAdded(addKmlUrlAction("op-1", "Pegel", "http://93.184.216.34/x.kml"));

const reload = () => expectAdded(reloadKmlAction("op-1", "k1"));

const serving =
  (body: (url: string) => string | Uint8Array, run: () => unknown) => () => {
    serve(body);
    return run();
  };

describe.each(PIECES)("KML containing %s", (_name, piece) => {
  it("is added as a file at most twice as slowly as ordinary KML", async () => {
    await expectAtMostTwiceOrdinary(addFile, piece);
  });

  it("is added by URL at most twice as slowly as ordinary KML", async () => {
    await expectAtMostTwiceOrdinary(
      (kml) => serving(() => kml, addByUrl),
      piece,
    );
  });

  it("is reloaded at most twice as slowly as ordinary KML", async () => {
    await expectAtMostTwiceOrdinary((kml) => serving(() => kml, reload), piece);
  });

  it("is added by URL as a KMZ at most twice as slowly as an ordinary KMZ", async () => {
    await expectAtMostTwiceOrdinary((kml) => {
      const body = kmz(kml);
      return serving(() => body, addByUrl);
    }, piece);
  });

  it("is unpacked by extractKml, as the browser does for a KMZ file, at most twice as slowly as an ordinary KMZ", async () => {
    await expectAtMostTwiceOrdinary((kml) => {
      const file = kmz(kml);
      return () => extractKml(file);
    }, piece);
  });
});

describe("NetworkLink targets containing 10,000 unclosed <Document>", () => {
  const link = (href: string) =>
    `<NetworkLink><Link><href>${href}</href></Link></NetworkLink>`;
  const myMaps = `<kml><Document>${link("http://93.184.216.34/a.kml")}${link(
    "http://93.184.216.34/b.kml",
  )}</Document></kml>`;
  const myMapsWithTargets = (target: string) => (url: string) =>
    url.endsWith("/a.kml") || url.endsWith("/b.kml") ? target : myMaps;

  it("are merged for a file at most twice as slowly as ordinary KML", async () => {
    await expectAtMostTwiceOrdinary(
      (target) => serving(myMapsWithTargets(target), addFile(myMaps)),
      UNCLOSED_DOCUMENTS,
    );
  });

  it("are merged for a URL at most twice as slowly as ordinary KML", async () => {
    await expectAtMostTwiceOrdinary(
      (target) => serving(myMapsWithTargets(target), addByUrl),
      UNCLOSED_DOCUMENTS,
    );
  });

  it("are merged on reload at most twice as slowly as ordinary KML", async () => {
    await expectAtMostTwiceOrdinary(
      (target) => serving(myMapsWithTargets(target), reload),
      UNCLOSED_DOCUMENTS,
    );
  });
});
