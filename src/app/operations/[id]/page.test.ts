import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
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

import type { ActAs } from "@/test/action-checks";
import { freshDb } from "@/test/db";
import { expectPageRequiresLogin } from "@/test/page-checks";
import { signIn } from "@/test/sign-in";
import LageansichtPage from "./page";

let db: Db;

const actAs: ActAs = async (caller) => {
  state.token = caller === "anonymous" ? undefined : await signIn(db, caller);
};

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
});

expectPageRequiresLogin(LageansichtPage, {
  actAs,
  props: () => ({ params: Promise.resolve({ id: randomUUID() }) }),
});

describe("Lageansicht page", () => {
  it("is not found for an id that is not a UUID", async () => {
    await actAs("user");

    await expect(
      LageansichtPage({ params: Promise.resolve({ id: "marker-icon.png" }) }),
    ).rejects.toMatchObject({ notFound: true });
  });
});
