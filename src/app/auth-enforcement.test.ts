import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { AreaGeometry, AreaStyle } from "@/map/area";
import type { SymbolComposition } from "@/map/composition";
import type { ImagePlacement } from "@/map/image-overlay";
import type { MapView } from "@/map/view";
import type { Db } from "@/server/db/db";

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

import { changePasswordAction } from "@/app/account/actions";
import {
  createAccountAction,
  deleteAccountAction,
  resetPasswordAction,
  setRoleAction,
} from "@/app/admin/users/actions";
import { GET as deviceEventsGET } from "@/app/device/[token]/events/route";
import { GET as deviceGeocodeGET } from "@/app/device/[token]/geocode/route";
import { POST as devicePositionPOST } from "@/app/device/[token]/position/route";
import { setDefaultViewAction } from "@/app/operations/[id]/actions";
import {
  createAreaAction,
  deleteAreaAction,
  updateAreaGeometryAction,
  updateAreaStyleAction,
} from "@/app/operations/[id]/area-actions";
import { GET as operationEventsGET } from "@/app/operations/[id]/events/route";
import { geocodeAddressAction } from "@/app/operations/[id]/geocode-actions";
import {
  addImageOverlayAction,
  deleteImageOverlayAction,
  replaceImageOverlayFileAction,
  setImageOverlayVisibilityAction,
  updateImageOverlayPlacementAction,
} from "@/app/operations/[id]/image-overlay-actions";
import {
  addJournalEntryAction,
  annulEntryAction,
  correctEntryAction,
} from "@/app/operations/[id]/journal-actions";
import {
  addKmlFileAction,
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "@/app/operations/[id]/kml-actions";
import {
  deleteMapSymbolAction,
  generateDeviceLinkAction,
  moveMapSymbolAction,
  placeMapSymbolAction,
  updateMapSymbolCompositionAction,
} from "@/app/operations/[id]/map-symbol-actions";
import { GET as operationOverlayGET } from "@/app/operations/[id]/overlays/[overlayId]/route";
import {
  annulStrengthReportAction,
  correctStrengthReportAction,
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
  reportTotalStrengthAction,
} from "@/app/operations/[id]/strength-actions";
import {
  createViewLinkAction,
  deleteViewLinkAction,
} from "@/app/operations/[id]/view-link-actions";
import { createOperationAction } from "@/app/operations/actions";
import {
  closeOperationAction,
  deleteOperationAction,
  reopenOperationAction,
} from "@/app/operations/lifecycle-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { freshDb } from "@/test/db";

async function login(role: "admin" | "user"): Promise<string> {
  const db = state.db as Db;
  const user = await insertUser(db, {
    username: `u-${randomUUID().slice(0, 8)}`,
    passwordHash: await hashPassword("a-very-good-password"),
    role,
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}

const expectRedirect = (fn: () => Promise<unknown>, to: string) =>
  expect(fn()).rejects.toMatchObject({ redirectTo: to });

const params = <T>(value: T) => ({ params: Promise.resolve(value) });
const req = (url = "http://localhost/") => new Request(url);

// Repräsentative Argumente; der Auth-Guard wirft, bevor sie ausgewertet werden.
const geometry: AreaGeometry = {
  shape: "circle",
  center: { lat: 53.55, lng: 9.99 },
  radius: 100,
};
const style: AreaStyle = { color: "#e2001a", opacity: 0.4, label: "" };
const view: MapView = { lat: 53.55, lng: 9.99, zoom: 12 };
const placement: ImagePlacement = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 1000,
  rotationDeg: 0,
  opacity: 1,
};
const composition: SymbolComposition = {};
const file = () => new File([], "plan.png", { type: "image/png" });

interface Invocation {
  name: string;
  run: () => Promise<unknown>;
}

// PFLICHT: Jede neue mutierende Server-Action MUSS hier eingetragen werden – die
// Liste ist die bewusst manuell gepflegte, vollständige Bestandsaufnahme aller
// requireUser-geschützten Actions. Ohne Eintrag prüft kein Test ihren Guard.
const userGuardedActions: Invocation[] = [
  {
    name: "createOperationAction",
    run: () => createOperationAction({}, new FormData()),
  },
  {
    name: "setDefaultViewAction",
    run: () => setDefaultViewAction("op-1", view),
  },
  { name: "createAreaAction", run: () => createAreaAction("op-1", geometry) },
  {
    name: "updateAreaStyleAction",
    run: () => updateAreaStyleAction("op-1", "a-1", style),
  },
  {
    name: "updateAreaGeometryAction",
    run: () => updateAreaGeometryAction("op-1", "a-1", geometry),
  },
  { name: "deleteAreaAction", run: () => deleteAreaAction("op-1", "a-1") },
  {
    name: "placeMapSymbolAction",
    run: () => placeMapSymbolAction("op-1", composition, 53.55, 9.99),
  },
  {
    name: "moveMapSymbolAction",
    run: () => moveMapSymbolAction("op-1", "s-1", 53.55, 9.99),
  },
  {
    name: "updateMapSymbolCompositionAction",
    run: () => updateMapSymbolCompositionAction("op-1", "s-1", composition),
  },
  {
    name: "deleteMapSymbolAction",
    run: () => deleteMapSymbolAction("op-1", "s-1"),
  },
  {
    name: "generateDeviceLinkAction",
    run: () => generateDeviceLinkAction("op-1", "s-1"),
  },
  {
    name: "addKmlFileAction",
    run: () => addKmlFileAction("op-1", "n", "<kml/>"),
  },
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
    name: "addImageOverlayAction",
    run: () =>
      addImageOverlayAction("op-1", file(), {
        lat: 53.55,
        lng: 9.99,
        widthM: 4000,
        heightM: 3000,
      }),
  },
  {
    name: "replaceImageOverlayFileAction",
    run: () => replaceImageOverlayFileAction("op-1", "i-1", file()),
  },
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
    name: "createViewLinkAction",
    run: () => createViewLinkAction("op-1", "Leitstelle"),
  },
  {
    name: "deleteViewLinkAction",
    run: () => deleteViewLinkAction("op-1", "v-1"),
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
  { name: "closeOperationAction", run: () => closeOperationAction("op-1") },
  { name: "reopenOperationAction", run: () => reopenOperationAction("op-1") },
  { name: "deleteOperationAction", run: () => deleteOperationAction("op-1") },
  { name: "geocodeAddressAction", run: () => geocodeAddressAction("Hamburg") },
  {
    name: "changePasswordAction",
    run: () => changePasswordAction({}, new FormData()),
  },
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

// Nutzerverwaltung: requireAdmin. Anonym → /login, angemeldet ohne Admin → /operations.
const adminGuardedActions: Invocation[] = [
  {
    name: "createAccountAction",
    run: () => createAccountAction("neu", "a-very-good-password", false),
  },
  { name: "setRoleAction", run: () => setRoleAction("id", "user") },
  {
    name: "resetPasswordAction",
    run: () => resetPasswordAction("id", "a-very-good-password"),
  },
  { name: "deleteAccountAction", run: () => deleteAccountAction("id") },
];

// Bewusste Ausnahmen (kein requireUser, daher nicht in der Tabelle):
// - logoutAction löscht nur das eigene Cookie des Aufrufers und ist anonym
//   erlaubt (endet mit redirect("/login") als regulärer Abmelde-Ablauf, nicht
//   als Auth-Guard);
// - loginAction ist der Anmelde-Einstieg selbst – sie erzeugt die Session und
//   ist naturgemäß unauthentifiziert erreichbar (durch das Rate-Limit geschützt).

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

describe("admin action auth enforcement (requireAdmin)", () => {
  describe.each(adminGuardedActions)("$name", ({ run }) => {
    it("redirects an anonymous caller to /login", async () => {
      await expectRedirect(run, "/login");
    });
    it("redirects a non-admin to /operations", async () => {
      state.token = await login("user");
      await expectRedirect(run, "/operations");
    });
  });

  it("createAccountAction succeeds for an admin", async () => {
    state.token = await login("admin");
    expect(
      await createAccountAction("neu", "a-very-good-password", false),
    ).toEqual({});
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
