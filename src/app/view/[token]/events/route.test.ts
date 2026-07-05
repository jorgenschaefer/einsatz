import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/pg", () => ({ getDb: () => ({}) }));
vi.mock("@/server/viewlinks/view-links", () => ({
  resolveViewAccess: vi.fn(),
}));

import { resolveViewAccess } from "@/server/viewlinks/view-links";
import { GET } from "./route";

const call = () =>
  GET(new Request("http://localhost/"), {
    params: Promise.resolve({ token: "tok" }),
  });

describe("view events route", () => {
  it("returns 403 when the view token has no access", async () => {
    vi.mocked(resolveViewAccess).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
  });
});
