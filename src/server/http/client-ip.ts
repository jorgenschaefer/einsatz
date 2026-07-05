/**
 * Ermittelt die Client-IP aus dem X-Forwarded-For-Header. Caddy hängt die real
 * verbundene Peer-IP rechts an einen vom Client evtl. gefälschten Header an;
 * daher zählt der letzte Eintrag, nicht der (fälschbare) erste.
 */
export function clientIpFromForwardedFor(forwardedFor: string | null): string {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? "local";
}
