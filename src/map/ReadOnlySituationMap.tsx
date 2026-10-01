"use client";

import { ActionIcon, Badge, Box } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useMemo } from "react";
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
import { tokenGeocode } from "./token-geocode";
import type { useMapFocus } from "./useMapFocus";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import type { MapView } from "./view";

/** Präfix der token-gebundenen Routen einer login-freien Kartenansicht. */
export type TokenBasePath = "/device" | "/view";

/** Was der Server einer login-freien, token-gebundenen Kartenansicht mitgibt. */
export interface ReadOnlySituationMapData {
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
}

/** Für Tests injizierbare Ersatz-Abhängigkeiten der login-freien Kartenansicht. */
export interface ReadOnlySituationMapSeams {
  /** Sonst die token-gebundene Route. */
  onGeocode?: (query: string) => Promise<GeoHit[]>;
  factory?: MapAdapterFactory;
  /** Sonst der echte SSE-Hook. */
  eventsHook?: (url: string, onChanged: () => void) => LiveConnection;
}

/**
 * Die Lagekarte nur zum Lesen, geteilt von Geräte- und Ansichtslink: Karte,
 * Suche, Live-Aktualisierung über die token-gebundenen Routen unter `basePath`
 * und der Knopf zurück zum Standard-Ausschnitt. Was ein Tap auf ein Zeichen
 * tut und welche Bedienelemente dazukommen (`children`), bestimmt die Ansicht.
 */
export function ReadOnlySituationMap({
  basePath,
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
  focus,
  onSelect,
  homeButtonBottom,
  children,
}: ReadOnlySituationMapData &
  ReadOnlySituationMapSeams & {
    basePath: TokenBasePath;
    focus: ReturnType<typeof useMapFocus>;
    onSelect: (target: PlacedSymbol) => void;
    /** Abstand des Standard-Ausschnitt-Knopfs vom unteren Rand (px). */
    homeButtonBottom: number;
    children?: ReactNode;
  }) {
  const router = useRouter();
  const { connected } = eventsHook(`${basePath}/${token}/events`, () =>
    router.refresh(),
  );

  const now = useStalenessClock();
  const { focusTarget, jumpTo, returnToDefaultView } = focus;

  const geocode = useCallback(
    (q: string) =>
      onGeocode ? onGeocode(q) : tokenGeocode(basePath, token, q),
    [onGeocode, basePath, token],
  );
  const search = useMapSearch(symbols, geocode, jumpTo);

  const placed = useMemo<PlacedSymbol[]>(
    () => toPlacedSymbols(symbols, now),
    [symbols, now],
  );

  const select = (id: string) => {
    const target = placed.find((p) => p.id === id);
    if (target) onSelect(target);
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
        onSelect={select}
        focusTarget={focusTarget}
        areas={areas}
        kmlOverlays={kmlOverlays}
        imageOverlays={imageOverlays}
        searchHit={search.searchHit}
        factory={factory}
      />
      <Box
        pos="absolute"
        top={8}
        left={8}
        w={{ base: "calc(100% - 16px)", sm: 340 }}
        style={{ zIndex: 1100 }}
      >
        <SearchBar
          query={search.query}
          onQueryChange={search.setQuery}
          objectResults={search.objectResults}
          addressResults={search.addressResults}
          attribution={geocoderAttribution}
          onChooseAddress={search.chooseAddress}
          onChooseObject={search.chooseObject}
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
        bottom={homeButtonBottom}
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
      {children}
    </Box>
  );
}
