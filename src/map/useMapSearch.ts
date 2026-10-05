"use client";

import { useEffect, useState } from "react";
import type { GeoHit } from "@/server/geocoder/geocoder";
import {
  addressResultKey,
  type ObjectResult,
  type SearchableSymbol,
  searchOperationObjects,
  shouldGeocode,
} from "./search";
import type { LatLng } from "./view";

export interface MapSearch {
  query: string;
  /** Emptying the query also removes the Suchtreffer. */
  setQuery: (query: string) => void;
  objectResults: ObjectResult[];
  addressResults: GeoHit[];
  /** The chosen address, marked on the map until the search is emptied. */
  searchHit: LatLng | null;
  /** Marks the address as Suchtreffer and jumps there. */
  chooseAddress: (hit: GeoHit) => void;
  /** Removes the Suchtreffer and jumps to the Einsatzobjekt. */
  chooseObject: (result: ObjectResult) => void;
}

/**
 * Karten-Suche: lokale Objektsuche über die Bezeichnung (sofort) und debouncte
 * Adress-Geocodierung über den übergebenen `geocode`. Von Führungsansicht,
 * Ansicht und Geräteansicht geteilt; der Unterschied liegt nur in der
 * `geocode`-Quelle.
 */
export function useMapSearch(
  symbols: SearchableSymbol[],
  geocode: (query: string) => Promise<GeoHit[]>,
  jumpTo: (lat: number, lng: number) => void,
): MapSearch {
  const [query, setQueryState] = useState("");
  const [searchHit, setSearchHit] = useState<LatLng | null>(null);
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
      // Scheitert die Suche, gelten auch die Treffer der vorigen nicht mehr.
      const hits = await geocode(q).catch(() => []);
      if (active) setAddressResults(withoutDuplicates(hits));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, geocode]);

  const objectResults = searchOperationObjects(query, symbols);

  const setQuery = (next: string) => {
    setQueryState(next);
    if (next.trim() === "") setSearchHit(null);
  };
  const chooseAddress = (hit: GeoHit) => {
    setSearchHit({ lat: hit.lat, lng: hit.lng });
    jumpTo(hit.lat, hit.lng);
  };
  const chooseObject = (result: ObjectResult) => {
    setSearchHit(null);
    jumpTo(result.lat, result.lng);
  };

  return {
    query,
    setQuery,
    objectResults,
    addressResults,
    searchHit,
    chooseAddress,
    chooseObject,
  };
}

/** The geocoder can return the same address twice; it is listed once. */
function withoutDuplicates(hits: GeoHit[]): GeoHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = addressResultKey(hit);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
