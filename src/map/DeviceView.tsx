"use client";

import { ActionIcon, Badge, Box, Button } from "@mantine/core";
import { IconCurrentLocation, IconHome } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { MapAdapterFactory } from "./adapter";
import { DeviceClosed } from "./DeviceClosed";
import { navigationUrl } from "./device-location";
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
import { type DeviceLocation, useDeviceLocation } from "./useDeviceLocation";
import { useMapFocus } from "./useMapFocus";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import type { MapView } from "./view";
import { WipeLock } from "./WipeLock";

export interface DeviceViewProps {
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
  /** Für Tests injizierbar; sonst die token-gebundene Geräte-Route. */
  onGeocode?: (query: string) => Promise<GeoHit[]>;
  /** Für Tests injizierbar. */
  factory?: MapAdapterFactory;
  /** Für Tests injizierbar; sonst der echte Geolocation-Hook. */
  locationHook?: (token: string, onAccessLost: () => void) => DeviceLocation;
  /** Für Tests injizierbar; sonst der echte SSE-Hook. */
  eventsHook?: (url: string, onChanged: () => void) => LiveConnection;
}

export function DeviceView({
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
  locationHook = useDeviceLocation,
  eventsHook = useOperationEvents,
}: DeviceViewProps) {
  const router = useRouter();
  const [accessLost, setAccessLost] = useState(false);
  const [locked, setLocked] = useState(false);
  const { status: locationStatus, position: ownPosition } = locationHook(
    token,
    () => setAccessLost(true),
  );
  const { connected } = eventsHook(`/device/${token}/events`, () =>
    router.refresh(),
  );

  const now = useStalenessClock();
  const { focusTarget, jumpTo, returnToDefaultView } =
    useMapFocus(operationDefaultView);

  // Adresssuche ohne Login über die token-gebundene Route; für Tests injizierbar.
  const geocode = useCallback(
    (q: string) =>
      onGeocode ? onGeocode(q) : tokenGeocode("/device", token, q),
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

  // Tap auf ein Objekt übergibt die Navigation an die Karten-App des Geräts.
  const navigateTo = (id: string) => {
    const target = placed.find((p) => p.id === id);
    if (target) window.open(navigationUrl(target.lat, target.lng), "_blank");
  };

  if (accessLost) return <DeviceClosed />;

  return (
    <Box pos="relative" h="100dvh" w="100%">
      <SituationMap
        readOnly
        operationId={operationId}
        operationDefaultView={operationDefaultView}
        tileUrl={tileUrl}
        attribution={attribution}
        symbols={placed}
        onSelect={navigateTo}
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
      <Badge
        pos="absolute"
        top={56}
        left={8}
        size="lg"
        color={locationStatus === "active" ? "green" : "gray"}
        style={{ zIndex: 500 }}
      >
        {locationStatus === "active"
          ? "Standort wird gesendet ✓"
          : "Standort pausiert"}
      </Badge>
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
        bottom={136}
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
      <ActionIcon
        pos="absolute"
        bottom={76}
        right={16}
        size="xl"
        radius="xl"
        variant="default"
        aria-label="Auf meinen Standort zentrieren"
        disabled={!ownPosition}
        style={{ zIndex: 500, boxShadow: "var(--mantine-shadow-md)" }}
        onClick={() => ownPosition && jumpTo(ownPosition.lat, ownPosition.lng)}
      >
        <IconCurrentLocation size={22} />
      </ActionIcon>
      <Button
        pos="absolute"
        bottom={16}
        right={16}
        size="lg"
        variant="filled"
        color="dark"
        style={{ zIndex: 500 }}
        onClick={() => setLocked(true)}
      >
        Sperren
      </Button>
      {locked && <WipeLock onUnlock={() => setLocked(false)} />}
    </Box>
  );
}
