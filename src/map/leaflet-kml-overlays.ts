import type L from "leaflet";
import { parseKml } from "./kml-layer";
import { kmlSignature } from "./layer-signature";

/** Die KML-Ebenen auf der Karte, per id gesetzt und entfernt. */
export function createKmlOverlayLayers(map: L.Map) {
  const kmlLayers = new Map<string, L.GeoJSON>();
  // Zuletzt gesetzte Signatur je id – unveränderte Ebenen werden nicht neu geparst.
  const kmlSigs = new Map<string, string>();

  return {
    set(id: string, spec: { content: string; visible: boolean }) {
      const sig = kmlSignature(spec);
      if (kmlSigs.get(id) === sig) return; // unverändert (sichtbar wie unsichtbar)
      kmlSigs.set(id, sig);
      kmlLayers.get(id)?.remove();
      kmlLayers.delete(id);
      if (!spec.visible) return;
      const layer = parseKml(spec.content);
      if (layer) {
        layer.addTo(map);
        kmlLayers.set(id, layer);
      }
    },
    remove(id: string) {
      kmlLayers.get(id)?.remove();
      kmlLayers.delete(id);
      kmlSigs.delete(id);
    },
  };
}
