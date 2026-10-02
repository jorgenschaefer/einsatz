import { beforeEach, describe, expect, it, vi } from "vitest";

// Photon und die Zugangsprüfungen faken; die Grenzen laufen unverändert.
const photon = vi.hoisted(() => ({ calledAt: [] as number[] }));
vi.mock("@/server/geocoder/photon", () => ({
  photonGeocoder: {
    geocode: async () => {
      photon.calledAt.push(Date.now());
      return [{ label: "Rathaus", lat: 53.5, lng: 9.9 }];
    },
  },
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => ({}) }));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({}),
}));
vi.mock("@/server/viewlinks/view-links", () => ({
  resolveViewAccess: async () => ({ operationId: "op-a" }),
}));
vi.mock("@/server/mapsymbols/map-symbols", () => ({
  resolveDeviceAccess: async () => ({ operationId: "op-a" }),
}));

import { GET as deviceGeocode } from "@/app/device/[token]/geocode/route";
import { geocodeAddressAction } from "@/app/operations/[id]/geocode-actions";
import { GET as viewGeocode } from "@/app/view/[token]/geocode/route";

let start = Date.UTC(2026, 9, 3);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Jeder Test beginnt eine Stunde nach dem vorigen, so sind beide Gates frei.
  start += 3_600_000;
  vi.setSystemTime(start);
  photon.calledAt = [];
});

describe("address search limits towards Photon", () => {
  it("lets Ansichts- and Gerätelinks together search at most once in 3 seconds", async () => {
    expect(await search(viewGeocode, "Rathaus")).toHaveLength(1);

    at(1500);
    expect(await search(deviceGeocode, "Rathaus")).toEqual([]);
    expect(photon.calledAt).toHaveLength(1);

    at(3000);
    expect(await search(deviceGeocode, "Rathaus")).toHaveLength(1);
    expect(photon.calledAt).toHaveLength(2);
  });

  it("leaves logged-in users at least two thirds while token links search all the time", async () => {
    const tokenHitsAt: number[] = [];
    const loggedInHitsAt: number[] = [];

    for (let ms = 0; ms < 6000; ms += 500) {
      at(ms);
      const route = ms % 1000 === 0 ? viewGeocode : deviceGeocode;
      if ((await search(route, "Rathaus")).length > 0) tokenHitsAt.push(ms);
      if (ms % 1000 !== 0) continue;
      if ((await geocodeAddressAction("Rathaus")).length > 0)
        loggedInHitsAt.push(ms);
    }

    expect(gaps(photon.calledAt).every((gap) => gap >= 1000)).toBe(true);
    expect(gaps(tokenHitsAt).every((gap) => gap >= 3000)).toBe(true);
    expect(loggedInHitsAt.length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ["Ansichtslink", (q: string) => search(viewGeocode, q)],
    ["Gerätelink", (q: string) => search(deviceGeocode, q)],
    ["Lageansicht", (q: string) => geocodeAddressAction(q)],
  ])(
    "finds nothing for a query over 200 characters through the %s, without asking Photon or using up a slot",
    async (_, find) => {
      expect(await find("a".repeat(201))).toEqual([]);
      expect(photon.calledAt).toHaveLength(0);

      expect(await find("Rathaus")).toHaveLength(1);
    },
  );

  it("still asks Photon for a query of exactly 200 characters", async () => {
    expect(await search(viewGeocode, "a".repeat(200))).toHaveLength(1);
  });
});

async function search(
  route: typeof viewGeocode,
  q: string,
): Promise<unknown[]> {
  const res = await route(
    new Request(`http://localhost/?q=${encodeURIComponent(q)}`),
    { params: Promise.resolve({ token: "tok" }) },
  );
  return res.json();
}

function at(ms: number): void {
  vi.setSystemTime(start + ms);
}

function gaps(times: number[]): number[] {
  return times.slice(1).map((t, i) => t - times[i]);
}
