"use client";

import { useEffect, useState } from "react";
import type { GeoHit } from "@/server/geocoder/geocoder";
import {
  type ObjectResult,
  searchOperationObjects,
  shouldGeocode,
} from "./search";

export interface MapSearchSymbol {
  id: string;
  composition: { text?: string | null };
  lat: number;
  lng: number;
}

export interface MapSearch {
  query: string;
  setQuery: (query: string) => void;
  objectResults: ObjectResult[];
  addressResults: GeoHit[];
}

/**
 * Karten-Suche: lokale Objektsuche über die Bezeichnung (sofort) und debouncte
 * Adress-Geocodierung über den übergebenen `geocode`. Von Führungs- und
 * Geräteansicht geteilt; der Unterschied liegt nur in der `geocode`-Quelle.
 */
export function useMapSearch(
  symbols: MapSearchSymbol[],
  geocode: (query: string) => Promise<GeoHit[]>,
): MapSearch {
  const [query, setQuery] = useState("");
  const [addressResults, setAddressResults] = useState<GeoHit[]>([]);

  // Adresssuche clientseitig debounced; Objektsuche läuft rein lokal.
  useEffect(() => {
    const q = query.trim();
    if (!shouldGeocode(q)) {
      setAddressResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const hits = await geocode(q);
      if (active) setAddressResults(hits);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, geocode]);

  const objectResults = searchOperationObjects(
    query,
    symbols.map((s) => ({
      id: s.id,
      bezeichnung: s.composition.text ?? null,
      lat: s.lat,
      lng: s.lng,
    })),
  );

  return { query, setQuery, objectResults, addressResults };
}
