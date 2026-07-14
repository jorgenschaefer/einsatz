import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const revalidatePath = vi.fn();
const publishOperationChanged = vi.fn();

vi.mock("@/server/auth/current-user", () => ({
  requireUser: () => requireUser(),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => ({ tag: "db" }) }));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: (id: string) => publishOperationChanged(id),
}));

import { ValidationError } from "@/server/validation";
import { operationAction, toFormError } from "./operation-action";

const A_USER = { id: "u1", username: "anna", role: "user" as const };

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue(A_USER);
  revalidatePath.mockReset();
  publishOperationChanged.mockReset();
});

describe("operationAction", () => {
  it("requires a user, runs the domain logic, then revalidates the operation", async () => {
    const run = vi.fn(async () => "op-1");
    const result = await operationAction(run);

    expect(result).toEqual({});
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ tag: "db" }, A_USER);
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("maps a business ValidationError to a form error and does not revalidate", async () => {
    const result = await operationAction(async () => {
      throw new ValidationError("Der Text darf nicht leer sein.");
    });
    expect(result).toEqual({ error: "Der Text darf nicht leer sein." });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(publishOperationChanged).not.toHaveBeenCalled();
  });

  it("rethrows unexpected (non-validation) errors", async () => {
    await expect(
      operationAction(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

describe("toFormError", () => {
  it("uses the ValidationError message and the fallback for anything else", () => {
    expect(toFormError(new ValidationError("zu groß"), "Fallback")).toEqual({
      error: "zu groß",
    });
    expect(toFormError(new Error("boom"), "Fallback")).toEqual({
      error: "Fallback",
    });
  });
});
