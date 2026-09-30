---
effort: XS
complexity: XS
utility: XS
---

# Alte `.png`-Overlays

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** `overlayContentType` liefert für `.png` weiterhin `image/png`,
weil vor der WebP-Umstellung angelegte Overlays noch als PNG im Volume liegen
können.

**Vorschlag.** Prüfen, ob im Produktions-Volume noch `.png`-Overlays liegen;
falls nicht (oder nach einer einmaligen Konvertierung), die Sonderbehandlung
samt Test entfernen.

**Kostet.** Eine Prüfung im laufenden Betrieb; ohne sie würden alte Overlays
mit falschem Content-Type ausgeliefert.
