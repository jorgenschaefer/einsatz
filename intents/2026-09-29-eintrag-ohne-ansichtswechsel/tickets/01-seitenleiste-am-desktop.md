---
solution:  02-SOLUTION.md
satisfies: AC-1, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
after:
status:    ready
attempts:  0
---

## Build

Am Desktop wird die Lageführungsseite zu „Karte links, Seitenleiste rechts":
Die Lagekarte ist immer sichtbar. Rechts steht eine 360 px breite
Seitenleiste mit der Hauptansichtsleiste (Lagekarte, ETB, Stärke) unten und
der gewählten Ansicht darüber. Unter „Lagekarte" steht dort das Kartenpanel.
Die Leiste links entfällt. Die Startansicht ist bei beiden Breiten das ETB.
Am Smartphone bleibt alles, wie es ist.

## Done when

> **AC-1** Am Desktop füllt die Lagekarte die Fläche links neben einer
> 360 px breiten Seitenleiste, unabhängig davon, was die Seitenleiste zeigt.
> Unten in der Seitenleiste stehen die Knöpfe „Lagekarte", „ETB" und
> „Stärke", darüber die gewählte Ansicht. Links gibt es keine Leiste.

> **AC-3** Zeigt die Seitenleiste das ETB, ist ein neuer Eintrag: ins Feld
> klicken, tippen, mit Strg+Enter oder „Eintrag hinzufügen" absenden. Danach zeigt die
> Seitenleiste weiter das ETB, und die Karte hat denselben Ausschnitt und
> denselben Modus wie vorher.

> **AC-4** Zeigt die Seitenleiste „Stärke", öffnet ein Klick auf eine Stelle
> deren Meldungsformular. Nach „Melden" oder „Unverändert melden" zeigt die
> Seitenleiste wieder die Übersicht der Stellen, und die Karte hat denselben
> Ausschnitt und Modus wie vorher.

> **AC-6** Ein Mausklick oder Ziehen auf der Karte wirkt direkt nach dem
> Absenden aus AC-3 oder AC-4, ohne dass vorher etwas angeklickt werden muss
> (Ziehen verschiebt die Karte, ein Klick auf ein Kartenzeichen öffnet es).

> **AC-7** ETB und Stärke bleiben beim Wechsel eingehängt. Ein angefangener
> ETB-Eintrag oder ein angefangenes Meldungsformular ist nach einem Wechsel
> zu „Lagekarte" oder nach Arbeit an der Karte unverändert da.

> **AC-8** Zeigt die Seitenleiste nicht das ETB, zählt der Knopf „ETB" die
> neuen Einträge anderer, nach denselben Regeln wie heute die
> Hauptansichtsleiste (`countUnseenEntries`).

> **AC-9** Unter „Lagekarte" zeigt die Seitenleiste am Desktop immer genau
> eines der Panels Kartenzeichen, Bereiche oder Ebenen: nach dem Laden
> Kartenzeichen, danach das zuletzt gewählte. Ein Klick auf einen Kartenknopf
> stellt die Seitenleiste auf „Lagekarte" mit diesem Panel. Ein erneuter
> Klick auf den Knopf des gezeigten Panels ändert nichts. Der Knopf des
> gezeigten Panels ist hervorgehoben, solange die Seitenleiste „Lagekarte"
> zeigt. Am Desktop hat das Panel keinen „Schließen"-Knopf.

> **AC-10** Nach dem Laden zeigt die Seitenleiste am Desktop das ETB, auch
> schon vor der Hydration, ohne sichtbares Umspringen.

> **AC-11** Am Smartphone (unter 48 em) verhält sich alles wie vor dieser
> Änderung: Leiste unten mit Lagekarte, ETB und Stärke, Startansicht ETB,
> Kartenpanel als Blatt über der Karte mit „Schließen", kein automatischer
> Cursor im ETB-Feld.

Randfälle aus der Lösung, die dieses Ticket trägt:

> **Wechsel über die Schwelle.** Die gewählte Ansicht bleibt erhalten.
> Desktop → Smartphone mit „Lagekarte": Das Smartphone zeigt die Karte. Wurde
> am Desktop ein Kartenknopf gedrückt, ist dessen Panel als Blatt offen,
> sonst ist das Blatt geschlossen. Smartphone → Desktop mit geschlossenem
> Blatt: Unter „Lagekarte" steht Kartenzeichen. (Vom Nutzer beim Schneiden
> so gewählt: „Was einfacher ist.")

> **Stärke nicht in der Übersicht verlassen.** Ein Klick auf „Stärke" zeigt
> die Stärke so, wie sie verlassen wurde, wie heute. Stand dort noch ein
> Formular, der Verlauf einer Stelle, der Summenverlauf, das Umbenennen oder
> Anlegen einer Stelle oder eine Korrektur, braucht eine Meldung für eine
> andere Stelle „Zurück" und dann die Stelle. Kommt die Führungskraft vom
> ETB, sind das zwei Aktionen vor dem Ausfüllen („Stärke", „Zurück"). Ein
> angefangenes Formular geht dabei verloren, wie heute. Diese Ausnahme von
> C-2 hat der Nutzer hingenommen (siehe `Accepted tradeoffs`).

> **Modals.** Bereich-Editor, Kartenzeichen-Details und „Kartenzeichen
> zusammensetzen" bleiben Modals über allem, wie heute.

## Context

Anlass: Am Desktop kostet heute jeder ETB-Eintrag und jede Stärkemeldung von
der Karte aus zwei Klicks extra (zum ETB und zurück), weil die
Hauptansichten sich gegenseitig ersetzen (seit `838f32c`). Die Seitenleiste
hält die Karte sichtbar, während ETB oder Stärke daneben stehen. Die Form hat
der Nutzer festgelegt (`IDEAS.md`, Thema 4, plus seine Entscheidungen: die
Leiste unten, „Lagekarte" als dritter Knopf, der das Kartenpanel in der
Seitenleiste zeigt, dort immer ein Panel offen).

Was es heute gibt:

- `src/map/SituationWorkspace.tsx`: Zustand `mainView`
  (`"map" | "etb" | "strength" | "default"`). Ein Mount-Effekt setzt die
  Startansicht nach Breite (Desktop `map`, Smartphone `etb`), bewusst ohne
  Listener. Die drei Bereiche `[data-view="map"]` (`.map-view` mit
  `.map-area` und dem bedingt gerenderten `.map-panel`), `[data-view="etb"]`
  und `[data-view="strength"]` werden über Inline-`display` ein- und
  ausgeblendet. `isPhone()` und `WIDE_QUERY = "(min-width: 48em)"` stehen
  dort. `togglePanel` öffnet oder schließt ein Panel, `closeSheetOnPhone`
  schließt das Blatt nur am Smartphone. Das Panel hat einen
  „Schließen"-Knopf.
- `src/map/situation-workspace.css`: die Regeln vor der Hydration auf
  `[data-main-view="default"]`, das Panel als Blatt (Smartphone) bzw. als
  360-px-Spalte (Desktop), `.etb-pane`/`.strength-pane` mit `max-width: 720px`
  am Desktop.
- `src/app/operations/[id]/LageansichtShell.tsx`: rendert die übergebene
  `navigation` zweimal, als `AppShell.Navbar` (Desktop, 72 px, `visibleFrom="sm"`)
  und als `AppShell.Footer` (Smartphone, `hiddenFrom="sm"`, weicht der
  Bildschirmtastatur).
- `src/map/MainViewBar.tsx` und `main-view-bar.css`: die Leiste, am Desktop
  als Spalte.
- `src/map/MapControls.tsx`: Kartenknöpfe, `aria-pressed` für das offene
  Panel.
- `src/map/SituationWorkspace.test.tsx`: `stubMatchMedia(matches)` simuliert
  die Breite, `selectMainView` klickt das erste Vorkommen eines
  Leistenknopfs. Vitest lädt kein CSS; Sichtbarkeit ist in jsdom nur über
  Inline-Stile und An-/Abwesenheit von Elementen prüfbar.

Die Stärke-Ansicht (`src/strength/StrengthPanel.tsx`) kehrt nach „Melden"
schon heute zur Übersicht zurück und bleibt unverändert.

## Plan

Entschieden und teuer umzukehren: Die Breite kommt künftig aus einem Hook mit
Listener, der vor dem Mount `null` liefert. Die gewählte Ansicht bleibt davon
unabhängig. Nur solange die Breite unbekannt ist (Server-Rendering, erster
Client-Render), entscheidet CSS über die Karte. `data-main-view="default"`
entfällt, weil beide Breiten mit dem ETB starten.

1. **Breite als Hook.** Neuer Hook `useIsDesktop(): boolean | null` (neu:
   `src/map/useIsDesktop.ts`): `null` bis zum Mount, danach
   `matchMedia("(min-width: 48em)").matches`, aktualisiert über den
   `change`-Listener. Beweis: neuer Test `src/map/useIsDesktop.test.ts`
   (null beim Server-Render über `renderToString`, true/false nach Mount,
   Wechsel bei `change`).
2. **Startansicht ETB bei beiden Breiten.** `mainView` startet als `"etb"`;
   der Mount-Effekt und der Wert `"default"` entfallen. In `MainViewBar.tsx`
   verliert `activeView` das `"default"`. Beweis: Test „starts on the
   Lagekarte on the desktop" wird zu „starts on the ETB on the desktop"
   (ETB-Feld sichtbar, Karte sichtbar), der SSR-Test prüft statt
   `data-main-view="default"`, dass das ETB im Server-Markup kein
   `display: none` trägt und `.map-area` kein Inline-`display` hat (AC-10).
3. **Sichtbarkeit nach Breite und Ansicht.** In `SituationWorkspace.tsx` wird
   die Inline-Sichtbarkeit aus `isDesktop` und `mainView` berechnet:
   `.map-area` ist am Desktop immer sichtbar, am Smartphone nur bei `map`,
   bei unbekannter Breite ohne Inline-Stil. ETB und Stärke wie heute nur
   nach `mainView`. `isPhone()` wird durch `isDesktop === false` ersetzt.
   Beweis: neue Tests mit `stubMatchMedia(true)`: Karte (z. B. der Knopf
   „Zum Standard-Ausschnitt zurück") ist bei ETB und bei Stärke sichtbar;
   mit `stubMatchMedia(false)` bleibt „starts on the ETB on a phone" grün.
4. **Kartenpanel in der Seitenleiste.** Am Desktop wird das Panel gerendert,
   wenn `mainView === "map"`, und zeigt `openPanel ?? "symbols"`. Ein
   Kartenknopf setzt am Desktop `openPanel` auf sein Panel und `mainView`
   auf `"map"` (kein Umschalten mehr); am Smartphone bleibt `togglePanel`.
   `MapControls` bekommt als `openPanel` am Desktop das gezeigte Panel, wenn
   die Seitenleiste „Lagekarte" zeigt, sonst `null`. Der „Schließen"-Knopf
   wird am Desktop nicht gerendert. Beweis: neue Desktop-Tests zu AC-9
   (nach Wechsel zu „Lagekarte" ist die Region „Kartenzeichen" da; Klick auf
   „Bereiche" zeigt Bereiche und `aria-pressed`; zweiter Klick ändert
   nichts; kein „Schließen"; Klick auf „Ebenen" bei gezeigtem ETB stellt auf
   „Lagekarte" mit Ebenen). Die Tests „switches and closes map panels …",
   „opens no map panel at start" und „keeps the open map panel as the right
   panel when the width crosses 768 px" werden auf die Smartphone-Breite
   bzw. auf den Randfall „Wechsel über die Schwelle" umgeschrieben.
5. **Randfall Schwelle.** Test mit `stubMatchMedia(false)` → Panel öffnen →
   `fireChange(true)`: Seitenleiste zeigt dieses Panel; zurück mit
   `fireChange(false)`: Karte mit dem Panel als Blatt. Und: am Desktop ohne
   Kartenknopf auf „Lagekarte" → `fireChange(false)`: Karte ohne Blatt.
   Smartphone mit geschlossenem Blatt → Desktop: „Kartenzeichen".
6. **Layout: Karte links, Seitenleiste rechts, Leiste unten.** In
   `situation-workspace.css` ab 48 em ein Raster: `.map-area` links über die
   volle Höhe, rechts 360 px mit Panel bzw. ETB bzw. Stärke oben und der
   Leiste unten, Trennlinie links an der Seitenleiste. `.map-view` wird am
   Desktop `display: contents`, damit `.map-area` und `.map-panel` Zellen
   des Rasters werden, ohne den DOM umzuhängen (Karte wird nicht neu
   erzeugt). `max-width: 720px` für ETB/Stärke entfällt. Die Regeln auf
   `[data-main-view="default"]` werden ersetzt durch eine Regel, die bei
   unbekannter Breite (`data-layout="unknown"` am Container) `.map-area`
   unter 48 em ausblendet. Die Seitenleisten-Leiste ist ein zweites
   `<MainViewBar>` im Workspace, nur ab 48 em sichtbar (`visibleFrom="sm"`
   o. ä.); `main-view-bar.css` verliert die Spalten-Form. Beweis: Test „does
   not recreate the map when switching views" und ein neuer Test „does not
   recreate the map when the width crosses 768 px" bleiben grün;
   Sichtprüfung im Browser über den Skill `run-einsatz` bei 1280 px (Karte
   links, Seitenleiste 360 px, Leiste unten, bei Lagekarte/ETB/Stärke) und
   bei 360 px (unverändert gegenüber vorher).
7. **Linke Leiste weg.** `LageansichtShell.tsx`: `AppShell.Navbar` und
   `navbar`-Konfiguration entfallen, `navigation` geht nur noch in den
   Footer. Beweis: Test in `LageansichtShell.test.tsx` (falls vorhanden,
   sonst im Workspace-Test), dass keine `navigation`-Rolle/Navbar mehr
   gerendert wird; Footer-Test „hides the phone bar while the on-screen
   keyboard is open …" bleibt grün.
8. **ETB-Eintrag und Stärkemeldung neben der Karte.** Desktop-Tests für
   AC-3/AC-4/AC-6: Eintrag per Strg+Enter absenden → ETB weiter gezeigt,
   `adapter.setView` nicht aufgerufen, ein über `captured.options`
   ausgelöster Kartenzeichen-Klick öffnet direkt danach den
   Kartenzeichen-Dialog; ebenso nach „Melden" einer Stelle (Übersicht
   wieder da). AC-7/AC-8: die bestehenden Tests zum Eingehängt-Bleiben und
   Zählen laufen zusätzlich mit `stubMatchMedia(true)`.
9. `npm run check` grün.

## Not here

- Cursor ins ETB-Feld beim Klick auf „ETB" und das feste Eingabefeld unten
  (AC-2, AC-12): Ticket 02.
- Karten-Modus bleibt am Desktop beim Wechsel erhalten (AC-5): Ticket 03.
  Hier beendet `switchMainView` den Modus weiter bei jedem Wechsel, auch
  über einen Kartenknopf.
- Aus den Non-goals der Lösung: Karte und Kartenpanel gleichzeitig mit ETB
  oder Stärke sehen (die Seitenleiste zeigt immer genau eine Ansicht);
  Tastenkürzel für ETB oder Stärke; eine verstellbare oder einklappbare
  Seitenleiste; Änderungen an Ansichts- und Geräteansicht (`DeviceView`).
- Keine Änderung an `StrengthPanel` (Randfall „Stärke nicht in der
  Übersicht verlassen").
