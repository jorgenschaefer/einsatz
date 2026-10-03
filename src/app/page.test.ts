import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import { expectPublicPage } from "@/test/page-checks";
import Home from "./page";

expectPublicPage(Home);

describe("start page", () => {
  it("sends every caller to the overview", () => {
    expect(() => Home()).toThrow(
      expect.objectContaining({ redirectTo: "/operations" }),
    );
  });
});
