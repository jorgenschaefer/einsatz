import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";

vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: vi.fn(async () => null),
}));
vi.mock("./actions", () => ({ loginAction: vi.fn() }));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders no footer of its own, so only the global AppFooter shows one", async () => {
    render(await LoginPage());
    expect(screen.queryByRole("link", { name: "Impressum" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Datenschutzerklärung" }),
    ).toBeNull();
  });
});
