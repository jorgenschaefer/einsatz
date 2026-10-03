const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';

/**
 * Kachelquelle für die Lagekarte. Mit MapTiler-Key gehostete OSM-Kacheln
 * (Gratis-Kontingent), sonst die öffentlichen OSM-Kacheln als Dev-Fallback.
 * In Produktion ist der Key Pflicht: Die OSM-Kachelserver sind nicht für den
 * Betrieb gedacht. Die OSM-Attribution ist in beiden Fällen enthalten.
 */
export function mapTileConfig(): { tileUrl: string; attribution: string } {
  const key = process.env.MAPTILER_API_KEY;
  if (key) {
    return {
      tileUrl: `https://api.maptiler.com/maps/openstreetmap/256/{z}/{x}/{y}.png?key=${key}`,
      attribution: `${OSM_ATTRIBUTION} · <a href="https://www.maptiler.com/">MapTiler</a>`,
    };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MAPTILER_API_KEY ist nicht gesetzt. In Produktion lädt die Lagekarte Kacheln nur von MapTiler; Key unter https://cloud.maptiler.com/account/keys/ anlegen und als MAPTILER_API_KEY setzen.",
    );
  }
  return {
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
  };
}
