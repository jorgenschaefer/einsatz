const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';

/**
 * Kachelquelle für die Lagekarte. Mit MapTiler-Key gehostete OSM-Kacheln
 * (Gratis-Kontingent), sonst die öffentlichen OSM-Kacheln als Dev-Fallback.
 * Die OSM-Attribution ist in beiden Fällen enthalten.
 */
export function mapTileConfig(): { tileUrl: string; attribution: string } {
  const key = process.env.MAPTILER_API_KEY;
  if (key) {
    return {
      tileUrl: `https://api.maptiler.com/maps/openstreetmap/256/{z}/{x}/{y}.png?key=${key}`,
      attribution: `${OSM_ATTRIBUTION} · <a href="https://www.maptiler.com/">MapTiler</a>`,
    };
  }
  return {
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
  };
}
