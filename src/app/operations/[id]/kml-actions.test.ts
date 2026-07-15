import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const revalidatePath = vi.fn();
const publishOperationChanged = vi.fn();
const setKmlVisibility = vi.fn();
const deleteKmlOverlay = vi.fn();

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
vi.mock("@/server/kml/kml-overlays", () => ({
  setKmlVisibility: (...args: unknown[]) => setKmlVisibility(...args),
  deleteKmlOverlay: (...args: unknown[]) => deleteKmlOverlay(...args),
}));

import { ValidationError } from "@/server/validation";
import { removeKmlAction, setKmlVisibilityAction } from "./kml-actions";

const A_USER = { id: "u1", username: "anna", role: "user" as const };

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue(A_USER);
  revalidatePath.mockReset();
  publishOperationChanged.mockReset();
  setKmlVisibility.mockReset().mockResolvedValue(undefined);
  deleteKmlOverlay.mockReset().mockResolvedValue(undefined);
});

describe("setKmlVisibilityAction", () => {
  it("requires a user, sets the visibility, then revalidates the operation", async () => {
    const result = await setKmlVisibilityAction("op-1", "k1", false);

    expect(result).toEqual({});
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(setKmlVisibility).toHaveBeenCalledWith({ tag: "db" }, "k1", false);
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("maps a business ValidationError to a form error and does not revalidate", async () => {
    setKmlVisibility.mockRejectedValueOnce(
      new ValidationError("Das Overlay existiert nicht mehr."),
    );
    const result = await setKmlVisibilityAction("op-1", "k1", true);
    expect(result).toEqual({ error: "Das Overlay existiert nicht mehr." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("enforces the login before mutating", async () => {
    requireUser.mockRejectedValueOnce(new Error("nicht angemeldet"));
    await expect(setKmlVisibilityAction("op-1", "k1", false)).rejects.toThrow();
    expect(setKmlVisibility).not.toHaveBeenCalled();
  });
});

describe("removeKmlAction", () => {
  it("requires a user, deletes the overlay, then revalidates the operation", async () => {
    const result = await removeKmlAction("op-1", "k1");

    expect(result).toEqual({});
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(deleteKmlOverlay).toHaveBeenCalledWith({ tag: "db" }, "k1");
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("maps a business ValidationError to a form error and does not revalidate", async () => {
    deleteKmlOverlay.mockRejectedValueOnce(
      new ValidationError("Das Overlay existiert nicht mehr."),
    );
    const result = await removeKmlAction("op-1", "k1");
    expect(result).toEqual({ error: "Das Overlay existiert nicht mehr." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("enforces the login before mutating", async () => {
    requireUser.mockRejectedValueOnce(new Error("nicht angemeldet"));
    await expect(removeKmlAction("op-1", "k1")).rejects.toThrow();
    expect(deleteKmlOverlay).not.toHaveBeenCalled();
  });
});
