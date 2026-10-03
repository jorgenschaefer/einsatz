import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { ImagePlacement } from "@/map/image-overlay";

// Shared, mutable harness state. Read lazily by the mocks below, set per test.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));

// The trust/IO boundaries every action and route depends on, faked so the real
// auth logic (requireUser/requireAdmin/resolveDeviceAccess) runs unchanged.
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
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

import { GET as deviceEventsGET } from "@/app/device/[token]/events/route";
import { GET as deviceGeocodeGET } from "@/app/device/[token]/geocode/route";
import { POST as devicePositionPOST } from "@/app/device/[token]/position/route";
import { GET as operationEventsGET } from "@/app/operations/[id]/events/route";
import { geocodeAddressAction } from "@/app/operations/[id]/geocode-actions";
import {
  deleteImageOverlayAction,
  setImageOverlayVisibilityAction,
  updateImageOverlayPlacementAction,
} from "@/app/operations/[id]/image-overlay-actions";
import {
  addJournalEntryAction,
  annulEntryAction,
  correctEntryAction,
} from "@/app/operations/[id]/journal-actions";
import { POST as addKmlFilePOST } from "@/app/operations/[id]/kml/route";
import {
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "@/app/operations/[id]/kml-actions";
import {
  GET as operationOverlayGET,
  PUT as replaceImageOverlayPUT,
} from "@/app/operations/[id]/overlays/[overlayId]/route";
import { POST as addImageOverlayPOST } from "@/app/operations/[id]/overlays/route";
import {
  annulStrengthReportAction,
  correctStrengthReportAction,
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
  reportTotalStrengthAction,
} from "@/app/operations/[id]/strength-actions";
import { freshDb } from "@/test/db";

const expectRedirect = (fn: () => Promise<unknown>, to: string) =>
  expect(fn()).rejects.toMatchObject({ redirectTo: to });

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const req = (url = "http://localhost/") => new Request(url);

// Repräsentative Argumente; der Auth-Guard wirft, bevor sie ausgewertet werden.
const placement: ImagePlacement = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 1000,
  rotationDeg: 0,
  opacity: 1,
};
const upload = (method: "POST" | "PUT") =>
  new Request("http://localhost/", { method, body: new FormData() });

interface Invocation {
  name: string;
  run: () => Promise<unknown>;
}

// Die requireUser-geschützten Actions, deren Login-Pflicht noch nicht der Test
// ihres eigenen Moduls mit `expectEveryActionRequiresLogin` prüft.
const userGuardedActions: Invocation[] = [
  {
    name: "addKmlUrlAction",
    run: () => addKmlUrlAction("op-1", "n", "https://e.example/x.kml"),
  },
  {
    name: "setKmlVisibilityAction",
    run: () => setKmlVisibilityAction("op-1", "k-1", false),
  },
  { name: "reloadKmlAction", run: () => reloadKmlAction("op-1", "k-1") },
  { name: "removeKmlAction", run: () => removeKmlAction("op-1", "k-1") },
  {
    name: "updateImageOverlayPlacementAction",
    run: () => updateImageOverlayPlacementAction("op-1", "i-1", placement),
  },
  {
    name: "setImageOverlayVisibilityAction",
    run: () => setImageOverlayVisibilityAction("op-1", "i-1", false),
  },
  {
    name: "deleteImageOverlayAction",
    run: () => deleteImageOverlayAction("op-1", "i-1"),
  },
  {
    name: "addJournalEntryAction",
    run: () => addJournalEntryAction("op-1", { text: "Lage", ...NO_ROUTE }),
  },
  {
    name: "correctEntryAction",
    run: () => correctEntryAction("e-1", { text: "Korrektur", ...NO_ROUTE }),
  },
  { name: "annulEntryAction", run: () => annulEntryAction("e-1") },
  {
    name: "createStationAction",
    run: () => createStationAction("op-1", "UHSt 3"),
  },
  {
    name: "renameStationAction",
    run: () => renameStationAction("st-1", "UHSt 3 Nord"),
  },
  {
    name: "recordStrengthReportAction",
    run: () =>
      recordStrengthReportAction("st-1", {
        leaders: 0,
        subLeaders: 1,
        crew: 6,
        additionalPersonnel: 2,
        note: null,
      }),
  },
  {
    name: "correctStrengthReportAction",
    run: () =>
      correctStrengthReportAction("r-1", "st-1", {
        leaders: 0,
        subLeaders: 1,
        crew: 6,
        additionalPersonnel: 2,
        note: null,
      }),
  },
  {
    name: "annulStrengthReportAction",
    run: () => annulStrengthReportAction("r-1"),
  },
  {
    name: "reportTotalStrengthAction",
    run: () => reportTotalStrengthAction("op-1"),
  },
  { name: "geocodeAddressAction", run: () => geocodeAddressAction("Hamburg") },
];

// requireUser-geschützte Route-Handler (keine Token-Routen). Token-Routen
// (device/*) sind unten über ihren 403-Pfad abgedeckt.
const userGuardedRoutes: Invocation[] = [
  {
    name: "operation events GET",
    run: () => operationEventsGET(req(), params({ id: "op-1" })),
  },
  {
    name: "operation overlay GET",
    run: () =>
      operationOverlayGET(req(), params({ id: "op-1", overlayId: "ov-1" })),
  },
];

// Upload-Routen: Ohne Sitzung 401 statt Umleitung, weil `fetch` einer
// Umleitung samt Body folgen würde. Dass dabei kein Byte gelesen wird, prüft
// uploads.test.ts.
const sessionGuardedUploads: Invocation[] = [
  {
    name: "KML file POST",
    run: () => addKmlFilePOST(upload("POST"), params({ id: "op-1" })),
  },
  {
    name: "image overlay POST",
    run: () => addImageOverlayPOST(upload("POST"), params({ id: "op-1" })),
  },
  {
    name: "image overlay PUT",
    run: () =>
      replaceImageOverlayPUT(
        upload("PUT"),
        params({ id: "op-1", overlayId: "ov-1" }),
      ),
  },
];

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

describe("server action auth enforcement (requireUser)", () => {
  describe.each(userGuardedActions)("$name", ({ run }) => {
    it("redirects to /login when unauthenticated", async () => {
      await expectRedirect(run, "/login");
    });
  });
});

describe("route handler auth enforcement (requireUser)", () => {
  describe.each(userGuardedRoutes)("$name", ({ run }) => {
    it("redirects to /login when unauthenticated", async () => {
      await expectRedirect(run, "/login");
    });
  });
});

describe("upload route auth enforcement (401 without a session)", () => {
  describe.each(sessionGuardedUploads)("$name", ({ run }) => {
    it("answers 401 when unauthenticated", async () => {
      expect(await run()).toMatchObject({ status: 401 });
    });
  });
});

describe("token route auth enforcement (403, not session)", () => {
  it("device events route returns 403 without a valid token", async () => {
    const res = await deviceEventsGET(req(), params({ token: "bad" }));
    expect(res.status).toBe(403);
  });

  it("device geocode route returns 403 without a valid token", async () => {
    const res = await deviceGeocodeGET(req(), params({ token: "bad" }));
    expect(res.status).toBe(403);
  });

  it("device position route returns 403 without a valid token", async () => {
    const res = await devicePositionPOST(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ lat: 53.55, lng: 9.99 }),
      }),
      params({ token: "bad" }),
    );
    expect(res.status).toBe(403);
  });
});
