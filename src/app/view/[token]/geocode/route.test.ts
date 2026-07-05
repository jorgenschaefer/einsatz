import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/pg", () => ({ getDb: () => ({}) }));
vi.mock("@/server/viewlinks/view-links", () => ({
  resolveViewAccess: vi.fn(),
}));
vi.mock("@/server/geocoder/geocode-service", () => ({
  geocodeQuery: vi.fn(),
}));

import { geocodeQuery } from "@/server/geocoder/geocode-service";
import { resolveViewAccess } from "@/server/viewlinks/view-links";
import { GET } from "./route";

const call = (q = "hamburg") =>
  GET(new Request(`http://localhost/?q=${q}`), {
    params: Promise.resolve({ token: "tok" }),
  });

describe("view geocode route", () => {
  it("returns 403 when the view token has no access", async () => {
    vi.mocked(resolveViewAccess).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns geocoder hits when the token has access", async () => {
    vi.mocked(resolveViewAccess).mockResolvedValue({ operationId: "op-a" });
    vi.mocked(geocodeQuery).mockResolvedValue([
      { label: "Rathaus", lat: 53.5, lng: 9.9 },
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { label: "Rathaus", lat: 53.5, lng: 9.9 },
    ]);
  });
});
