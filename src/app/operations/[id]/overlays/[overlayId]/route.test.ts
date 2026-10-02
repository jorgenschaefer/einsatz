import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/pg", () => ({ getDb: () => ({}) }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: vi.fn() }));
vi.mock("@/server/image-overlays/image-overlays", () => ({
  getImageOverlay: vi.fn(),
}));
vi.mock("@/server/image-overlays/image-storage", () => ({
  readOverlayFile: vi.fn(async () => Buffer.from("webp-bytes")),
  overlayContentType: () => "image/webp",
}));

import { getImageOverlay } from "@/server/image-overlays/image-overlays";
import { GET } from "./route";

const call = () =>
  GET(new Request("http://localhost/"), {
    params: Promise.resolve({ id: "op-a", overlayId: "o1" }),
  });

describe("operation overlay route", () => {
  it("serves a hidden Bild-Overlay to the Lageansicht", async () => {
    vi.mocked(getImageOverlay).mockResolvedValue({
      id: "o1",
      operationId: "op-a",
      filePath: "op-a/o1.webp",
      visible: false,
    } as Awaited<ReturnType<typeof getImageOverlay>>);

    const res = await call();

    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("webp-bytes");
  });
});
