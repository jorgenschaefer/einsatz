---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4
advances:
after:
status:    done
attempts:  0
---

## Build
In den KML-Zeilen des Ebenen-Panels (Datei und URL) rutschen „Neu laden“ und
„Entfernen“ rechtsbündig in eine eigene Zeile unter dem Namen, sobald der Name
einzeilig nicht neben sie passt; der Name nutzt dann die volle Breite neben
dem Schalter. Kurze Namen bleiben einzeilig wie bisher.

## Done when
Anführungszeichen in den ACs grenzen nur Texte der Oberfläche ab. Welche
Anführungszeichen die Oberfläche selbst zeigt, legen sie nicht fest.

> **AC-1** Eine KML-Zeile im Ebenen-Panel (Datei oder URL), deren Name einzeilig neben ihre Knöpfe passt, etwa „Strecke“, steht bei 390×844 und bei 1280×800 in einer einzeiligen Zeile: Schalter, Name und Knöpfe nebeneinander wie bisher.

> **AC-2** Eine KML-URL mit dem Namen „KmlUrlMitSehrLangemNamenOhneLeerzeichenUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU“ (80 Zeichen, wie bei der Abnahme am 2026-09-30) bricht bei 1280×800 auf höchstens fünf Zeilen um und bei 390×844 auf höchstens vier; „Neu laden“ und „Entfernen“ sind vollständig zu sehen, liegen im Panel und sind ohne seitliches Scrollen antippbar.

> **AC-3** Mit je einer KML-Datei, einer KML-URL und einem Bild-Overlay mit 80-Zeichen-Namen ohne Leerzeichen scrollt das Panel bei 390×844 und bei 1280×800 nicht seitlich, jeder Name ist vollständig zu sehen (umgebrochen, nicht mit „…“ gekürzt), und die Schalter sowie die Knöpfe „Entfernen“, „Neu laden“ und „Bearbeiten“ liegen in allen drei Zeilen im Panel und sind ohne seitliches Scrollen antippbar.

> **AC-4** Die Zeilen der Bild-Overlays sehen bei 390×844 und bei 1280×800 aus wie vor dieser Änderung.

## Nudges
> In `overlayRow` (`src/map/KmlPanel.tsx`) die Zeilen-`Group` von `wrap="nowrap"` auf `wrap="wrap"` stellen; der `Switch` wird Flex-Element mit `flex: "1 1 auto"` und `maxWidth: "100%"`, die `Group` der Knöpfe bekommt `marginLeft: "auto"`. In Mantine 9 prüfen, an welchem Element `style` am `Switch` landet. `WRAPPING_SWITCH_LABEL` bleibt.

> `ImageOverlayPanel` nicht anfassen.

> AC-1 bis AC-4 im Browser bei 390×844 und 1280×800 prüfen (Skill `run-einsatz`), weil jsdom kein Layout rechnet; die KML-URL-Overlays dafür direkt in die Dev-Datenbank schreiben, weil `src/server/kml/kml-fetch.ts` localhost und private Adressen sperrt.

## Context
Anlass: Bei der Abnahme am 2026-09-30 hatte eine KML-URL mit 80-Zeichen-Namen
neben „Neu laden“ und „Entfernen“ bei 1280×800 nur eine 73 px breite
Namensspalte und brach 14-zeilig um (Zeile 280 px hoch), bei 390×844
9-zeilig. Eine KML-URL ohne eingetragenen Namen heißt nach ihrer ganzen URL;
das bleibt so.

- Beide Arten von KML-Zeile baut `overlayRow` in `src/map/KmlPanel.tsx`:
  `<Paper withBorder p="sm">` mit
  `<Group justify="space-between" align="flex-start" wrap="nowrap">`, darin
  ein `Switch` (`styles={WRAPPING_SWITCH_LABEL}`, `label={overlay.name}`) und
  eine `<Group gap="xs" wrap="nowrap">` mit „Neu laden“ (nur
  `sourceType === "url"`) und „Entfernen“.
- `WRAPPING_SWITCH_LABEL` (`src/map/wrapping-switch-label.ts`) setzt
  `overflowWrap: "anywhere"` am Label; es wird auch von
  `src/map/ImageOverlayPanel.tsx` benutzt und bleibt unverändert.
- `style` am Mantine-9-`Switch` landet am Root-Element
  (`node_modules/@mantine/core/esm/components/Switch/Switch.mjs`,
  `getStyles("root")`), also an dem Element, das Flex-Element der Zeile ist.
- Warum das Umbrechen so funktioniert: Mit `flex: 1 1 auto` ist die
  Ausgangsbreite des Schalters die Breite des ungebrochenen Namens. Passt die
  nicht neben die Knöpfe, bricht die Flex-Zeile um, die Knöpfe gehen in die
  zweite Zeile und rücken per `marginLeft: "auto"` nach rechts; `maxWidth:
  "100%"` hält den Schalter in der Zeile, und der Name bricht dann innerhalb
  der vollen Breite um.
- `src/map/KmlPanel.test.tsx` hat schon „lets a long name without spaces wrap,
  with switch and buttons at the top of the row“ (prüft `overflowWrap` und
  `--group-align: flex-start`); der bleibt grün.

Das vereinbarte Aussehen zeigt der Specimen
<https://claude.ai/artifact/6eXApbiRp3H4xWqWKAL2VE>, Kopie in
`changes/2026-09-30-lange-kml-namen/specimens/knopf-lage.html`: kurze Namen
einzeilig, bei langen Namen die Knöpfe rechtsbündig in einer zweiten Zeile.
**Agreed; build to this, do not redesign.**

## Plan
1. **Vergleichswerte im Browser, vor jeder Änderung (für AC-1, AC-4).** Mit
   dem Skill `run-einsatz` einen Einsatz anlegen; im Ebenen-Panel eine
   KML-Datei „Strecke.kml“ und eine mit einem 80-Zeichen-Dateinamen ohne
   Leerzeichen hochladen, dazu ein Bild-Overlay „Strecke.png“ und eines mit
   80-Zeichen-Dateinamen. Die beiden KML-URL-Overlays direkt in die
   Dev-Datenbank schreiben:
   `INSERT INTO kml_overlays (id, operation_id, source_type, source_url, name, content) VALUES (gen_random_uuid(), '<Einsatz-ID>', 'url', 'https://example.org/strecke.kml', '<Name>', '<Inhalt einer gültigen KML-Datei>')`
   mit den Namen „Strecke“ und
   „KmlUrlMitSehrLangemNamenOhneLeerzeichenUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU“
   (Spalten wie in `src/server/kml/kml-overlays.ts`). Bei 390×844 und
   1280×800 je Zeile Höhe, Breite des Labels und Lage der Knöpfe messen und
   notieren; die Bild-Overlay-Zeilen sind der Vergleichswert für AC-4, die
   „Strecke“-Zeilen für AC-1. Beweis: notierte Messwerte und Screenshots.
2. **Stil pinnen, rot.** In `src/map/KmlPanel.test.tsx` einen Test, der für
   eine Datei- und eine URL-Zeile prüft: die Zeilen-`Group` trägt
   `--group-wrap: wrap`, das Root-Element des `Switch` (`.mantine-Switch-root`
   in der Zeile) hat `flex: 1 1 auto` und `max-width: 100%`, und die `Group`
   um „Entfernen“ hat `margin-left: auto`. Beweis: der Test scheitert, weil
   die Zeile heute `nowrap` ist.
3. **Zeile umbauen, grün.** In `overlayRow` (`src/map/KmlPanel.tsx`) die
   Zeilen-`Group` auf `wrap="wrap"`, am `Switch`
   `style={{ flex: "1 1 auto", maxWidth: "100%" }}`, an der Knopf-`Group`
   `style={{ marginLeft: "auto" }}`. `justify`, `align="flex-start"` und
   `WRAPPING_SWITCH_LABEL` bleiben. Den bestehenden Test „lets a long name
   without spaces wrap, with switch and buttons at the top of the row“ in
   „lets a long name without spaces wrap, with the row aligned at the top“
   umbenennen, weil die Knöpfe bei seinem Namen jetzt in die zweite Zeile
   rutschen; seine Prüfungen bleiben. Beweis: Test aus Schritt 2 und der
   umbenannte Test grün.
4. **Browser (AC-1 bis AC-4).** Denselben Einsatz wie in Schritt 1 bei
   390×844 und 1280×800 öffnen, Ebenen-Panel:
   - die „Strecke“-Zeilen (Datei und URL) einzeilig, gleiche Höhe wie in
     Schritt 1 (AC-1);
   - die lange KML-URL höchstens fünf Zeilen bei 1280 und höchstens vier bei
     390, „Neu laden“ und „Entfernen“ vollständig, rechtsbündig darunter, im
     Panel, antippbar – „Entfernen“ antippen, Rückfrage erscheint, abbrechen
     (AC-2);
   - `scrollWidth` des Panels nicht größer als seine Breite, kein Name mit
     „…“, alle Schalter und Knöpfe der drei langen Zeilen im Panel (AC-3);
   - die Bild-Overlay-Zeilen mit denselben Werten wie in Schritt 1 (AC-4).
   Den Test-Einsatz danach löschen. Beweis: Messwerte und Screenshots je
   Breite im Record.
5. `npm run check` grün.

## Not here
- `src/map/ImageOverlayPanel.tsx` und die Zeilen der Bild-Overlays bleiben,
  wie sie sind.
- Der Name, den eine KML-URL ohne eingetragenen Namen bekommt: Er bleibt die
  ganze URL (`addKmlUrlAction` in `src/app/operations/[id]/kml-actions.ts`
  nicht anfassen).
- Die Kürzung in `PanelRow` und `ViewLinkPanel` bleibt, wie sie ist.

## Record
- **AC-1:** im Browser bei 390×844 und 1280×800: „Strecke“ als KML-Datei und als KML-URL je einzeilig, Knöpfe neben dem Namen, Zeile 56 px hoch wie vorher. Der Stil ist gepinnt in `src/map/KmlPanel.test.tsx` › „lets the row wrap, with the name growing and the buttons right-aligned“.
- **AC-2:** im Browser: die KML-URL mit dem 80-Zeichen-Namen aus AC-2 bricht bei 1280×800 dreizeilig um (Name 272 px breit, Zeile 132 px statt 280 px) und bei 390×844 dreizeilig (302 px); „Neu laden“ und „Entfernen“ rechtsbündig darunter, im Panel; „Entfernen“ bei 390 angetippt, Rückfrage erschien, abgebrochen. Stil gepinnt durch denselben Test.
- **AC-3:** im Browser bei beiden Breiten: `scrollWidth` des Panels gleich seiner Breite (360 bzw. 390 px), kein Name mit „…“ (`text-overflow: clip`, Label nicht abgeschnitten), alle Schalter und Knöpfe der langen KML-Datei, KML-URL und des Bild-Overlays im Panel. Umbruch des Labels gepinnt durch „lets a long name without spaces wrap, with the row aligned at the top“.
- **AC-4:** im Browser: die lange Bild-Overlay-Zeile hat bei 1280×800 ein 164 px breites, fünfzeiliges Label und „Bearbeiten“ bei 1163–1255, bei 390×844 194 px, vierzeilig, „Bearbeiten“ bei 273–365 – dieselben Werte wie bei der Abnahme am 2026-09-30 auf dem Stand vor dieser Änderung. `ImageOverlayPanel.tsx` ist nicht im Diff.
- Checks: `npm run check` grün (127 Testdateien, 1221 Tests).

### Left standing
- **Vergleichswerte aus der Abnahme statt eigener Messung (Plan, Schritt 1):** Die Werte „vorher“ für AC-1 und AC-4 stammen aus der Abnahme von „Rückfragen nennen ihr Ziel“ am 2026-09-30 auf demselben Code (`aea5971`, seitdem unverändert), nicht aus einem eigenen Lauf vor dem Umbau.
- **Test pinnt Stile, nicht Layout:** jsdom rechnet kein Layout; ob die Knöpfe tatsächlich umbrechen, zeigt nur der Browser.
- **Review:** ein Durchgang in frischem Kontext, keine Blocker, nichts zu beheben; ein Nit (Testtitel versprach einen langen Namen, den der Test nicht rendert) behoben durch Umbenennen. In der Konsole zwei HTTP-500 vom kaputten Standard-Marker in KML (schon im Backlog, `a014c00`), nicht von dieser Änderung.
