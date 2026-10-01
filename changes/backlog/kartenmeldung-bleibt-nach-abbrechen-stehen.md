---
effort: S
complexity: S
utility: M
---

# Die Meldung auf der Karte bleibt nach „Abbrechen“ stehen

Scheitert eine Kartenaktion, steht unten auf der Karte „Das hat nicht
geklappt. Bitte erneut versuchen.“. Die Meldung verschwindet erst mit der
nächsten Kartenaktion oder über ihr „×“ (`runMapAction` bzw. `mapError` in
`src/map/SituationWorkspace.tsx`).

So nachgestellt: „Kreis verschieben“ scheitert, die Meldung erscheint, man
wählt „Abbrechen“. Der Verschieben-Modus ist beendet, die Meldung zu der
abgebrochenen Aktion steht weiter da. Dasselbe gilt für das Zeichnen eines
Bereichs und das Platzieren eines Kartenzeichens, wenn man danach etwas
anderes tut.

Das ist das Problem, das „Karte und Ebenen nachbessern“ für die Panels gelöst
hat („man sieht nur Meldungen, die noch gelten“), hier auf der Karte. Kein
Kriterium dieser Änderung hat es abgedeckt. Aufgefallen bei der Abnahme am
2026-10-01.

Gewünscht: Die Meldung verschwindet, sobald der Modus endet, zu dem sie
gehört, oder sobald man auf der Karte etwas Neues beginnt.
