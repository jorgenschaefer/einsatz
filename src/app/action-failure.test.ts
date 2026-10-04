import { describe, expect, it } from "vitest";
import { redirectError } from "@/test/redirect-error";
import { isNextNavigation, settleAction } from "./action-failure";

describe("settleAction", () => {
  it("hands back what the action returns", async () => {
    expect(await settleAction(async () => ({ error: "Kaputt." }))).toEqual({
      error: "Kaputt.",
    });
  });

  it("turns a thrown failure into the failure message", async () => {
    const settled = await settleAction(async () => {
      throw new Error("offline");
    });

    expect(settled).toEqual({
      error: "Das hat nicht geklappt. Bitte erneut versuchen.",
    });
  });

  it("hands back null while a redirect navigates away", async () => {
    expect(
      await settleAction(async () => {
        throw redirectError();
      }),
    ).toBeNull();
  });
});

describe("isNextNavigation", () => {
  it("recognises a redirect", () => {
    expect(isNextNavigation(redirectError())).toBe(true);
  });

  it("does not take any other failure for a navigation", () => {
    expect(isNextNavigation(new Error("NEXT_REDIRECT"))).toBe(false);
    expect(isNextNavigation(undefined)).toBe(false);
  });
});
