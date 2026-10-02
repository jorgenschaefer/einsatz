import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { MapAdapter, MapAdapterFactory } from "./adapter";
import { METERS_PER_DEGREE, metersPerDegLng } from "./image-overlay";
import { createAreaLayers } from "./leaflet-areas";
import { createImageOverlayLayers } from "./leaflet-image-overlays";
import { createKmlOverlayLayers } from "./leaflet-kml-overlays";
import { createMarkerLayers } from "./leaflet-markers";
import { createSearchHitPin } from "./search-hit-pin";
import { MAX_TILE_ZOOM, type MapView, type ViewExtent } from "./view";

/**
 * Leaflet-Implementierung des {@link MapAdapter}. Spricht zusammen mit den
 * `leaflet-*`-Modulen, `kml-layer.ts` und `search-hit-pin.ts` als einziger Ort
 * direkt mit Leaflet; wird nur clientseitig (dynamisch) geladen.
 */
export const leafletMapAdapterFactory: MapAdapterFactory = {
  create(container, options) {
    const map = L.map(container).setView(
      [options.initialView.lat, options.initialView.lng],
      options.initialView.zoom,
    );
    // Zoom unten rechts über der Attribution – oben liegt die schwebende Suche,
    // darüber die Spalte der Kartenknöpfe.
    map.zoomControl.setPosition("bottomright");

    // Auf der Vollbild-Karte gibt es keinen Footer; Impressum und Datenschutz
    // stehen daher als Präfix in der Attributionsleiste (unten rechts, neben
    // OpenStreetMap/MapTiler) statt der voreingestellten Leaflet-Kennung.
    map.attributionControl.setPrefix(
      '<a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a>',
    );

    L.tileLayer(options.tileUrl, {
      attribution: options.attribution,
      maxZoom: MAX_TILE_ZOOM,
    }).addTo(map);

    // Leaflet vermisst den Container nur bei window-resize neu. Ändert sich die
    // Container-Größe anderweitig (z. B. beim Öffnen des Kartenpanels),
    // bliebe sonst ein ungefüllter grauer Streifen – daher selbst beobachten.
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => map.invalidateSize());
    resizeObserver?.observe(container);

    const currentView = (): MapView => {
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
    };

    // Gemessen wie das Bild-Overlay ausgelegt wird: die Breite entlang des
    // Breitenkreises der Mitte, die Höhe entlang ihres Meridians.
    const currentViewExtent = (): ViewExtent => {
      const { lat, lng } = map.getCenter();
      const bounds = map.getBounds();
      return {
        lat,
        lng,
        widthM: (bounds.getEast() - bounds.getWest()) * metersPerDegLng(lat),
        heightM: (bounds.getNorth() - bounds.getSouth()) * METERS_PER_DEGREE,
      };
    };

    const emitViewChange = () => options.onViewChange?.(currentView());
    map.on("moveend", emitViewChange);
    map.on("zoomend", emitViewChange);
    const { onMapClick } = options;
    if (onMapClick) {
      map.on("click", (e) =>
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
      );
    }

    const markers = createMarkerLayers(map);
    const areas = createAreaLayers(map);
    const kmlOverlays = createKmlOverlayLayers(map);
    const imageOverlays = createImageOverlayLayers(map);
    const searchHitPin = createSearchHitPin(map);

    const adapter: MapAdapter = {
      getView: currentView,
      getViewExtent: currentViewExtent,
      setView: (view) => {
        map.setView([view.lat, view.lng], view.zoom);
      },
      setMarker: markers.set,
      removeMarker: markers.remove,
      setArea: areas.set,
      removeArea: areas.remove,
      setKmlOverlay: kmlOverlays.set,
      removeKmlOverlay: kmlOverlays.remove,
      setImageOverlay: imageOverlays.set,
      removeImageOverlay: imageOverlays.remove,
      restoreImageOverlay: imageOverlays.restore,
      startImageOverlayEdit: imageOverlays.startEdit,
      stopImageOverlayEdit: imageOverlays.stopEdit,
      startDrawing: areas.startDrawing,
      cancelDrawing: areas.cancelDrawing,
      startCirclePreview: areas.startCirclePreview,
      stopCirclePreview: areas.stopCirclePreview,
      setSearchHit: searchHitPin.set,
      clearSearchHit: searchHitPin.clear,
      destroy: () => {
        imageOverlays.stopEdit();
        resizeObserver?.disconnect();
        map.off("moveend", emitViewChange);
        map.off("zoomend", emitViewChange);
        map.remove();
      },
    };
    return adapter;
  },
};
