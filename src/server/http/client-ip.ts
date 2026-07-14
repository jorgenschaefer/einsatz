/**
 * Ermittelt die Client-IP aus dem X-Forwarded-For-Header. Caddy hängt die real
 * verbundene Peer-IP rechts an einen vom Client evtl. gefälschten Header an;
 * daher zählt der letzte Eintrag, nicht der (fälschbare) erste.
 *
 * **Deploy-Invariante:** Diese Korrektheit setzt zwingend voraus, dass die App
 * hinter einem vertrauenswürdigen Reverse-Proxy (dem dokumentierten Caddy) läuft,
 * der `X-Forwarded-For` setzt bzw. bereinigt. Ohne diesen Proxy kontrolliert der
 * Client den gesamten Header und kann den rechtesten Eintrag frei wählen – dann
 * bricht das Rate-Limit ({@link ../auth/rate-limit}) zusammen (jede Anfrage sähe
 * wie eine neue IP aus). Die App darf daher **nicht** direkt aus dem Internet
 * erreichbar sein.
 */
export function clientIpFromForwardedFor(forwardedFor: string | null): string {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? "local";
}
