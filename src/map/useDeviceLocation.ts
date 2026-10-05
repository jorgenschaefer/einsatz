"use client";

import { useEffect, useRef, useState } from "react";
import { type LastReport, shouldSendPosition } from "./device-location";

/** So lange darf eine Meldung unterwegs sein; danach wird sie abgebrochen. */
const SEND_TIMEOUT_MS = 10_000;

export type LocationStatus = "active" | "paused";

export interface DeviceLocation {
  status: LocationStatus;
  /** Zuletzt gemessene eigene Position; null, solange kein Fix vorliegt. */
  position: { lat: number; lng: number } | null;
}

/**
 * Sendet – solange die Seite offen ist – periodisch den Standort an die
 * token-gebundene Route (Drosselung über {@link shouldSendPosition}, höchstens
 * eine Meldung zugleich unterwegs), fragt die Berechtigung an und hält per
 * Wake Lock den Bildschirm aktiv, auch nach der Rückkehr auf die Seite. Bei
 * „kein Zugang" (403) stoppt es die Ortung und ruft `onAccessLost`. Liefert
 * Status und letzte Position (für „auf meinen Standort"). Dünne Grenze zu
 * Geolocation/Wake-Lock/Fetch.
 */
export function useDeviceLocation(
  token: string,
  onAccessLost: () => void,
): DeviceLocation {
  const [status, setStatus] = useState<LocationStatus>("paused");
  const [position, setPosition] = useState<DeviceLocation["position"]>(null);
  const onAccessLostRef = useRef(onAccessLost);
  onAccessLostRef.current = onAccessLost;

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let last: LastReport | null = null;
    let sending = false;
    let stopped = false;
    let wakeLock: { release: () => Promise<void> } | null = null;

    const wakeLockApi = (
      navigator as {
        wakeLock?: {
          request: (t: string) => Promise<{ release: () => Promise<void> }>;
        };
      }
    ).wakeLock;
    const keepScreenOn = () =>
      void wakeLockApi
        ?.request("screen")
        .then((wl) => {
          if (stopped) void wl.release().catch(() => {});
          else wakeLock = wl;
        })
        .catch(() => {});
    // Der Browser gibt die Sperre frei, sobald die Seite verborgen ist.
    const keepScreenOnWhenShown = () => {
      if (document.visibilityState === "visible") keepScreenOn();
    };
    keepScreenOn();
    document.addEventListener("visibilitychange", keepScreenOnWhenShown);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", keepScreenOnWhenShown);
      void wakeLock?.release().catch(() => {});
    };

    const send = async (lat: number, lng: number): Promise<boolean> => {
      // Ein hängender Request darf die nächsten Meldungen nicht aufhalten.
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), SEND_TIMEOUT_MS);
      const res = await fetch(`/device/${token}/position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
        signal: abort.signal,
      }).finally(() => clearTimeout(timeout));
      if (res.status === 403) {
        stop();
        onAccessLostRef.current();
        return false;
      }
      return res.ok;
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (stopped) return;
        setStatus("active");
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition({ lat, lng });
        const now = Date.now();
        if (sending || !shouldSendPosition(last, { lat, lng }, now)) return;
        sending = true;
        void send(lat, lng)
          .catch(() => false)
          .then((ok) => {
            sending = false;
            if (ok && !stopped) last = { lat, lng, at: now };
          });
      },
      () => setStatus("paused"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );

    return stop;
  }, [token]);

  return { status, position };
}
