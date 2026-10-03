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
}));
vi.mock("./actions", () => ({ loginAction: vi.fn() }));

import type { ActAs } from "@/test/action-checks";
import { freshDb } from "@/test/db";
import { expectPublicPage } from "@/test/page-checks";
import { render, screen } from "@/test/render";
import { signIn } from "@/test/sign-in";
import LoginPage from "./page";

let db: Db;

const actAs: ActAs = async (caller) => {
  state.token = caller === "anonymous" ? undefined : await signIn(db, caller);
};

beforeEach(async () => {
  db = await freshDb();
  state.db = db;
  await actAs("anonymous");
});

expectPublicPage(LoginPage, { actAs });

describe("LoginPage", () => {
  it("sends a signed-in user to the overview", async () => {
    await actAs("user");
    await expect(LoginPage()).rejects.toMatchObject({
      redirectTo: "/operations",
    });
  });

  it("renders no footer of its own, so only the global AppFooter shows one", async () => {
    render(await LoginPage());
    expect(screen.queryByRole("link", { name: "Impressum" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Datenschutzerklärung" }),
    ).toBeNull();
  });
});
