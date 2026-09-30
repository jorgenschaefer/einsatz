import type { PositionSource } from "@/server/mapsymbols/map-symbols";
import type { SymbolComposition } from "./composition";
import type { PlacedSymbol } from "./SituationMap";
import { isStale } from "./staleness";
import { renderSymbolDataUrl } from "./tactical-symbol";

const STALE_OPACITY = 0.4;

/** Ein Kartenzeichen mit Zustand für die Darstellung (Komposition + Positionsquelle/Meldezeit). */
export interface StatefulSymbol {
  id: string;
  lat: number;
  lng: number;
  composition: SymbolComposition;
  positionSource: PositionSource;
  reportedAt: Date | null;
}

/** Bildet Kartenzeichen auf darstellbare Marker ab: Icon aus der Komposition, veraltete ausgegraut. */
export function toPlacedSymbols(
  symbols: StatefulSymbol[],
  now: number,
): PlacedSymbol[] {
  return symbols.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    iconUrl: renderSymbolDataUrl(s.composition),
    label: s.composition.text,
    opacity: isStale(s.positionSource, s.reportedAt, now) ? STALE_OPACITY : 1,
  }));
}
