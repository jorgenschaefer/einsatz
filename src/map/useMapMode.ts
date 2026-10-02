"use client";

import { useReducer } from "react";
import type { AreaShape } from "./area";
import type { SymbolComposition } from "./composition";

/**
 * Der eine, sich gegenseitig ausschließende Interaktionsmodus der Lagekarte: es
 * kann immer nur eines scharf sein – ein Kartenzeichen platzieren (Schnellauswahl
 * oder erweitert), ein Bild-Overlay per Griff bearbeiten, einen Bereich
 * zeichnen bzw. neu zeichnen oder einen Kreis unter dem Fadenkreuz verschieben.
 * Jeder Moduswechsel ersetzt den ganzen Zustand; die gegenseitige
 * Ausschließlichkeit ist damit strukturell garantiert (kein manuelles
 * Zurücksetzen der übrigen Modi je Handler mehr).
 */
export type MapMode =
  | { kind: "idle" }
  | { kind: "quick"; quickId: string }
  | { kind: "custom"; composition: SymbolComposition }
  | { kind: "imageEdit"; imageId: string }
  | { kind: "draw"; shape: AreaShape; redrawAreaId: string | null }
  | { kind: "moveCircle"; areaId: string };

export type MapModeAction =
  | { type: "armQuick"; quickId: string | null }
  | { type: "armCustom"; composition: SymbolComposition }
  | { type: "armImageEdit"; imageId: string }
  | { type: "toggleDraw"; shape: AreaShape }
  | { type: "redraw"; shape: AreaShape; areaId: string }
  | { type: "armMoveCircle"; areaId: string }
  | { type: "endMoveCircle"; areaId: string }
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
    case "armMoveCircle":
      return { kind: "moveCircle", areaId: action.areaId };
    case "endMoveCircle":
      // Only while this very circle is still being moved; a mode started
      // meanwhile stays.
      return mode.kind === "moveCircle" && mode.areaId === action.areaId
        ? { kind: "idle" }
        : mode;
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
  movingCircleId: string | null;
  armQuick: (quickId: string | null) => void;
  armCustom: (composition: SymbolComposition) => void;
  armImageEdit: (imageId: string) => void;
  toggleDraw: (shape: AreaShape) => void;
  redraw: (shape: AreaShape, areaId: string) => void;
  armMoveCircle: (areaId: string) => void;
  endMoveCircle: (areaId: string) => void;
  reset: () => void;
  endForHiddenMap: () => void;
}

/**
 * Hält den {@link MapMode} und liefert die abgeleiteten Flags samt Übergängen.
 * Jeder Übergang, den der Nutzer auslöst, meldet `onTransition`. Still enden
 * der Modus beim Ausblenden der Karte und das Verschieben eines Kreises: Das
 * endet nach gespeichertem „Hier setzen“ oder weil der Kreis anderswo gelöscht
 * wurde, und Letzteres darf die Meldung zu einem gescheiterten „Hier setzen“
 * nicht schließen.
 */
export function useMapMode({
  onTransition,
}: {
  onTransition: () => void;
}): MapModeControls {
  const [mode, dispatch] = useReducer(mapModeReducer, { kind: "idle" });
  const transition = (action: MapModeAction) => {
    onTransition();
    dispatch(action);
  };
  return {
    armedQuickId: mode.kind === "quick" ? mode.quickId : null,
    armedCustom: mode.kind === "custom" ? mode.composition : null,
    editingImageId: mode.kind === "imageEdit" ? mode.imageId : null,
    drawShape: mode.kind === "draw" ? mode.shape : null,
    redrawAreaId: mode.kind === "draw" ? mode.redrawAreaId : null,
    movingCircleId: mode.kind === "moveCircle" ? mode.areaId : null,
    armQuick: (quickId) => transition({ type: "armQuick", quickId }),
    armCustom: (composition) => transition({ type: "armCustom", composition }),
    armImageEdit: (imageId) => transition({ type: "armImageEdit", imageId }),
    toggleDraw: (shape) => transition({ type: "toggleDraw", shape }),
    redraw: (shape, areaId) => transition({ type: "redraw", shape, areaId }),
    armMoveCircle: (areaId) => transition({ type: "armMoveCircle", areaId }),
    endMoveCircle: (areaId) => dispatch({ type: "endMoveCircle", areaId }),
    reset: () => transition({ type: "reset" }),
    endForHiddenMap: () => dispatch({ type: "reset" }),
  };
}
