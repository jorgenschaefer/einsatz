"use client";

import { ActionIcon, Badge, Box } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { MapAdapterFactory } from "./adapter";
import { type StatefulSymbol, toPlacedSymbols } from "./placed-symbols";
import { SearchBar } from "./SearchBar";
import {
  type PlacedSymbol,
  type RenderedArea,
  type RenderedImageOverlay,
  type RenderedKmlOverlay,
  SituationMap,
} from "./SituationMap";
import { useMapFocus } from "./useMapFocus";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import type { MapView } from "./view";

export interface ViewLinkViewProps {
  token: string;
  operationId: string;
  operationDefaultView: MapView | null;
  tileUrl: string;
  attribution: string;
  symbols: StatefulSymbol[];
  areas: RenderedArea[];
  kmlOverlays: RenderedKmlOverlay[];
  imageOverlays: RenderedImageOverlay[];
  geocoderAttribution: string;
  /** Für Tests injizierbar; sonst die token-gebundene Ansichts-Route. */
  onGeocode?: (query: string) => Promise<GeoHit[]>;
  /** Für Tests injizierbar. */
  factory?: MapAdapterFactory;
  /** Für Tests injizierbar; sonst der echte SSE-Hook. */
  eventsHook?: (url: string, onChanged: () => void) => LiveConnection;
}

export function ViewLinkView({
  token,
  operationId,
  operationDefaultView,
  tileUrl,
  attribution,
  symbols,
  areas,
  kmlOverlays,
  imageOverlays,
  geocoderAttribution,
  onGeocode,
  factory,
  eventsHook = useOperationEvents,
}: ViewLinkViewProps) {
  const router = useRouter();
  const { connected } = eventsHook(`/view/${token}/events`, () =>
    router.refresh(),
  );

  const now = useStalenessClock();
  const { focusTarget, jumpTo, returnToDefaultView } =
    useMapFocus(operationDefaultView);

  // Adresssuche ohne Login über die token-gebundene Route; für Tests injizierbar.
  const geocode = useCallback(
    async (q: string) => {
      if (onGeocode) return onGeocode(q);
      const res = await fetch(
        `/view/${token}/geocode?q=${encodeURIComponent(q)}`,
      );
      return res.ok ? ((await res.json()) as GeoHit[]) : [];
    },
    [onGeocode, token],
  );
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    objectResults,
    addressResults,
  } = useMapSearch(symbols, geocode);

  const placed = useMemo<PlacedSymbol[]>(
    () => toPlacedSymbols(symbols, now),
    [symbols, now],
  );

  // Nur-Lesen: Tap auf ein Zeichen zentriert die Karte, keine Navigation.
  const centerOn = (id: string) => {
    const target = placed.find((p) => p.id === id);
    if (target) jumpTo(target.lat, target.lng);
  };

  return (
    <Box pos="relative" h="100dvh" w="100%">
      <SituationMap
        readOnly
        operationId={operationId}
        operationDefaultView={operationDefaultView}
        tileUrl={tileUrl}
        attribution={attribution}
        symbols={placed}
        onSelect={centerOn}
        focusTarget={focusTarget}
        areas={areas}
        kmlOverlays={kmlOverlays}
        imageOverlays={imageOverlays}
        factory={factory}
      />
      <Box pos="absolute" top={8} left={8} right={8} style={{ zIndex: 1100 }}>
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          objectResults={objectResults}
          addressResults={addressResults}
          attribution={geocoderAttribution}
          onJump={jumpTo}
        />
      </Box>
      {!connected && (
        <Badge
          pos="absolute"
          top={56}
          right={8}
          size="lg"
          color="orange"
          style={{ zIndex: 500 }}
        >
          Verbindung getrennt
        </Badge>
      )}
      <ActionIcon
        pos="absolute"
        bottom={16}
        right={16}
        size="xl"
        radius="xl"
        variant="default"
        aria-label="Zum Standard-Ausschnitt zurück"
        disabled={!operationDefaultView}
        style={{ zIndex: 500, boxShadow: "var(--mantine-shadow-md)" }}
        onClick={returnToDefaultView}
      >
        <IconHome size={22} />
      </ActionIcon>
    </Box>
  );
}
