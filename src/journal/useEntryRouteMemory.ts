"use client";

import { useEffect, useState } from "react";
import type { EntryRoute } from "./entry-route";
import {
  type EntryRouteMemory,
  NOTHING_REMEMBERED,
  readEntryRouteMemory,
  rememberEntryRoute,
} from "./entry-route-storage";

/**
 * Was dieses Gerät sich zu den neuen Einträgen des Gesamteinsatzes gemerkt hat.
 * Erst nach dem Mounten gelesen: Auf dem Server gibt es keinen Browser-Speicher,
 * und das erste Rendern muss dort wie im Browser alphabetisch und mit Funk sein.
 */
export function useEntryRouteMemory(operationId: string) {
  const [remembered, setRemembered] =
    useState<EntryRouteMemory>(NOTHING_REMEMBERED);

  useEffect(() => {
    setRemembered(readEntryRouteMemory(operationId));
  }, [operationId]);

  return {
    remembered,
    remember: (route: EntryRoute) => {
      rememberEntryRoute(operationId, route);
      setRemembered(readEntryRouteMemory(operationId));
    },
  };
}
