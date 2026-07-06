# Feature: Kartenseiten – UI-Feinschliff

## Why
Fünf kleine, unabhängige Korrekturen an den Kartenseiten: die „Ebenen"-Liste
ist ohne Gliederung unübersichtlich, die vier Sidebar-Tabs brechen unschön 3+1
um, der **Ansichtslink** zeigt fälschlich einen Footer (Seite wird höher als
das Fenster), die Login-Seite zeigt zwei identische Footer, und der Rücksprung
zum Standard-Ausschnitt fehlt auf **Geräteansicht** und **Ansichtslink** bzw.
nutzt in der Lageansicht ein unklares Glyph statt eines Home-Icons. Zugleich
lösen wir die uneinheitlichen Unicode-Glyphen und das bespoke Inline-SVG durch
`@tabler/icons-react` ab – konsistent mit unseren übrigen Projekten und mit
Mantines Design.

## Success criteria
- Die „Ebenen"-Tab zeigt drei beschriftete Abschnitte: **KML-Datei**,
  **KML-URL**, **Bild-Overlays**.
- Die vier Sidebar-Tabs stehen in einem 2×2-Raster (nicht 3+1).
- Keine der drei Kartenseiten (Lageansicht, Geräteansicht, Ansichtslink) zeigt
  den globalen Footer; die Seite bleibt exakt fensterhoch.
- Die Login-Seite zeigt genau **einen** Footer.
- Alle drei Kartenseiten haben unten rechts einen „Zum Standard-Ausschnitt
  zurück"-Knopf mit Home-Icon; er springt auf `operationDefaultView`.
- Alle echten Icon-Stellen nutzen `@tabler/icons-react` statt Unicode-Glyphen
  bzw. bespoke Inline-SVG; die Optik ist einheitlich.

## Non-goals
- Keine Änderung an Inhalt oder Funktion der Panels (KML/Bild) außer der
  Gruppierung und den Überschriften.
- Kein neuer Basiskarten-/Kartenhintergrund-Umschalter.
- Keine Änderung an Ortung, Sperren oder Suchleiste der Kartenseiten.
- Kein Austausch von Satzzeichen im Fließtext, die keine Icons sind (`✓` in
  „Standort wird gesendet ✓", `→` in „Zum Entsperren wischen →").

## Preconditions
- Baseline des Repos inkl. der laufenden KMZ-Arbeit am `KmlPanel`
  (`extractKml` in `src/server/kml/kmz.ts`) – der Ebenen-Umbau setzt darauf auf.

## Domain

### Ubiquitous language
- **Lageansicht** – die bearbeitbare Kartenseite `/operations/[id]`
  (`SituationWorkspace`).
- **Geräteansicht** – die meldende Kartenseite `/device/[token]`
  (`DeviceView`).
- **Ansichtslink** – die nur-lesende Kartenseite `/view/[token]`
  (`ViewLinkView`).
- **Standard-Ausschnitt** (`operationDefaultView`) – der je **Einsatz**
  gespeicherte Standard-Kartenausschnitt (`MapView | null`).

### Roles
- **Führungskraft** – bedient die Lageansicht (volle Bearbeitung).
- **Gerät** / **Beobachter** – nutzen Geräteansicht bzw. Ansichtslink ohne
  Login; nur Kartennutzung, kein Bearbeiten.

## User Stories

- **As a** Führungskraft, **I want to** die „Ebenen"-Tab in drei beschriftete
  Abschnitte gegliedert sehen, **so that** ich KML-Dateien, KML-URLs und
  Bild-Overlays auf einen Blick auseinanderhalte.
  - given die Ebenen-Tab ist geöffnet, when sie rendert, then erscheinen genau
    drei Überschriften in der Reihenfolge „KML-Datei", „KML-URL",
    „Bild-Overlays".
  - given ein KML-Overlay mit `sourceType === "file"`, when die Ebenen-Tab
    rendert, then steht es unter „KML-Datei"; given `sourceType === "url"`,
    then steht es unter „KML-URL".
  - given kein KML-Overlay einer Quelle vorhanden, when der zugehörige
    Abschnitt rendert, then zeigt er seinen eigenen Leer-Hinweistext.
  - _Why: die Trennung nach Quelle ist der eigentliche Zweck der drei
    Abschnitte – ein reiner Header über einer gemischten Liste erfüllt die
    Anforderung nicht._

- **As a** Führungskraft, **I want to** die vier Sidebar-Tabs im 2×2-Raster
  sehen, **so that** sie in der 360 px schmalen Sidebar sauber statt 3+1
  umbrechen.
  - given die Sidebar ist offen, when die Tab-Leiste rendert, then liegen die
    vier Tabs (Einsatztagebuch, Kartenzeichen, Bereiche, Ebenen) in zwei Reihen
    zu je zwei Spalten.
  - given ein Tab ist aktiv, when ich einen anderen wähle, then wechselt der
    Inhalt wie bisher (kein Funktionsverlust durch das Layout).

- **As a** Beobachter, **I want to** die Ansichtslink-Seite ohne Footer sehen,
  **so that** die Karte exakt das Fenster füllt und nicht überläuft.
  - given ich öffne `/view/<token>`, when die Seite rendert, then erscheint der
    globale Footer nicht.
  - given ich öffne `/operations/<id>` oder `/device/<token>`, when die Seite
    rendert, then erscheint der Footer weiterhin nicht (unverändert).
  - given ich öffne eine Nicht-Kartenseite (z. B. `/operations`, `/account`),
    when sie rendert, then erscheint der Footer weiterhin.

- **As a** Nutzer, **I want to** auf der Login-Seite genau einen Footer sehen,
  **so that** die Impressum-/Datenschutz-Links nicht doppelt erscheinen.
  - given ich öffne `/login`, when die Seite rendert, then erscheinen die Links
    „Impressum" und „Datenschutzerklärung" genau einmal.

- **As a** Nutzer einer Kartenseite, **I want to** unten rechts einen Knopf mit
  Home-Icon, **so that** ich jederzeit zum Standard-Ausschnitt zurückspringe.
  - given eine Kartenseite mit gesetztem `operationDefaultView`, when ich den
    Knopf betätige, then springt die Karte auf den Standard-Ausschnitt (auch
    bei wiederholtem Klick erneut).
  - given `operationDefaultView` ist `null`, when die Seite rendert, then ist
    der Knopf deaktiviert.
  - given eine beliebige der drei Kartenseiten, when sie rendert, then trägt der
    Knopf ein Home-Icon (`IconHome`) und die Beschriftung (aria-label) „Zum
    Standard-Ausschnitt zurück".

- **As a** Nutzer, **I want to** durchgängig einheitliche Icons sehen,
  **so that** die Oberfläche über alle Seiten hinweg konsistent und wertig
  wirkt.
  - given eine Ansicht mit einem Icon-Affordance, when sie rendert, then stammt
    das Icon aus `@tabler/icons-react` statt aus einem Unicode-Glyph oder dem
    bespoke `LocateIcon`-SVG.
  - given ein Icon-Knopf ohne sichtbaren Text, when er rendert, then behält er
    seine bestehende Beschriftung (aria-label), damit die Barrierefreiheit
    erhalten bleibt.
  - _Why: die Beschriftungen tragen die Bedeutung; ein Icon-Tausch darf keinen
    Screenreader-Verlust verursachen._

## Design

- **Ebenen-Tab (`SituationWorkspace` › Tabs.Panel `layers`).** Drei Abschnitte
  mit je einer schlichten Überschrift (Vorschlag: `Text size="sm" fw={600}`
  oder `Divider` mit `label`, konsistent gewählt):
  1. **KML-Datei** – der Datei-Upload plus die Liste der KML-Overlays mit
     `sourceType === "file"`.
  2. **KML-URL** – Name-/URL-Eingaben + „Per URL einbinden" plus die Liste der
     KML-Overlays mit `sourceType === "url"`.
  3. **Bild-Overlays** – die bestehende `ImageOverlayPanel`.
  Der `KmlPanel` wird so umgebaut, dass er seine Overlay-Liste nach
  `sourceType` in die zwei Abschnitte aufteilt; die geteilte Fehler-/Busy-Logik
  bleibt erhalten (ein gemeinsames Fehler-`Alert` am Kopf des KML-Bereichs
  genügt). Der „Neu laden"-Button bleibt nur bei URL-Overlays.
  - _Why: der Umbau berührt `KmlPanel`s Struktur; er baut auf der laufenden
    KMZ-Arbeit auf._

- **Tabs 2×2 (`SituationWorkspace`).** Die `Tabs.List grow` wird zu einem
  2-Spalten-Raster (`display: grid; gridTemplateColumns: repeat(2, 1fr)` auf der
  Tabs.List), sodass die vier Tabs deterministisch 2×2 stehen. `grow` entfällt,
  da das Grid die Breite verteilt.

- **Footer-Unterdrückung (`AppFooter.isFullscreenMapPath`).** Die Erkennung um
  den Ansichtslink erweitern: zusätzlich zu `/operations/[id]` und
  `/device/[token]` auch `/^\/view\/[^/]+/` als Vollbild-Kartenpfad werten. Den
  erklärenden Kommentar um die **Ansichtslink** ergänzen.

- **Login-Footer (`login/page.tsx`).** Die seiteneigene
  Impressum-/Datenschutz-`Group` (aktuell im `Container`) entfernen; der globale
  `AppFooter` liefert weiterhin genau einen Footer auf `/login`.

- **Icon-Umstieg auf `@tabler/icons-react`.** Neue Abhängigkeit; per-Icon
  importieren (`import { IconHome } from "@tabler/icons-react"`). Ersetzte
  Stellen:
  - `›` / `‹` (Sidebar auf/zu, `SituationWorkspace`) → `IconChevronRight` /
    `IconChevronLeft`.
  - `⌖` (Zum Standard zurück) → `IconHome` (siehe Home-Knopf unten).
  - `✎` ×2 (Kartenzeichen/Bereich bearbeiten) → `IconPencil`.
  - bespoke `LocateIcon`-SVG (`DeviceView`) → `IconCurrentLocation`; die
    `LocateIcon`-Funktion entfällt.
  - `←` in den „← Einsätze"-Rücklinks (`LageansichtShell`, `admin/users`,
    `account`) → `IconArrowLeft` vor dem Text.
  Alle `aria-label` bleiben unverändert. Icongröße an die jeweilige
  `ActionIcon`/`Button`-Größe anpassen (Tabler-Konvention: `size={18}`–`20`).

- **Home-Knopf auf allen Kartenseiten.**
  - `SituationWorkspace`: den bestehenden Knopf (unten rechts, `bottom={16}
    right={16}`) beibehalten, nur das `⌖`-Glyph durch `IconHome` ersetzen;
    `aria-label`, `disabled`-Guard und `returnToDefaultView` bleiben.
  - `ViewLinkView`: neuen `ActionIcon` unten rechts (`bottom={16} right={16}`)
    ergänzen; `focusTarget` auf eine frische Kopie von `operationDefaultView`
    setzen (wie in `SituationWorkspace.returnToDefaultView`), damit auch der
    wiederholte Klick erneut springt; deaktiviert wenn `operationDefaultView`
    `null`.
  - `DeviceView`: neuen `ActionIcon` oberhalb des vorhandenen
    Standort-Knopfes stapeln (Standort `bottom={76}`, „Sperren" `bottom={16}`;
    Home z. B. `bottom={136} right={16}`), Stil am Standort-Knopf angelehnt
    (`size="xl" radius="xl" variant="default"`); gleicher `focusTarget`-Sprung
    und `disabled`-Guard.

## Implementation decisions

- `@tabler/icons-react` als Icon-Quelle einführen und den ganzen kleinen
  Icon-Satz in einem Durchgang ablösen. _Why: Mantine ist für Tabler ausgelegt;
  einheitliche, font-unabhängige Icons statt uneinheitlicher Unicode-Glyphen.
  Kein Test prüft auf die Glyphen, der Umstieg ist risikoarm, und es deckt sich
  mit unseren übrigen Projekten. Ein Teil-Umstieg (nur Home) wäre gemischte
  Optik – deshalb der ganze Satz._
- KML-Liste nach `sourceType` in die zwei Abschnitte aufteilen (nicht: ein
  Header über einer gemischten Liste). _Why: entspricht der bestätigten
  Anforderung „KML-Datei / KML-URL getrennt gruppieren"._
- 2×2 über CSS-Grid auf der `Tabs.List`, nicht über zwei separate `Tabs.List`.
  _Why: eine einzige Liste erhält Mantines Tab-Semantik (Fokus, Rollen); das
  Grid steuert nur das Layout._
- Ansichtslink zur `isFullscreenMapPath`-Regex hinzufügen (Footer sitzt im
  Root-Layout und gilt sonst für alle Seiten). _Why: der Footer ist zentral in
  `layout.tsx`; die einzige Stellschraube pro Route ist `isFullscreenMapPath`._

## Story-Abhängigkeiten
Die Stories sind weitgehend unabhängig. Einzige Reihenfolge-Abhängigkeit: der
Home-Knopf nutzt `IconHome` aus `@tabler/icons-react`, also zuerst die
Abhängigkeit hinzufügen (Story „einheitliche Icons"), dann die Home-Knöpfe. Die
übrigen Icon-Ersetzungen und die Stories 1–4 (Ebenen, Tabs, Footer, Login)
können in beliebiger Reihenfolge oder parallel laufen.
