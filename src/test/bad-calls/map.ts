import { setDefaultViewAction } from "@/app/operations/[id]/actions";
import {
  createAreaAction,
  deleteAreaAction,
  updateAreaGeometryAction,
  updateAreaStyleAction,
} from "@/app/operations/[id]/area-actions";
import {
  deleteImageOverlayAction,
  setImageOverlayVisibilityAction,
  updateImageOverlayPlacementAction,
} from "@/app/operations/[id]/image-overlay-actions";
import {
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "@/app/operations/[id]/kml-actions";
import {
  deleteMapSymbolAction,
  generateDeviceLinkAction,
  moveMapSymbolAction,
  placeMapSymbolAction,
  removeDeviceLinkAction,
  updateMapSymbolCompositionAction,
} from "@/app/operations/[id]/map-symbol-actions";
import {
  createViewLinkAction,
  deleteViewLinkAction,
} from "@/app/operations/[id]/view-link-actions";
import {
  type Bad,
  type BadCalls,
  INVALID_ID,
  idCalls,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "./bad-call";
import { PLACEMENT, STYLE } from "./fixture";

const CIRCLE = { shape: "circle", center: { lat: 50, lng: 8 }, radius: 10 };

/** Die Lagekarten-Actions mit falschen Eingaben (AC-22). */
export const MAP_BAD_CALLS: BadCalls = {
  setDefaultViewAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      setDefaultViewAction(NOT_A_UUID, { lat: 50, lng: 8, zoom: 10 }),
    ),
    rejects("a view of null", "Der Kartenausschnitt ist ungültig.", (f) =>
      setDefaultViewAction(f.operationId, null as Bad),
    ),
    rejects("a view as text", "Der Kartenausschnitt ist ungültig.", (f) =>
      setDefaultViewAction(f.operationId, "Hamburg" as Bad),
    ),
    rejects("a view as an array", "Der Kartenausschnitt ist ungültig.", (f) =>
      setDefaultViewAction(f.operationId, [] as Bad),
    ),
    rejects("a zoom of NaN", "Ungültige Zoomstufe.", (f) =>
      setDefaultViewAction(f.operationId, {
        lat: 50,
        lng: 8,
        zoom: Number.NaN,
      }),
    ),
    rejects("a lat as a BigInt", "Ungültige Koordinaten.", (f) =>
      setDefaultViewAction(f.operationId, {
        lat: BigInt(50) as Bad,
        lng: 8,
        zoom: 10,
      }),
    ),
  ],
  placeMapSymbolAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      placeMapSymbolAction(NOT_A_UUID, { text: "A" }, 50, 8),
    ),
    rejects("a composition as text", "Ungültige Zeichen-Komposition.", (f) =>
      placeMapSymbolAction(f.operationId, "A" as Bad, 50, 8),
    ),
    rejects("lat as text", "Ungültige Koordinaten.", (f) =>
      placeMapSymbolAction(f.operationId, { text: "A" }, "50" as Bad, 8),
    ),
    rejects("lng of null", "Ungültige Koordinaten.", (f) =>
      placeMapSymbolAction(f.operationId, { text: "A" }, 50, null as Bad),
    ),
    rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), (f) =>
      placeMapSymbolAction(f.operationId, { text: text(201) }, 50, 8),
    ),
    rejects("an axis of 201", "Ungültige Zeichen-Komposition.", (f) =>
      placeMapSymbolAction(f.operationId, { einheit: text(201) }, 50, 8),
    ),
  ],
  moveMapSymbolAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, (f) =>
      moveMapSymbolAction(NOT_A_UUID, f.symbolId, 50, 8),
    ),
    rejects("a non-UUID Kartenzeichen-ID", INVALID_ID, (f) =>
      moveMapSymbolAction(f.operationId, NOT_A_UUID, 50, 8),
    ),
    rejects("lat of null", "Ungültige Koordinaten.", (f) =>
      moveMapSymbolAction(f.operationId, f.symbolId, null as Bad, 8),
    ),
    rejects("lng as text", "Ungültige Koordinaten.", (f) =>
      moveMapSymbolAction(f.operationId, f.symbolId, 50, "8" as Bad),
    ),
  ],
  updateMapSymbolCompositionAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, (f) =>
      updateMapSymbolCompositionAction(NOT_A_UUID, f.symbolId, { text: "B" }),
    ),
    rejects("a non-UUID Kartenzeichen-ID", INVALID_ID, (f) =>
      updateMapSymbolCompositionAction(f.operationId, NOT_A_UUID, {
        text: "B",
      }),
    ),
    rejects("a composition of null", "Ungültige Zeichen-Komposition.", (f) =>
      updateMapSymbolCompositionAction(f.operationId, f.symbolId, null as Bad),
    ),
    rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), (f) =>
      updateMapSymbolCompositionAction(f.operationId, f.symbolId, {
        text: text(201),
      }),
    ),
  ],
  deleteMapSymbolAction: idCalls("symbolId", deleteMapSymbolAction),
  generateDeviceLinkAction: idCalls("symbolId", generateDeviceLinkAction),
  removeDeviceLinkAction: idCalls("symbolId", removeDeviceLinkAction),
  createAreaAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      createAreaAction(NOT_A_UUID, CIRCLE as Bad),
    ),
    rejects("a geometry of null", "Ungültige Bereichsgeometrie.", (f) =>
      createAreaAction(f.operationId, null as Bad),
    ),
    rejects('the shape "triangle"', "Unbekannte Bereichsform.", (f) =>
      createAreaAction(f.operationId, { shape: "triangle", points: [] } as Bad),
    ),
    rejects(
      "a polygon of 2 points",
      "Ein Polygon braucht mindestens 3 Punkte.",
      (f) =>
        createAreaAction(f.operationId, {
          shape: "polygon",
          points: [CIRCLE.center, CIRCLE.center],
        }),
    ),
    rejects(
      "a line of 1 point",
      "Eine Linie braucht mindestens 2 Punkte.",
      (f) =>
        createAreaAction(f.operationId, {
          shape: "line",
          points: [CIRCLE.center],
        }),
    ),
    rejects("a radius as text", "Der Radius muss größer als 0 sein.", (f) =>
      createAreaAction(f.operationId, { ...CIRCLE, radius: "10" } as Bad),
    ),
    rejects("a point at infinity", "Ungültige Koordinaten.", (f) =>
      createAreaAction(f.operationId, {
        shape: "line",
        points: [CIRCLE.center, { lat: Number.POSITIVE_INFINITY, lng: 8 }],
      }),
    ),
  ],
  updateAreaStyleAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, (f) =>
      updateAreaStyleAction(NOT_A_UUID, f.areaId, STYLE),
    ),
    rejects("a non-UUID Bereich-ID", INVALID_ID, (f) =>
      updateAreaStyleAction(f.operationId, NOT_A_UUID, STYLE),
    ),
    rejects("a style as text", "Ungültige Darstellung des Bereichs.", (f) =>
      updateAreaStyleAction(f.operationId, f.areaId, "rot" as Bad),
    ),
    rejects(
      "the colour red",
      "Die Farbe muss # und sechs Hex-Ziffern sein, etwa #e2001a.",
      (f) =>
        updateAreaStyleAction(f.operationId, f.areaId, {
          ...STYLE,
          color: "red",
        }),
    ),
    rejects(
      "an opacity as text",
      "Die Deckkraft muss zwischen 0 und 1 liegen.",
      (f) =>
        updateAreaStyleAction(f.operationId, f.areaId, {
          ...STYLE,
          opacity: "1" as Bad,
        }),
    ),
    rejects(
      "a Beschriftung as a number",
      "Die Beschriftung muss Text sein.",
      (f) =>
        updateAreaStyleAction(f.operationId, f.areaId, {
          ...STYLE,
          label: 7 as Bad,
        }),
    ),
    rejects("a Beschriftung of 201", tooLong("Die Beschriftung", "200"), (f) =>
      updateAreaStyleAction(f.operationId, f.areaId, {
        ...STYLE,
        label: text(201),
      }),
    ),
  ],
  updateAreaGeometryAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, (f) =>
      updateAreaGeometryAction(NOT_A_UUID, f.areaId, CIRCLE as Bad),
    ),
    rejects("a non-UUID Bereich-ID", INVALID_ID, (f) =>
      updateAreaGeometryAction(f.operationId, NOT_A_UUID, CIRCLE as Bad),
    ),
    rejects("a geometry as text", "Ungültige Bereichsgeometrie.", (f) =>
      updateAreaGeometryAction(f.operationId, f.areaId, "circle" as Bad),
    ),
    rejects('the shape "point"', "Unbekannte Bereichsform.", (f) =>
      updateAreaGeometryAction(f.operationId, f.areaId, {
        shape: "point",
        center: CIRCLE.center,
      } as Bad),
    ),
  ],
  deleteAreaAction: idCalls("areaId", deleteAreaAction),
  addKmlUrlAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      addKmlUrlAction(NOT_A_UUID, "Pegel", "https://example.org/a.kml"),
    ),
    rejects("a name as a number", "Der Name muss Text sein.", (f) =>
      addKmlUrlAction(f.operationId, 7 as Bad, "https://example.org/a.kml"),
    ),
    rejects("a name of 201", tooLong("Der Name", "200"), (f) =>
      addKmlUrlAction(f.operationId, text(201), "https://example.org/a.kml"),
    ),
    rejects("a URL of null", "Die KML-URL muss Text sein.", (f) =>
      addKmlUrlAction(f.operationId, "Pegel", null as Bad),
    ),
    rejects("a URL of 2,001", tooLong("Die KML-URL", "2.000"), (f) =>
      addKmlUrlAction(
        f.operationId,
        "Pegel",
        `https://example.org/${text(2001 - 20)}`,
      ),
    ),
  ],
  setKmlVisibilityAction: [
    ...idCalls("kmlId", (op, id) => setKmlVisibilityAction(op, id, false)),
    rejects(
      'visible as "yes"',
      "Die Sichtbarkeit muss wahr oder falsch sein.",
      (f) => setKmlVisibilityAction(f.operationId, f.kmlId, "yes" as Bad),
    ),
  ],
  reloadKmlAction: idCalls("kmlId", reloadKmlAction),
  removeKmlAction: idCalls("kmlId", removeKmlAction),
  updateImageOverlayPlacementAction: [
    ...idCalls("imageId", (op, id) =>
      updateImageOverlayPlacementAction(op, id, PLACEMENT),
    ),
    rejects("a placement as text", "Ungültige Platzierung.", (f) =>
      updateImageOverlayPlacementAction(f.operationId, f.imageId, "x" as Bad),
    ),
    rejects("a scale as text", "Die Skalierung muss größer als 0 sein.", (f) =>
      updateImageOverlayPlacementAction(f.operationId, f.imageId, {
        ...PLACEMENT,
        scaleM: "10" as Bad,
      }),
    ),
    rejects("a centre lat as text", "Ungültige Koordinaten.", (f) =>
      updateImageOverlayPlacementAction(f.operationId, f.imageId, {
        ...PLACEMENT,
        centerLat: "50" as Bad,
      }),
    ),
    rejects(
      "a rotation of null",
      "Die Drehung muss eine endliche Zahl sein.",
      (f) =>
        updateImageOverlayPlacementAction(f.operationId, f.imageId, {
          ...PLACEMENT,
          rotationDeg: null as Bad,
        }),
    ),
  ],
  setImageOverlayVisibilityAction: [
    ...idCalls("imageId", (op, id) =>
      setImageOverlayVisibilityAction(op, id, false),
    ),
    rejects(
      "visible of null",
      "Die Sichtbarkeit muss wahr oder falsch sein.",
      (f) =>
        setImageOverlayVisibilityAction(f.operationId, f.imageId, null as Bad),
    ),
  ],
  deleteImageOverlayAction: idCalls("imageId", deleteImageOverlayAction),
  createViewLinkAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      createViewLinkAction(NOT_A_UUID, "Leitstelle"),
    ),
    rejects(
      "a Bezeichnung as a number",
      "Die Bezeichnung muss Text sein.",
      (f) => createViewLinkAction(f.operationId, 7 as Bad),
    ),
    rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), (f) =>
      createViewLinkAction(f.operationId, text(201)),
    ),
  ],
  deleteViewLinkAction: idCalls("viewLinkId", deleteViewLinkAction),
};
