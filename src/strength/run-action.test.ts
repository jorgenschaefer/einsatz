import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { runAction } from "./run-action";

describe("runAction", () => {
  async function run(action: () => Promise<ActionResult>) {
    const errors: (string | null)[] = [];
    const done = vi.fn();
    await runAction(action, (error) => errors.push(error), done);
    return { errors, done };
  }

  it("clears the error and is done once the action succeeds", async () => {
    const { errors, done } = await run(async () => ({}));

    expect(errors).toEqual([null]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("shows a returned error word for word and is not done", async () => {
    const { errors, done } = await run(async () => ({
      error: "Eine Stelle mit diesem Namen gibt es schon.",
    }));

    expect(errors).toEqual(["Eine Stelle mit diesem Namen gibt es schon."]);
    expect(done).not.toHaveBeenCalled();
  });

  it("shows a thrown failure as Speichern fehlgeschlagen and is not done", async () => {
    const { errors, done } = await run(async () => {
      throw new Error("offline");
    });

    expect(errors).toEqual([
      "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    ]);
    expect(done).not.toHaveBeenCalled();
  });
});
