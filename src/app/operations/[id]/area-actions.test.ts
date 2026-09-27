import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const revalidatePath = vi.fn();
const publishOperationChanged = vi.fn();
const createArea = vi.fn();

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
vi.mock("@/server/areas/areas", () => ({
  createArea: (...args: unknown[]) => createArea(...args),
}));

import type { AreaGeometry } from "@/map/area";
import { ValidationError } from "@/server/validation";
import { createAreaAction } from "./area-actions";

const A_USER = { id: "u1", username: "anna", role: "user" as const };
const A_CIRCLE: AreaGeometry = {
  shape: "circle",
  center: { lat: 53.58, lng: 10.05 },
  radius: 250,
};

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue(A_USER);
  revalidatePath.mockReset();
  publishOperationChanged.mockReset();
  createArea.mockReset().mockResolvedValue({ id: "a9" });
});

describe("createAreaAction", () => {
  it("returns the id of the created area", async () => {
    const result = await createAreaAction("op-1", A_CIRCLE);

    expect(result).toEqual({ id: "a9" });
    expect(revalidatePath).toHaveBeenCalledWith("/operations/op-1");
    expect(publishOperationChanged).toHaveBeenCalledWith("op-1");
  });

  it("returns no id on a ValidationError", async () => {
    createArea.mockRejectedValueOnce(
      new ValidationError("Der Radius muss größer als 0 sein."),
    );
    const result = await createAreaAction("op-1", A_CIRCLE);

    expect(result).toEqual({ error: "Der Radius muss größer als 0 sein." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
