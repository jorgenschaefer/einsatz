"use client";

import { useEffect, useState } from "react";

export type CopyStatus = "idle" | "copied" | "failed";

/**
 * Kopiert Text in die Zwischenablage und meldet **ehrlich**, ob es geklappt hat:
 * Fehlt die Clipboard-API (unsicherer HTTP-Kontext oder In-App-Webview) oder
 * lehnt der Browser das Schreiben ab, ist der Status `"failed"` statt eines
 * falschen `"copied"`. Der Status fällt nach 2s auf `"idle"` zurück, damit die
 * Schaltfläche wieder ihren Ruhezustand zeigt.
 */
export function useClipboardCopy(): {
  status: CopyStatus;
  copy: (text: string) => Promise<void>;
} {
  const [status, setStatus] = useState<CopyStatus>("idle");

  // Nur die flüchtige Erfolgsbestätigung ("copied") läuft nach 2s aus. Der
  // "failed"-Zustand bleibt stehen, bis der nächste Kopierversuch ihn ablöst –
  // er trägt den Fallback (die manuell zu kopierende URL), den der Nutzer nicht
  // unter den Fingern verlieren darf.
  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async (text: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Zwischenablage nicht verfügbar");
      }
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return { status, copy };
}
