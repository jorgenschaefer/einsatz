# Criteria: Lange KML-Namen bekommen Platz

## Problem
Im Ebenen-Panel der Lagekarte bricht der Name einer KML-URL neben den Knöpfen
„Neu laden“ und „Entfernen“ zu einer sehr hohen, schmalen Spalte um. Eine
solche Zeile drängt die übrigen Ebenen aus dem Blick, am Desktop mehr als am
Handy, weil das Panel dort schmaler ist. Stattdessen soll ein langer Name so
viel Breite bekommen, dass seine Zeile nicht viel höher wird als die einer
langen KML-Datei, ohne dass ein Name gekürzt wird oder ein Knopf aus dem
Panel rutscht.

Häufig ist das, weil eine KML-URL ohne eingetragenen Namen heute die ganze URL
als Namen bekommt (`addKmlUrlAction` in
`src/app/operations/[id]/kml-actions.ts`).

Aufgefallen bei der Abnahme von „Rückfragen nennen ihr Ziel, lange Namen
bleiben erreichbar“ am 2026-09-30 im Browser: Eine KML-URL mit einem Namen aus
80 Zeichen ohne Leerzeichen hatte bei 1280×800 eine 73 px breite Namensspalte,
brach 14-zeilig um und machte ihre Zeile 280 px hoch; bei 390×844 waren es
9 Zeilen. Der Record des Tickets nannte das schon als Hinweis für die Abnahme
(Ticket `01-rueckfrage-und-lange-namen.md` unter
`changes/2026-09-30-ziel-erkennbar-und-erreichbar/`, mit Commit `e27da95`
entfernt, in der Git-Historie nachzulesen).

## Acceptance criteria
Anführungszeichen in den ACs grenzen nur Texte der Oberfläche ab. Welche
Anführungszeichen die Oberfläche selbst zeigt, legen sie nicht fest.

- **AC-1** Eine KML-Zeile im Ebenen-Panel (Datei oder URL), deren Name einzeilig neben ihre Knöpfe passt, etwa „Strecke“, steht bei 390×844 und bei 1280×800 in einer einzeiligen Zeile: Schalter, Name und Knöpfe nebeneinander wie bisher.
- **AC-2** Eine KML-URL mit dem Namen „KmlUrlMitSehrLangemNamenOhneLeerzeichenUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU“ (80 Zeichen, wie bei der Abnahme am 2026-09-30) bricht bei 1280×800 auf höchstens fünf Zeilen um und bei 390×844 auf höchstens vier; „Neu laden“ und „Entfernen“ sind vollständig zu sehen, liegen im Panel und sind ohne seitliches Scrollen antippbar.
- **AC-3** Mit je einer KML-Datei, einer KML-URL und einem Bild-Overlay mit 80-Zeichen-Namen ohne Leerzeichen scrollt das Panel bei 390×844 und bei 1280×800 nicht seitlich, jeder Name ist vollständig zu sehen (umgebrochen, nicht mit „…“ gekürzt), und die Schalter sowie die Knöpfe „Entfernen“, „Neu laden“ und „Bearbeiten“ liegen in allen drei Zeilen im Panel und sind ohne seitliches Scrollen antippbar.
- **AC-4** Die Zeilen der Bild-Overlays sehen bei 390×844 und bei 1280×800 aus wie vor dieser Änderung.

## Agreed design
Passt der Name einzeilig nicht neben die Knöpfe, rutschen die Knöpfe
rechtsbündig in eine eigene Zeile darunter, und der Name nutzt die volle
Breite neben dem Schalter. Das gilt für die Zeilen der KML-Dateien und der
KML-URLs gleichermaßen; kurze Namen bleiben einzeilig wie bisher.

Specimen: <https://claude.ai/artifact/6eXApbiRp3H4xWqWKAL2VE>, Kopie in
[`specimens/knopf-lage.html`](specimens/knopf-lage.html).

**Agreed; build to this, do not redesign.**

## Nudges
- In `overlayRow` (`src/map/KmlPanel.tsx`) die Zeilen-`Group` von `wrap="nowrap"` auf `wrap="wrap"` stellen; der `Switch` wird Flex-Element mit `flex: "1 1 auto"` und `maxWidth: "100%"`, die `Group` der Knöpfe bekommt `marginLeft: "auto"`. In Mantine 9 prüfen, an welchem Element `style` am `Switch` landet. `WRAPPING_SWITCH_LABEL` bleibt.
- `ImageOverlayPanel` nicht anfassen.
- AC-1 bis AC-4 im Browser bei 390×844 und 1280×800 prüfen (Skill `run-einsatz`), weil jsdom kein Layout rechnet; die KML-URL-Overlays dafür direkt in die Dev-Datenbank schreiben, weil `src/server/kml/kml-fetch.ts` localhost und private Adressen sperrt.

## Out of scope
- Der Name, den eine KML-URL ohne eingetragenen Namen bekommt: Er bleibt die ganze URL.
- Die Zeilen der Bild-Overlays.

## Ruled out
- **Name mit „…“ kürzen, voller Name beim Hover** - verbirgt das Ende, an dem sich Dateinamen meist unterscheiden, und Hover gibt es am Handy nicht.
- **„Neu laden“ und „Entfernen“ in ein Menü „⋯“** - die Rückmeldung nach „Neu laden“ bräuchte einen neuen Ort, weil sich das Menü beim Antippen schließt; zu aufwendig für das Problem.
- **Symbol-Knöpfe statt Text-Knöpfe** - verlieren ihre Beschriftung und sind als Touch-Ziel klein.
- **Knöpfe immer unter dem Namen** - macht jede Zeile zweizeilig, auch bei kurzem Namen.
- **Name aus dem letzten Pfadabschnitt der URL** - Google-„Meine Karten“-URLs (`…/maps/d/viewer?mid=…`) hießen dann alle „viewer“ oder „edit“ und wären im Panel und in der Rückfrage nicht mehr zu unterscheiden; ohne ihn löst der Umbruch das Problem allein.
