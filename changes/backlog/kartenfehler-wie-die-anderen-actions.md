---
effort: XS
complexity: XS
utility: S
---

# Kartenaktionen melden Fehler anders als die übrigen Actions

Wirft eine Aktion direkt auf der Karte (Kartenzeichen platzieren, Bereich
zeichnen oder neu zeichnen, verschieben), zeigt `runMapAction` in
`src/map/SituationWorkspace.tsx` „Aktion fehlgeschlagen. Bitte erneut
versuchen.“. Alle anderen Stellen zeigen in diesem Fall „Das hat nicht
geklappt. Bitte erneut versuchen.“ (`ACTION_FAILED` in
`src/app/action-failure.ts`).

Außerdem erkennt `runMapAction` keinen Redirect (`isNextNavigation`). Ist die
Sitzung abgelaufen, erscheint die Meldung kurz unten auf der Karte, bevor die
Anmeldeseite kommt.

Vom Review von „Einsatz-Actions vereinheitlichen“ gesehen (2026-09-30); war
schon vorher so und lag außerhalb dieser Änderung.

Gewünscht: Kartenaktionen zeigen bei einem unerwarteten Fehler denselben Text
wie die übrigen Actions, und bei einer abgelaufenen Sitzung kommt die
Anmeldeseite ohne Meldung davor.
