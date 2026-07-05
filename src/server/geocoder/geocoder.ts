export interface GeoHit {
  label: string;
  lat: number;
  lng: number;
}

/** Austauschbarer Geocoder (v1: Photon), getrennt vom Karten-Adapter. */
export interface Geocoder {
  geocode(query: string): Promise<GeoHit[]>;
}

/**
 * Serverseitiges Rate-Limit (~1 Anfrage/s), um den externen Geocoder zu schonen:
 * lässt einen Aufruf nur zu, wenn seit dem letzten mindestens `minIntervalMs`
 * vergangen sind.
 */
export class RateGate {
  private lastAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly minIntervalMs: number) {}

  tryAcquire(now: number = Date.now()): boolean {
    if (now - this.lastAt < this.minIntervalMs) return false;
    this.lastAt = now;
    return true;
  }

  /** Gibt das Zeitfenster wieder frei (für Tests). */
  reset(): void {
    this.lastAt = Number.NEGATIVE_INFINITY;
  }
}
