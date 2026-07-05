import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/pg", () => ({ getDb: () => ({}) }));
vi.mock("@/server/viewlinks/view-links", () => ({
  resolveViewAccess: vi.fn(),
}));
vi.mock("@/server/image-overlays/image-overlays", () => ({
  getImageOverlay: vi.fn(),
}));
vi.mock("@/server/image-overlays/image-storage", () => ({
  readOverlayFile: vi.fn(),
}));

import { getImageOverlay } from "@/server/image-overlays/image-overlays";
import { resolveViewAccess } from "@/server/viewlinks/view-links";
import { GET } from "./route";

const call = () =>
  GET(new Request("http://localhost/"), {
    params: Promise.resolve({ token: "tok", overlayId: "o1" }),
  });

describe("view overlay route", () => {
  it("returns 403 when the view token has no access", async () => {
    vi.mocked(resolveViewAccess).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns 404 when the overlay belongs to another Einsatz", async () => {
    vi.mocked(resolveViewAccess).mockResolvedValue({ operationId: "op-a" });
    vi.mocked(getImageOverlay).mockResolvedValue({
      id: "o1",
      operationId: "op-b",
      filePath: "op-b/o1.png",
    } as Awaited<ReturnType<typeof getImageOverlay>>);
    const res = await call();
    expect(res.status).toBe(404);
  });
});
