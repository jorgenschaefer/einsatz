---
effort: S
complexity: S
utility: M
---

# „Speichern fehlgeschlagen“ im ETB ist am Handy nicht zu sehen

Scheitert das Speichern eines ETB-Eintrags, erscheint die Meldung
„Speichern fehlgeschlagen. Bitte erneut versuchen.“ als `Alert` ganz oben im
`JournalPanel`, über allen Einträgen. Der Eingabebereich steht aber unten. Bei
der Abnahme von „Von, An und Weg im ETB“ am 2026-09-30 lag die Meldung am
Handy (360 px) 1092 px über dem sichtbaren Bereich; man sieht nur, dass der
Eintrag nicht verschwindet. Text, Von, An und Weg bleiben zwar erhalten, aber
ohne Hinweis weiß man nicht, dass man erneut speichern muss. Das war schon
vor der Änderung so (`6392481`) und betrifft auch das Korrigieren, das
denselben `error`-Zustand nutzt.

Vorschlag: Die Meldung beim Eingabebereich bzw. beim betroffenen Eintrag
zeigen. Berührt [Ein Muster für „beschäftigt/Fehler“](ein-muster-fuer-busy-und-fehler.md).
