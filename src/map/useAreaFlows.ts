"use client";

import { type RefObject, useEffect, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import type { AreaGeometry, AreaShape } from "./area";
import type { RenderedArea, SituationMapHandle } from "./SituationMap";
import type { RunMapAction } from "./useMapActionError";
import type { MapModeControls } from "./useMapMode";

/**
 * Die Abläufe um Bereiche auf der Karte: einen Bereich zeichnen und anlegen
 * oder neu zeichnen, den Bereich im Editor, einen Kreis unter dem Fadenkreuz
 * verschieben und dort setzen.
 */
export function useAreaFlows({
  areas,
  mapRef,
  mode,
  runMapAction,
  closeSheetOnPhone,
  onCreateArea,
  onUpdateAreaGeometry,
}: {
  areas: RenderedArea[];
  mapRef: RefObject<SituationMapHandle | null>;
  mode: Pick<
    MapModeControls,
    | "drawShape"
    | "redrawAreaId"
    | "movingCircleId"
    | "toggleDraw"
    | "redraw"
    | "armMoveCircle"
    | "endMoveCircle"
    | "reset"
  >;
  runMapAction: RunMapAction;
  closeSheetOnPhone: () => void;
  onCreateArea: (
    geometry: AreaGeometry,
  ) => Promise<ActionResult & { id?: string }>;
  onUpdateAreaGeometry: (
    id: string,
    geometry: AreaGeometry,
  ) => Promise<ActionResult>;
}) {
  const { redrawAreaId, movingCircleId, endMoveCircle } = mode;
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [circleMoveSaving, setCircleMoveSaving] = useState(false);
  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;
  const movingCircle = areas.find((a) => a.id === movingCircleId) ?? null;

  const toggleAreaDraw = (shape: AreaShape) => {
    mode.toggleDraw(shape);
    if (mode.drawShape !== shape) closeSheetOnPhone();
  };
  const handleDrawComplete = async (geometry: AreaGeometry) => {
    // Kein Panel für diesen Fluss, und der Modus muss in jedem Fall enden. Ein
    // etwaiger {error} – etwa eine entartete Geometrie (Kreis mit Radius 0 aus
    // einem Tap ohne Ziehen) – meldet die Benachrichtigung „Karte“. reset
    // läuft (wie beim Platzieren) vor dem Roundtrip; die Branch-Entscheidung
    // hält die id vorher fest, weil reset redrawAreaId leert.
    const redrawId = redrawAreaId;
    mode.reset();
    if (redrawId) {
      await runMapAction(() => onUpdateAreaGeometry(redrawId, geometry));
      return;
    }
    const created = await runMapAction(() => onCreateArea(geometry));
    // A new circle opens its editor for the radius. The area arrives with the
    // next refresh; the Modal opens once `areas` contains it.
    if (
      created &&
      "id" in created &&
      created.id &&
      geometry.shape === "circle"
    ) {
      setSelectedAreaId(created.id);
    }
  };
  const startRedraw = (area: RenderedArea) => {
    mode.redraw(area.geometry.shape, area.id);
    setSelectedAreaId(null);
    closeSheetOnPhone();
  };
  const startMoveCircle = (area: RenderedArea) => {
    mode.armMoveCircle(area.id);
    setSelectedAreaId(null);
    closeSheetOnPhone();
  };
  // The new centre is the map centre under the crosshair; the radius comes from
  // the latest `areas`, so that a radius changed elsewhere meanwhile is kept.
  const setCircleHere = async () => {
    const view = mapRef.current?.getView();
    if (!view || movingCircle?.geometry.shape !== "circle") return;
    const { id, geometry } = movingCircle;
    setCircleMoveSaving(true);
    const result = await runMapAction(() =>
      onUpdateAreaGeometry(id, {
        shape: "circle",
        center: { lat: view.lat, lng: view.lng },
        radius: geometry.radius,
      }),
    );
    setCircleMoveSaving(false);
    if (result && !result.error) endMoveCircle(id);
  };
  // Deleted elsewhere while being moved: nothing left to move.
  useEffect(() => {
    if (movingCircleId && !movingCircle) endMoveCircle(movingCircleId);
  }, [movingCircleId, movingCircle, endMoveCircle]);

  return {
    selectedArea,
    selectArea: setSelectedAreaId,
    circleMoveSaving,
    toggleAreaDraw,
    handleDrawComplete,
    startRedraw,
    startMoveCircle,
    setCircleHere,
  };
}
