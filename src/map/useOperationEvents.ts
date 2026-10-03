"use client";

import { useEffect, useRef, useState } from "react";

const RETRY_AFTER_REFUSAL_MS = 5_000;

export interface LiveConnection {
  connected: boolean;
}

/**
 * Abonniert den SSE-Strom eines Einsatzes. Bei jedem Ereignis ruft es `onChanged`
 * (der Aufrufer lädt damit den vollen Zustand neu); nach einem Verbindungsverlust
 * und erneutem Öffnen lädt es ebenfalls neu (kein Event-Replay). Lehnt der
 * Server ab, versucht es alle 5 Sekunden erneut. Dünne EventSource-Grenze.
 */
export function useOperationEvents(
  url: string,
  onChanged: () => void,
): LiveConnection {
  const [connected, setConnected] = useState(true);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let wasDisconnected = false;
    let source: EventSource;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      source = new EventSource(url);
      source.onopen = () => {
        setConnected(true);
        if (wasDisconnected) {
          wasDisconnected = false;
          onChangedRef.current(); // nach der Lücke den vollen Zustand neu laden
        }
      };
      source.onmessage = () => onChangedRef.current();
      source.onerror = () => {
        wasDisconnected = true;
        setConnected(false);
        // Eine Ablehnung (403, 429, Umleitung) beendet EventSource endgültig;
        // sonst verbindet es selbst neu.
        if (source.readyState !== EventSource.CLOSED) return;
        source.close();
        retry = setTimeout(connect, RETRY_AFTER_REFUSAL_MS);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      source.close();
    };
  }, [url]);

  return { connected };
}
