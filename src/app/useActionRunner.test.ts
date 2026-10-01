import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { redirectError } from "@/test/redirect-error";
import { useActionRunner } from "./useActionRunner";

async function runOnce(action: () => Promise<ActionResult>) {
  const { result } = renderHook(() => useActionRunner());
  let returned: ActionResult | null | undefined;
  await act(async () => {
    returned = await result.current.run(action);
  });
  return { returned, state: result.current };
}

describe("useActionRunner", () => {
  it("is idle without an error before anything runs", () => {
    const { result } = renderHook(() => useActionRunner());

    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("is busy while the action runs", async () => {
    const { result } = renderHook(() => useActionRunner());

    act(() => {
      void result.current.run(() => new Promise<ActionResult>(() => {}));
    });

    expect(result.current.busy).toBe(true);
  });

  it("clears an earlier error as soon as the action starts", () => {
    const { result } = renderHook(() => useActionRunner());
    act(() => result.current.setError("Früherer Fehler."));

    act(() => {
      void result.current.run(() => new Promise<ActionResult>(() => {}));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(true);
  });

  it("hands back a success and clears an earlier error", async () => {
    const { result } = renderHook(() => useActionRunner());
    act(() => result.current.setError("Früherer Fehler."));
    let returned: ActionResult | null = null;

    await act(async () => {
      returned = await result.current.run(async () => ({}));
    });

    expect(returned).toEqual({});
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("shows a returned error and hands it back", async () => {
    const { returned, state } = await runOnce(async () => ({
      error: "KML konnte nicht geladen werden (404).",
    }));

    expect(returned).toEqual({
      error: "KML konnte nicht geladen werden (404).",
    });
    expect(state.error).toBe("KML konnte nicht geladen werden (404).");
    expect(state.busy).toBe(false);
  });

  it("turns a thrown failure into the failure message", async () => {
    const { returned, state } = await runOnce(async () => {
      throw new Error("offline");
    });

    expect(returned).toEqual({
      error: "Das hat nicht geklappt. Bitte erneut versuchen.",
    });
    expect(state.error).toBe("Das hat nicht geklappt. Bitte erneut versuchen.");
    expect(state.busy).toBe(false);
  });

  it("stays busy without a message while a redirect navigates away", async () => {
    const { returned, state } = await runOnce(async () => {
      throw redirectError();
    });

    expect(returned).toBeNull();
    expect(state.error).toBeNull();
    expect(state.busy).toBe(true);
  });
});
