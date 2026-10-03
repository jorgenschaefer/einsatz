import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", username: "anna", role: "user" }),
}));
vi.mock("./actions", () => ({
  changePasswordAction: async () => ({}),
  logoutAction: async () => {},
  logoutOtherSessionsAction: async () => ({}),
}));

import { render, screen } from "@/test/render";
import AccountPage from "./page";

describe("account page", () => {
  it("offers to log out everywhere else", async () => {
    render(await AccountPage());
    expect(
      screen.getByRole("button", { name: "Überall abmelden" }),
    ).toBeVisible();
  });
});
