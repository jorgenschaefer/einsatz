import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SymbolComposition } from "./composition";
import {
  type MapMode,
  type MapModeAction,
  type MapModeControls,
  mapModeReducer,
  useMapMode,
} from "./useMapMode";

const idle: MapMode = { kind: "idle" };
const comp: SymbolComposition = {
  grundzeichen: "ortsfeste-stelle",
  organisation: "hilfsorganisation",
};

describe("mapModeReducer", () => {
  it("arms and disarms the quick selection", () => {
    expect(mapModeReducer(idle, { type: "armQuick", quickId: "ktw" })).toEqual({
      kind: "quick",
      quickId: "ktw",
    });
    expect(
      mapModeReducer(
        { kind: "quick", quickId: "ktw" },
        { type: "armQuick", quickId: null },
      ),
    ).toEqual(idle);
  });

  it("each arm replaces the previous mode, so only one is ever active", () => {
    let mode = mapModeReducer(idle, { type: "armImageEdit", imageId: "i1" });
    expect(mode).toEqual({ kind: "imageEdit", imageId: "i1" });
    mode = mapModeReducer(mode, {
      type: "redraw",
      shape: "polygon",
      areaId: "a1",
    });
    expect(mode).toEqual({
      kind: "draw",
      shape: "polygon",
      redrawAreaId: "a1",
    });
    mode = mapModeReducer(mode, { type: "armCustom", composition: comp });
    expect(mode).toEqual({ kind: "custom", composition: comp });
  });

  it("toggles a draw shape off when armed again, and switches shape otherwise", () => {
    const poly = mapModeReducer(idle, { type: "toggleDraw", shape: "polygon" });
    expect(poly).toEqual({
      kind: "draw",
      shape: "polygon",
      redrawAreaId: null,
    });
    expect(
      mapModeReducer(poly, { type: "toggleDraw", shape: "polygon" }),
    ).toEqual(idle);
    expect(mapModeReducer(poly, { type: "toggleDraw", shape: "line" })).toEqual(
      { kind: "draw", shape: "line", redrawAreaId: null },
    );
  });

  it("toggling the same shape while redrawing it also disarms", () => {
    const redrawing: MapMode = {
      kind: "draw",
      shape: "polygon",
      redrawAreaId: "a1",
    };
    expect(
      mapModeReducer(redrawing, { type: "toggleDraw", shape: "polygon" }),
    ).toEqual(idle);
  });

  it("resets any mode back to idle", () => {
    expect(
      mapModeReducer({ kind: "quick", quickId: "x" }, { type: "reset" }),
    ).toEqual(idle);
  });

  describe("moving a circle", () => {
    const moving: MapMode = { kind: "moveCircle", areaId: "c1" };

    it("arms moving a circle", () => {
      expect(
        mapModeReducer(idle, { type: "armMoveCircle", areaId: "c1" }),
      ).toEqual(moving);
    });

    it.each<[string, MapModeAction]>([
      ["drawing", { type: "toggleDraw", shape: "circle" }],
      ["redrawing", { type: "redraw", shape: "circle", areaId: "c1" }],
      ["the quick selection", { type: "armQuick", quickId: "ktw" }],
      ["a custom symbol", { type: "armCustom", composition: comp }],
      ["an image edit", { type: "armImageEdit", imageId: "i1" }],
    ])("arming %s replaces moving", (_, action) => {
      const mode = mapModeReducer(moving, action);
      expect(mode.kind).not.toBe("moveCircle");
      expect(mode.kind).not.toBe("idle");
    });

    it("arming moving replaces drawing", () => {
      expect(
        mapModeReducer(
          { kind: "draw", shape: "polygon", redrawAreaId: null },
          { type: "armMoveCircle", areaId: "c1" },
        ),
      ).toEqual(moving);
    });

    it("ending the move of that circle ends moving", () => {
      expect(
        mapModeReducer(moving, { type: "endMoveCircle", areaId: "c1" }),
      ).toEqual(idle);
    });

    it("ending the move of a circle leaves any other mode alone", () => {
      const drawing: MapMode = {
        kind: "draw",
        shape: "polygon",
        redrawAreaId: null,
      };
      const other: MapMode = { kind: "moveCircle", areaId: "c2" };
      for (const mode of [drawing, other, idle]) {
        expect(
          mapModeReducer(mode, { type: "endMoveCircle", areaId: "c1" }),
        ).toBe(mode);
      }
    });

    it("reset ends moving", () => {
      expect(mapModeReducer(moving, { type: "reset" })).toEqual(idle);
    });
  });
});

describe("useMapMode", () => {
  const renderMode = () => {
    const onTransition = vi.fn();
    const { result } = renderHook(() => useMapMode({ onTransition }));
    const perform = (step: (mode: MapModeControls) => void) =>
      act(() => step(result.current));
    return { result, onTransition, perform };
  };

  it.each<[string, (mode: MapModeControls) => void]>([
    ["arming a quick symbol", (m) => m.armQuick("ktw")],
    ["disarming the quick selection", (m) => m.armQuick(null)],
    ["arming a custom symbol", (m) => m.armCustom(comp)],
    ["editing an image", (m) => m.armImageEdit("i1")],
    ["toggling a draw shape", (m) => m.toggleDraw("polygon")],
    ["redrawing", (m) => m.redraw("polygon", "a1")],
    ["moving a circle", (m) => m.armMoveCircle("c1")],
    ["resetting", (m) => m.reset()],
  ])("reports a transition when %s", (_, step) => {
    const { onTransition, perform } = renderMode();
    perform(step);
    expect(onTransition).toHaveBeenCalledOnce();
  });

  it("ends any mode quietly when the map is hidden", () => {
    const { result, onTransition, perform } = renderMode();
    perform((m) => m.armMoveCircle("c1"));
    onTransition.mockClear();

    perform((m) => m.endForHiddenMap());

    expect(result.current.movingCircleId).toBeNull();
    expect(onTransition).not.toHaveBeenCalled();
  });

  it("ends moving a circle quietly", () => {
    const { result, onTransition, perform } = renderMode();
    perform((m) => m.armMoveCircle("c1"));
    onTransition.mockClear();

    perform((m) => m.endMoveCircle("c1"));

    expect(result.current.movingCircleId).toBeNull();
    expect(onTransition).not.toHaveBeenCalled();
  });
});
