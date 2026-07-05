"use client";

import { useReducer } from "react";
import type { AreaShape } from "./area";
import type { SymbolComposition } from "./composition";

/**
 * Der eine, sich gegenseitig ausschließende Interaktionsmodus der Lagekarte: es
 * kann immer nur eines scharf sein – ein Kartenzeichen platzieren (Schnellauswahl
 * oder erweitert), ein Bild-Overlay per Griff bearbeiten oder einen Bereich
 * zeichnen bzw. neu zeichnen. Jeder Moduswechsel ersetzt den ganzen Zustand; die
 * gegenseitige Ausschließlichkeit ist damit strukturell garantiert (kein manuelles
 * Zurücksetzen der übrigen Modi je Handler mehr).
 */
export type MapMode =
  | { kind: "idle" }
  | { kind: "quick"; quickId: string }
  | { kind: "custom"; composition: SymbolComposition }
  | { kind: "imageEdit"; imageId: string }
  | { kind: "draw"; shape: AreaShape; redrawAreaId: string | null };

export type MapModeAction =
  | { type: "armQuick"; quickId: string | null }
  | { type: "armCustom"; composition: SymbolComposition }
  | { type: "armImageEdit"; imageId: string }
  | { type: "toggleDraw"; shape: AreaShape }
  | { type: "redraw"; shape: AreaShape; areaId: string }
  | { type: "reset" };

export function mapModeReducer(mode: MapMode, action: MapModeAction): MapMode {
  switch (action.type) {
    case "armQuick":
      return action.quickId
        ? { kind: "quick", quickId: action.quickId }
        : { kind: "idle" };
    case "armCustom":
      return { kind: "custom", composition: action.composition };
    case "armImageEdit":
      return { kind: "imageEdit", imageId: action.imageId };
    case "toggleDraw":
      // Erneuter Klick auf dieselbe Form entwaffnet (Toggle).
      return mode.kind === "draw" && mode.shape === action.shape
        ? { kind: "idle" }
        : { kind: "draw", shape: action.shape, redrawAreaId: null };
    case "redraw":
      return { kind: "draw", shape: action.shape, redrawAreaId: action.areaId };
    case "reset":
      return { kind: "idle" };
  }
}

export interface MapModeControls {
  armedQuickId: string | null;
  armedCustom: SymbolComposition | null;
  editingImageId: string | null;
  drawShape: AreaShape | null;
  redrawAreaId: string | null;
  armQuick: (quickId: string | null) => void;
  armCustom: (composition: SymbolComposition) => void;
  armImageEdit: (imageId: string) => void;
  toggleDraw: (shape: AreaShape) => void;
  redraw: (shape: AreaShape, areaId: string) => void;
  reset: () => void;
}

/** Hält den {@link MapMode} und liefert die abgeleiteten Flags samt Übergängen. */
export function useMapMode(): MapModeControls {
  const [mode, dispatch] = useReducer(mapModeReducer, { kind: "idle" });
  return {
    armedQuickId: mode.kind === "quick" ? mode.quickId : null,
    armedCustom: mode.kind === "custom" ? mode.composition : null,
    editingImageId: mode.kind === "imageEdit" ? mode.imageId : null,
    drawShape: mode.kind === "draw" ? mode.shape : null,
    redrawAreaId: mode.kind === "draw" ? mode.redrawAreaId : null,
    armQuick: (quickId) => dispatch({ type: "armQuick", quickId }),
    armCustom: (composition) => dispatch({ type: "armCustom", composition }),
    armImageEdit: (imageId) => dispatch({ type: "armImageEdit", imageId }),
    toggleDraw: (shape) => dispatch({ type: "toggleDraw", shape }),
    redraw: (shape, areaId) => dispatch({ type: "redraw", shape, areaId }),
    reset: () => dispatch({ type: "reset" }),
  };
}
