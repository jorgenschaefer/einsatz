"use client";

import { ActionIcon, Badge, Button } from "@mantine/core";
import { IconCurrentLocation } from "@tabler/icons-react";
import { useState } from "react";
import { DeviceClosed } from "./DeviceClosed";
import { navigationUrl } from "./device-location";
import {
  ReadOnlySituationMap,
  type ReadOnlySituationMapData,
  type ReadOnlySituationMapSeams,
} from "./ReadOnlySituationMap";
import { type DeviceLocation, useDeviceLocation } from "./useDeviceLocation";
import { useMapFocus } from "./useMapFocus";
import { WipeLock } from "./WipeLock";

export interface DeviceViewProps
  extends ReadOnlySituationMapData,
    ReadOnlySituationMapSeams {
  /** Für Tests injizierbar; sonst der echte Geolocation-Hook. */
  locationHook?: (token: string, onAccessLost: () => void) => DeviceLocation;
}

/**
 * Die Lagekarte hinter einem Gerätelink: nur lesen, meldet dabei den eigenen
 * Standort und lässt sich für die Tasche sperren.
 */
export function DeviceView({
  locationHook = useDeviceLocation,
  ...props
}: DeviceViewProps) {
  const [accessLost, setAccessLost] = useState(false);
  const [locked, setLocked] = useState(false);
  const { status: locationStatus, position: ownPosition } = locationHook(
    props.token,
    () => setAccessLost(true),
  );
  const focus = useMapFocus(props.operationDefaultView);

  if (accessLost) return <DeviceClosed />;

  return (
    <ReadOnlySituationMap
      {...props}
      basePath="/device"
      focus={focus}
      // Tap auf ein Objekt übergibt die Navigation an die Karten-App des Geräts.
      onSelect={(target) =>
        window.open(navigationUrl(target.lat, target.lng), "_blank")
      }
      homeButtonBottom={224}
    >
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
      <ActionIcon
        pos="absolute"
        bottom={164}
        right={16}
        size="xl"
        radius="xl"
        variant="default"
        aria-label="Auf meinen Standort zentrieren"
        disabled={!ownPosition}
        style={{ zIndex: 500, boxShadow: "var(--mantine-shadow-md)" }}
        onClick={() =>
          ownPosition && focus.jumpTo(ownPosition.lat, ownPosition.lng)
        }
      >
        <IconCurrentLocation size={22} />
      </ActionIcon>
      <Button
        pos="absolute"
        bottom={104}
        right={16}
        size="lg"
        variant="filled"
        color="dark"
        style={{ zIndex: 500 }}
        onClick={() => setLocked(true)}
      >
        Sperren
      </Button>
      {locked && (
        <WipeLock
          locating={locationStatus === "active"}
          onUnlock={() => setLocked(false)}
        />
      )}
    </ReadOnlySituationMap>
  );
}
