import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", username: "anna", role: "user" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

import { freshDb } from "@/test/db";
import LageansichtPage from "./page";

describe("Lageansicht page", () => {
  it("is not found for an id that is not a UUID", async () => {
    state.db = await freshDb();

    await expect(
      LageansichtPage({ params: Promise.resolve({ id: "marker-icon.png" }) }),
    ).rejects.toMatchObject({ notFound: true });
  });
});
