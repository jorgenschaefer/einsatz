import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const revalidatePath = vi.fn();
const publishOperationChanged = vi.fn();
const setKmlVisibility = vi.fn();
const deleteKmlOverlay = vi.fn();
const createKmlOverlay = vi.fn();
const reloadKmlOverlay = vi.fn();
const fetchKmlFromUrl = vi.fn();
const resolveKmlNetworkLinks = vi.fn();

vi.mock("@/server/auth/current-user", () => ({
  requireUser: () => requireUser(),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => ({ tag: "db" }) }));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: (id: string) => publishOperationChanged(id),
}));
vi.mock("@/server/kml/kml-overlays", () => ({
  setKmlVisibility: (...args: unknown[]) => setKmlVisibility(...args),
  deleteKmlOverlay: (...args: unknown[]) => deleteKmlOverlay(...args),
  createKmlOverlay: (...args: unknown[]) => createKmlOverlay(...args),
  reloadKmlOverlay: (...args: unknown[]) => reloadKmlOverlay(...args),
}));
vi.mock("@/server/kml/kml-fetch", () => ({
  enforceKmlSizeLimit: () => {},
  fetchKmlFromUrl: (...args: unknown[]) => fetchKmlFromUrl(...args),
  resolveKmlNetworkLinks: (...args: unknown[]) =>
    resolveKmlNetworkLinks(...args),
}));

import { ValidationError } from "@/server/validation";
import {
  addKmlFileAction,
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "./kml-actions";

const A_USER = { id: "u1", username: "anna", role: "user" as const };

const LOAD_FAILED = "KML konnte nicht geladen werden.";

beforeEach(() => {
  vi.restoreAllMocks();
  requireUser.mockReset().mockResolvedValue(A_USER);
  revalidatePath.mockReset();
  publishOperationChanged.mockReset();
  setKmlVisibility.mockReset().mockResolvedValue(undefined);
  deleteKmlOverlay.mockReset().mockResolvedValue(undefined);
  createKmlOverlay.mockReset().mockResolvedValue(undefined);
  reloadKmlOverlay.mockReset().mockResolvedValue(undefined);
  fetchKmlFromUrl.mockReset().mockResolvedValue("<kml/>");
  resolveKmlNetworkLinks
    .mockReset()
    .mockImplementation(async (content: string) => content);
});

// Die Actions mit eigener Meldung für unerwartete Fehler (Netzwerk, Parser).
describe.each([
  {
    name: "addKmlFileAction",
    call: () => addKmlFileAction("op-1", "Einsatzabschnitte", "<kml/>"),
    loader: createKmlOverlay,
  },
  {
    name: "addKmlUrlAction",
    call: () =>
      addKmlUrlAction("op-1", "Pegel", "https://example.org/pegel.kml"),
    loader: fetchKmlFromUrl,
  },
  {
    name: "reloadKmlAction",
    call: () => reloadKmlAction("op-1", "k1"),
    loader: reloadKmlOverlay,
  },
])("$name", ({ call, loader }) => {
  it("loads the KML, then revalidates the operation", async () => {
    const result = await call();

    expect(result).toEqual({});
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("shows a ValidationError's message and does not log it", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    loader.mockRejectedValueOnce(
      new ValidationError("Die KML-Datei ist zu groß."),
    );

    const result = await call();

    expect(result).toEqual({ error: "Die KML-Datei ist zu groß." });
    expect(errorLog).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the load failure message and logs an unexpected error", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const networkDown = new Error("ECONNRESET");
    loader.mockRejectedValueOnce(networkDown);

    const result = await call();

    expect(result).toEqual({ error: LOAD_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), networkDown);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("enforces the login before loading", async () => {
    requireUser.mockRejectedValueOnce(new Error("nicht angemeldet"));
    await expect(call()).rejects.toThrow();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe("addKmlUrlAction without a URL", () => {
  it("asks for a URL and creates nothing", async () => {
    const result = await addKmlUrlAction("op-1", "Pegel", "   ");

    expect(result).toEqual({ error: "Bitte eine KML-URL angeben." });
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(fetchKmlFromUrl).not.toHaveBeenCalled();
    expect(createKmlOverlay).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setKmlVisibilityAction", () => {
  it("requires a user, sets the visibility, then revalidates the operation", async () => {
    const result = await setKmlVisibilityAction("op-1", "k1", false);

    expect(result).toEqual({});
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(setKmlVisibility).toHaveBeenCalledWith({ tag: "db" }, "k1", false);
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("maps a business ValidationError to a form error and does not revalidate", async () => {
    setKmlVisibility.mockRejectedValueOnce(
      new ValidationError("Das Overlay existiert nicht mehr."),
    );
    const result = await setKmlVisibilityAction("op-1", "k1", true);
    expect(result).toEqual({ error: "Das Overlay existiert nicht mehr." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("enforces the login before mutating", async () => {
    requireUser.mockRejectedValueOnce(new Error("nicht angemeldet"));
    await expect(setKmlVisibilityAction("op-1", "k1", false)).rejects.toThrow();
    expect(setKmlVisibility).not.toHaveBeenCalled();
  });
});

describe("removeKmlAction", () => {
  it("requires a user, deletes the overlay, then revalidates the operation", async () => {
    const result = await removeKmlAction("op-1", "k1");

    expect(result).toEqual({});
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(deleteKmlOverlay).toHaveBeenCalledWith({ tag: "db" }, "k1");
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("maps a business ValidationError to a form error and does not revalidate", async () => {
    deleteKmlOverlay.mockRejectedValueOnce(
      new ValidationError("Das Overlay existiert nicht mehr."),
    );
    const result = await removeKmlAction("op-1", "k1");
    expect(result).toEqual({ error: "Das Overlay existiert nicht mehr." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("enforces the login before mutating", async () => {
    requireUser.mockRejectedValueOnce(new Error("nicht angemeldet"));
    await expect(removeKmlAction("op-1", "k1")).rejects.toThrow();
    expect(deleteKmlOverlay).not.toHaveBeenCalled();
  });
});
