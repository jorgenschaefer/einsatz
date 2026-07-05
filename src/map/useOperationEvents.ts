"use client";

import { useEffect, useRef, useState } from "react";

export interface LiveConnection {
  connected: boolean;
}

/**
 * Abonniert den SSE-Strom eines Einsatzes. Bei jedem Ereignis ruft es `onChanged`
 * (der Aufrufer lädt damit den vollen Zustand neu); nach einem Verbindungsverlust
 * und erneutem Öffnen lädt es ebenfalls neu (kein Event-Replay). Dünne
 * EventSource-Grenze.
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
    const source = new EventSource(url);
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
    };
    return () => source.close();
  }, [url]);

  return { connected };
}
