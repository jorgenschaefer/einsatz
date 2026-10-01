"use client";

import { ModeBand } from "./ModeBand";

/** Das Band unter der Suche, das den scharfen Karten-Modus nennt und beendet. */
export function MapModeBands({
  placingSymbol,
  drawingArea,
  movingCircle,
  editingImage,
  onEndMode,
  onSetCircleHere,
  circleMoveSaving,
}: {
  placingSymbol: boolean;
  drawingArea: boolean;
  movingCircle: boolean;
  editingImage: boolean;
  onEndMode: () => void;
  onSetCircleHere: () => void;
  circleMoveSaving: boolean;
}) {
  return (
    <>
      {placingSymbol && (
        <ModeBand
          label="Kartenzeichen platzieren"
          actionLabel="Abbrechen"
          onAction={onEndMode}
        />
      )}
      {drawingArea && (
        <ModeBand
          label="Bereich zeichnen"
          actionLabel="Abbrechen"
          onAction={onEndMode}
        />
      )}
      {movingCircle && (
        <ModeBand
          label="Kreis verschieben"
          confirm={{ label: "Hier setzen", onClick: onSetCircleHere }}
          actionLabel="Abbrechen"
          onAction={onEndMode}
          busy={circleMoveSaving}
        />
      )}
      {editingImage && (
        <ModeBand
          label="Bild-Overlay bearbeiten"
          actionLabel="Fertig"
          onAction={onEndMode}
        />
      )}
    </>
  );
}
