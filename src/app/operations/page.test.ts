import { beforeEach, vi } from "vitest";
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
}));

import type { ActAs } from "@/test/action-checks";
import { freshDb } from "@/test/db";
import { expectPageRequiresLogin } from "@/test/page-checks";
import { signIn } from "@/test/sign-in";
import OperationsPage from "./page";

let db: Db;

const actAs: ActAs = async (caller) => {
  state.token = caller === "anonymous" ? undefined : await signIn(db, caller);
};

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
});

expectPageRequiresLogin(OperationsPage, { actAs });
