import { aSymbol } from "./symbol.fixtures";

export const SYMBOL = aSymbol({
  composition: {
    grundzeichen: "taktische-formation",
    organisation: "hilfsorganisation",
    text: "Pumpe 1",
  },
});

export const AREA = {
  id: "a1",
  geometry: {
    shape: "circle" as const,
    center: { lat: 53.5, lng: 9.9 },
    radius: 100,
  },
  color: "#e2001a",
  opacity: 0.4,
  label: "Deich",
};

export const anImageOverlay = {
  id: "i1",
  name: "Lageplan",
  imageUrl: "/img/i1",
  placement: {
    centerLat: 53.5,
    centerLng: 9.9,
    scaleM: 500,
    rotationDeg: 10,
    opacity: 0.8,
  },
  aspect: 1.5,
  visible: true,
};
