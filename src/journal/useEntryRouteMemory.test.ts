import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@/test/render";
import { rememberEntryRoute } from "./entry-route-storage";
import { useEntryRouteMemory } from "./useEntryRouteMemory";

const NOTHING = { sender: {}, recipient: {} };
const RTW = { sender: "UHSt 2", recipient: "EAL", channel: "Telefon" };

function renderMemory(operationId = "op-1") {
  return renderHook((id: string) => useEntryRouteMemory(id), {
    initialProps: operationId,
  });
}

describe("useEntryRouteMemory", () => {
  afterEach(() => vi.restoreAllMocks());

  it("remembers each new entry's Von, An and Weg at once, as the latest use", () => {
    const { result } = renderMemory();

    act(() => result.current.remember(RTW));
    act(() =>
      result.current.remember({
        sender: "EAL",
        recipient: "UHSt 2",
        channel: null,
      }),
    );

    expect(result.current.remembered).toEqual({
      sender: { "uhst 2": 1, eal: 2 },
      recipient: { eal: 1, "uhst 2": 2 },
      channel: null,
    });
  });

  it.each(["Telefon", "Melder"])(
    "reads what this device remembered once mounted, like after a reload, with the Weg %s",
    (channel) => {
      rememberEntryRoute("op-1", { ...RTW, channel });

      const { result } = renderMemory();

      expect(result.current.remembered).toEqual({
        sender: { "uhst 2": 1 },
        recipient: { eal: 1 },
        channel,
      });
    },
  );

  it("remembers nothing in the server render, whatever is stored", () => {
    rememberEntryRoute("op-1", RTW);
    function Remembered() {
      return JSON.stringify(useEntryRouteMemory("op-1").remembered);
    }

    const server = document.createElement("div");
    server.innerHTML = renderToString(createElement(Remembered));

    expect(JSON.parse(server.textContent ?? "")).toEqual(NOTHING);
  });

  it("keeps each Gesamteinsatz apart", () => {
    const { result, rerender } = renderMemory("op-1");
    act(() => result.current.remember(RTW));

    rerender("op-2");

    expect(result.current.remembered).toEqual(NOTHING);
    act(() => result.current.remember({ ...RTW, sender: "Leitstelle" }));
    rerender("op-1");
    expect(result.current.remembered.sender).toEqual({ "uhst 2": 1 });
  });

  it("remembers nothing and throws nothing without browser storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderMemory();

    act(() => result.current.remember(RTW));

    expect(result.current.remembered).toEqual(NOTHING);
  });
});
