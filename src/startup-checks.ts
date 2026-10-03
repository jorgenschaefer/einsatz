import { mapTileConfig } from "@/map/tiles";

/**
 * Stops the server where the Lagekarte would have no tiles it may load, rather
 * than letting it fail on the first map.
 */
export function refuseToStartWithoutTiles() {
  try {
    mapTileConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
