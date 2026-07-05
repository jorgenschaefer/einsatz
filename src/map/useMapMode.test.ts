import { describe, expect, it } from "vitest";
import type { SymbolComposition } from "./composition";
import { type MapMode, mapModeReducer } from "./useMapMode";

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
});
