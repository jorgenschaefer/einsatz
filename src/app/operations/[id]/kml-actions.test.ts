import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  fetchedUrls: [] as string[],
  fetchError: undefined as Error | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<object>()),
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));
vi.mock("@/server/kml/kml-import", () => ({
  loadKmlFromUrl: async (url: string) => {
    state.fetchedUrls.push(url);
    if (state.fetchError) throw state.fetchError;
    return "<kml>neu</kml>";
  },
}));

import { subscribeOperation } from "@/server/events/operation-events";
import { createKmlOverlay, listKmlOverlays } from "@/server/kml/kml-overlays";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import {
  type Bad,
  INVALID_ID,
  idCalls,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./kml-actions";

const {
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} = actions;

const NOT_FOUND = "KML-Overlay nicht gefunden.";
const LOAD_FAILED = "KML konnte nicht geladen werden.";
const URL = "https://example.org/pegel.kml";

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};
const db = () => state.db as Db;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  state.fetchedUrls = [];
  state.fetchError = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

expectEveryActionRequiresLogin(actions, { actAs });

expectBadCallsRejected(
  actions,
  {
    addKmlUrlAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        addKmlUrlAction(NOT_A_UUID, "Pegel", URL),
      ),
      rejects("a name as a number", "Der Name muss Text sein.", (f) =>
        addKmlUrlAction(f.operationId, 7 as Bad, URL),
      ),
      rejects("a name of 201", tooLong("Der Name", "200"), (f) =>
        addKmlUrlAction(f.operationId, text(201), URL),
      ),
      rejects("a URL of null", "Die KML-URL muss Text sein.", (f) =>
        addKmlUrlAction(f.operationId, "Pegel", null as Bad),
      ),
      rejects("a URL of 2,001", tooLong("Die KML-URL", "2.000"), (f) =>
        addKmlUrlAction(
          f.operationId,
          "Pegel",
          `https://example.org/${text(2001 - 20)}`,
        ),
      ),
      rejects("a URL of blanks", "Bitte eine KML-URL angeben.", (f) =>
        addKmlUrlAction(f.operationId, "Pegel", "   "),
      ),
    ],
    setKmlVisibilityAction: [
      ...idCalls("kmlId", (op, id) => setKmlVisibilityAction(op, id, false)),
      rejects(
        'visible as "yes"',
        "Die Sichtbarkeit muss wahr oder falsch sein.",
        (f) => setKmlVisibilityAction(f.operationId, f.kmlId, "yes" as Bad),
      ),
    ],
    reloadKmlAction: idCalls("kmlId", reloadKmlAction),
    removeKmlAction: idCalls("kmlId", removeKmlAction),
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    addKmlUrlAction: "takes only the Einsatz-ID",
    setKmlVisibilityAction: {
      error: NOT_FOUND,
      call: (a, b) => setKmlVisibilityAction(b, a.kmlId, false),
    },
    reloadKmlAction: {
      error: NOT_FOUND,
      call: (a, b) => reloadKmlAction(b, a.kmlId),
    },
    removeKmlAction: {
      error: NOT_FOUND,
      call: (a, b) => removeKmlAction(b, a.kmlId),
    },
  },
  {
    db,
    actAs,
    nothingElseHappened: () => expect(state.fetchedUrls).toEqual([]),
  },
);

describe("addKmlUrlAction", () => {
  beforeEach(() => actAs("user"));

  it("adds the KML-Ebene fetched from the trimmed URL and tells open clients", async () => {
    const op = await anOperation();

    const { result, told } = await watching(op.id, () =>
      addKmlUrlAction(op.id, "Pegel", `  ${URL} `),
    );

    expect(result).toEqual({});
    expect(told).toBe(1);
    expect(state.fetchedUrls).toEqual([URL]);
    expect(await listKmlOverlays(db(), op.id)).toMatchObject([
      {
        name: "Pegel",
        sourceType: "url",
        sourceUrl: URL,
        content: "<kml>neu</kml>",
      },
    ]);
  });

  it("fetches a KML URL of 2,000 characters", async () => {
    const op = await anOperation();
    const url = `https://example.org/${text(2000 - 20)}`;

    expect(await addKmlUrlAction(op.id, "Pegel", url)).toEqual({});

    expect(state.fetchedUrls).toEqual([url]);
  });

  it.each<[string, string, unknown]>([
    ["as a number", "Die KML-URL muss Text sein.", 7],
    [
      "of 2,001 characters",
      tooLong("Die KML-URL", "2.000"),
      `https://example.org/${text(2001 - 20)}`,
    ],
    ["of blanks", "Bitte eine KML-URL angeben.", "   "],
  ])("rejects a KML URL %s before fetching it", async (_, error, url) => {
    const op = await anOperation();

    expect(await addKmlUrlAction(op.id, "Pegel", url as Bad)).toEqual({
      error,
    });

    expect(state.fetchedUrls).toEqual([]);
  });

  expectLoadingFailuresHandled((operationId) =>
    addKmlUrlAction(operationId, "Neu", URL),
  );
});

describe("reloadKmlAction", () => {
  beforeEach(() => actAs("user"));

  it("replaces the KML-Ebene's content with the one fetched again and tells open clients", async () => {
    const { op, kml } = await aKmlLayer();

    const { result, told } = await watching(op.id, () =>
      reloadKmlAction(op.id, kml.id),
    );

    expect(result).toEqual({});
    expect(told).toBe(1);
    expect(state.fetchedUrls).toEqual([URL]);
    expect(await listKmlOverlays(db(), op.id)).toEqual([
      { ...kml, content: "<kml>neu</kml>" },
    ]);
  });

  expectLoadingFailuresHandled(reloadKmlAction);
});

describe("setKmlVisibilityAction", () => {
  it("hides the KML-Ebene and tells open clients", async () => {
    await actAs("user");
    const { op, kml } = await aKmlLayer();

    const { result, told } = await watching(op.id, () =>
      setKmlVisibilityAction(op.id, kml.id, false),
    );

    expect(result).toEqual({});
    expect(told).toBe(1);
    expect(await listKmlOverlays(db(), op.id)).toEqual([
      { ...kml, visible: false },
    ]);
  });
});

describe("removeKmlAction", () => {
  it("removes the KML-Ebene and tells open clients", async () => {
    await actAs("user");
    const { op, kml } = await aKmlLayer();

    const { result, told } = await watching(op.id, () =>
      removeKmlAction(op.id, kml.id),
    );

    expect(result).toEqual({});
    expect(told).toBe(1);
    expect(await listKmlOverlays(db(), op.id)).toEqual([]);
  });
});

/**
 * Registers the tests of an action that loads a KML: its own message for an
 * unexpected error, and no fetch before the login.
 */
function expectLoadingFailuresHandled(
  call: (operationId: string, kmlId: string) => Promise<unknown>,
): void {
  it("shows a ValidationError of the loading, logs nothing and changes nothing", async () => {
    const { op, kml } = await aKmlLayer();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    state.fetchError = new ValidationError("Die KML-Datei ist zu groß.");

    const { result, told } = await watching(op.id, () => call(op.id, kml.id));

    expect(result).toEqual({ error: "Die KML-Datei ist zu groß." });
    expect(told).toBe(0);
    expect(errorLog).not.toHaveBeenCalled();
    expect(await listKmlOverlays(db(), op.id)).toEqual([kml]);
  });

  it("shows the load failure message, logs an unexpected error and changes nothing", async () => {
    const { op, kml } = await aKmlLayer();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const networkDown = new Error("ECONNRESET");
    state.fetchError = networkDown;

    const { result, told } = await watching(op.id, () => call(op.id, kml.id));

    expect(result).toEqual({ error: LOAD_FAILED });
    expect(told).toBe(0);
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), networkDown);
    expect(await listKmlOverlays(db(), op.id)).toEqual([kml]);
  });

  it("fetches nothing for an anonymous caller", async () => {
    const { op, kml } = await aKmlLayer();
    await actAs("anonymous");

    await expect(call(op.id, kml.id)).rejects.toMatchObject({
      redirectTo: "/login",
    });

    expect(state.fetchedUrls).toEqual([]);
  });
}

function anOperation() {
  return insertOperation(db(), { name: "Lage", description: null });
}

async function aKmlLayer() {
  const op = await anOperation();
  const kml = await createKmlOverlay(db(), {
    operationId: op.id,
    sourceType: "url",
    sourceUrl: URL,
    name: "Pegel",
    content: "<kml>alt</kml>",
  });
  return { op, kml };
}

/** Runs `run` and counts how often open clients of the Einsatz were told of a change. */
async function watching<T>(
  operationId: string,
  run: () => Promise<T>,
): Promise<{ result: T; told: number }> {
  let told = 0;
  const unsubscribe = subscribeOperation(operationId, () => {
    told += 1;
  });
  try {
    return { result: await run(), told };
  } finally {
    unsubscribe();
  }
}
