# Ansichtslink

Ein löschbarer, geheimer Nur-Lesen-Link pro Einsatz, über den die Lagekarte
ohne Login live mitgelesen werden kann – ohne Standortmeldung und ohne Bindung
an ein Kartenzeichen.

## Problem

Die einzige login-freie Kartenansicht heute ist der **Gerätelink**: ein Link
*pro Kartenzeichen*, dessen Zweck die **Kräfteortung** ist (das Gerät meldet
seinen Standort). Wer die Lage nur *ansehen* lassen will – eine Leitstelle, ein
Lagewand-Monitor, eine Partnereinheit, eine eigene Führungskraft ohne Konto –,
hat kein passendes Mittel: Der Gerätelink verlangt Standortfreigabe, ist an ein
Kartenzeichen gekoppelt und lässt sich nicht gezielt löschen.

Der **Ansichtslink** schließt diese Lücke: einsatzweit statt zeichengebunden,
rein lesend statt meldend, und einzeln widerrufbar.

## Zielgruppe

Führungskräfte (angemeldete Nutzer) erzeugen Ansichtslinks für gemischte
Empfänger: entfernte Mitleser (Leitstelle / übergeordnete Stelle), fest
installierte Monitore (Lagewand), Partner / fremde Einheiten und eigene
Führungskräfte ohne Konto. Weil dieselbe Lage an mehrere Empfänger geht, muss
ein einzelner Empfänger widerrufbar sein, ohne die anderen zu treffen.

## Ubiquitous language

- **Ansichtslink** (`ViewLink`) – ein löschbarer, geheimer Link (mit QR-Code)
  *pro Einsatz*, über den die **Lagekarte** ohne Login nur gelesen wird; meldet
  keinen Standort und ist an kein **Kartenzeichen** gebunden. Beliebig viele je
  Einsatz, jeder mit **Bezeichnung** und einzeln löschbar (widerrufbar).
  Gebunden an einen gültigen Token und einen aktiven **Einsatz**. Abzugrenzen
  vom **Gerätelink** (zeichengebunden, meldet Standort, nur neu generierbar,
  nicht löschbar).

Ergänzung für `UBIQUITOUS_LANGUAGE.md` (Terminology, alphabetisch vor
„Bereich"): obiger Eintrag. Beim **Gerätelink**-Eintrag den Kontrast andeuten
(„im Gegensatz zum **Ansichtslink** zeichengebunden und meldend").

## Rollen (Aktoren)

- **Führungskraft** (angemeldeter **Nutzer**) – erzeugt, kopiert und löscht
  Ansichtslinks; volle Bearbeitungsberechtigung.
- **Mitleser** – anonym, ohne Konto; öffnet einen Ansichtslink und sieht die
  Lagekarte read-only. Kein System-Nutzer, keine Rolle in der DB.

## Domänenmodell

- **Aggregat:** Der **Ansichtslink** gehört zum Aggregat **Einsatz**
  (`Operation`) – wie **Kartenzeichen**, **Bereiche** und Overlays. Anlegen,
  Auflisten und Löschen laufen im Kontext genau eines Einsatzes; beim Löschen
  des Einsatzes kaskadieren die Ansichtslinks mit.
- **Entität `ViewLink`:** `id`, `operationId`, `token` (geheim, eindeutig),
  `label` (Bezeichnung), `createdAt`.
- **Aktionen:** Ansichtslink *erzeugen*, *auflisten*, *löschen*; Zugang
  *auflösen* (`resolveViewAccess`).
- **Bindung des Zugangs:** identisch zum Gerätelink – ein Token liefert nur
  Zugang, solange er gültig **und** der Einsatz `aktiv` ist. Andernfalls „kein
  Zugang".

## User journey

1. Führungskraft öffnet in der Lageansicht **Teilen**, erzeugt einen
   Ansichtslink mit Bezeichnung, kopiert die URL (oder zeigt den QR-Code) und
   gibt sie an einen Empfänger.
2. Mitleser öffnet die URL und sieht die Lagekarte read-only; sie aktualisiert
   sich live.
3. Führungskraft löscht bei Bedarf einen einzelnen Ansichtslink; dessen Empfänger
   verliert sofort den Zugang, andere Links bleiben gültig.
4. Wird der Einsatz abgeschlossen, verlieren alle Ansichtslinks den Zugang.

---

## Stories und Akzeptanzkriterien

### S1 – Ansichtslink erzeugen

Als Führungskraft will ich einen benannten Ansichtslink für einen Einsatz
erzeugen, um einem Empfänger die Lage read-only zu geben.

- **Given** ein aktiver Einsatz, **when** die Führungskraft im Teilen-Dialog
  eine Bezeichnung eingibt und „Ansichtslink erzeugen" wählt, **then** wird ein
  `view_links`-Datensatz mit neuem, eindeutigem Token und der Bezeichnung
  angelegt und in der Liste angezeigt.
- **Given** der neue Ansichtslink, **when** er in der Liste erscheint, **then**
  sind seine URL (`<origin>/view/<token>`) kopierbar und sein QR-Code
  abrufbar.
- **Given** kein Bezeichnungstext eingegeben, **when** erzeugt wird, **then**
  wird der Link dennoch angelegt und in der Liste als „Ansichtslink" (Fallback)
  dargestellt. *(Bezeichnung ist optional; leere Bezeichnung ist erlaubt.)*
- Der Token wird kryptografisch zufällig erzeugt (`randomBytes(32)` →
  `base64url`), wie beim Gerätelink.

### S2 – Ansichtslinks auflisten

Als Führungskraft will ich alle Ansichtslinks eines Einsatzes sehen, um sie zu
verwalten.

- **Given** ein Einsatz mit mehreren Ansichtslinks, **when** der Teilen-Dialog
  geöffnet wird, **then** werden alle Ansichtslinks dieses Einsatzes mit
  Bezeichnung gelistet (ältester zuerst, `created_at ASC`).
- **Given** ein Einsatz ohne Ansichtslinks, **when** der Dialog geöffnet wird,
  **then** erscheint ein leerer Zustand mit Hinweis zum Erzeugen.

### S3 – Ansichtslink löschen (widerrufen)

Als Führungskraft will ich einen einzelnen Ansichtslink löschen, um genau
diesen Empfänger auszusperren, ohne die anderen zu treffen.

- **Given** mehrere Ansichtslinks, **when** die Führungskraft einen löscht (mit
  Bestätigung), **then** wird nur dieser `view_links`-Datensatz entfernt; die
  übrigen bleiben gültig.
- **Given** ein gelöschter Ansichtslink, **when** ein Mitleser dessen URL
  danach öffnet oder aufgeschlagen hat, **then** erhält er „Zugang beendet"
  (Seite bzw. `403` an den Datenrouten); die laufende Ansicht fällt beim
  nächsten Zugriff auf die Abschluss-Seite zurück.

### S4 – Lage read-only ansehen

Als Mitleser will ich über den Ansichtslink die Lagekarte live sehen, ohne mich
anzumelden und ohne meinen Standort zu teilen.

- **Given** ein gültiger Token bei aktivem Einsatz, **when** `/view/<token>`
  geöffnet wird, **then** erscheint die Lagekarte mit allen Kartenobjekten
  (Kartenzeichen inkl. Staleness-Darstellung, Bereiche, KML- und
  Bild-Overlays), read-only.
- **Given** die offene Ansicht, **when** sich die Lage ändert (SSE-Ereignis für
  den Einsatz), **then** aktualisiert sie sich automatisch.
- **Given** die Ansicht, **then** ist die Adress- und Objektsuche verfügbar; die
  Auswahl eines Treffers oder Kartenzeichens **zentriert** die Karte darauf.
- **Given** die Ansicht, **then** wird **kein** Standort abgefragt oder
  gesendet; es gibt **keinen** Eigenstandort-Knopf, **kein**
  „Standort wird gesendet"-Badge, **keine** „Sperren"-Funktion und **kein**
  Öffnen der Karten-App beim Tippen auf ein Zeichen.
- **Given** die SSE-Verbindung bricht ab, **then** erscheint – wie in der
  Geräteansicht – die „Verbindung getrennt"-Anzeige.

### S5 – Zugang endet

Als Betreiber will ich, dass ein Ansichtslink nach Abschluss des Einsatzes oder
nach Löschung nichts mehr preisgibt.

- **Given** ein abgeschlossener (`closed`) Einsatz, **when** ein Ansichtslink
  dieses Einsatzes geöffnet wird, **then** liefert `resolveViewAccess` `null`
  und es erscheint die neutrale Seite „Zugang beendet"; die Datenrouten
  antworten mit `403`.
- **Given** die neutrale Abschluss-Seite, **then** nennt sie **keinen** Grund
  und **keine** Standortübermittlung (der Text gilt für Geräte- und
  Ansichtslink gleichermaßen).
- **Given** ein gelöschter Einsatz, **when** dessen Ansichtslinks referenziert
  werden, **then** sind sie per `ON DELETE CASCADE` mitentfernt.

---

## Technische Festlegungen

Jede Festlegung nennt die real wiederverwendete Struktur.

### Migration

- Neue Migration `010_view_links.sql`:

  ```sql
  CREATE TABLE view_links (
    id           uuid PRIMARY KEY,
    operation_id uuid NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    token        text NOT NULL UNIQUE,
    label        text NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX view_links_operation_id_idx ON view_links (operation_id);
  ```

### Serverschicht

- Neues Modul `src/server/viewlinks/view-links.ts` (Muster:
  `src/server/mapsymbols/map-symbols.ts`), Zugriff über den `Db`/`Queryable`-Adapter:
  - `createViewLink(db, { operationId, label }) → ViewLink` – erzeugt Token via
    `randomBytes(32).toString("base64url")`.
  - `listViewLinks(db, operationId) → ViewLink[]` – `ORDER BY created_at ASC`.
  - `deleteViewLink(db, id) → void`.
  - `resolveViewAccess(db, token) → { operationId } | null` – JOIN auf
    `operations`, nur bei `status = 'active'` (analog `resolveDeviceAccess`).
- Tests mit PGlite (`freshDb()`), Datei `view-links.test.ts` daneben.

### Routen `/view/[token]`

Parallel zu `src/app/device/[token]/…`, jeweils Zugang über `resolveViewAccess`
(kein `reportPosition`, keine `position`-Route):

- `page.tsx` – lädt Einsatz, Kartenzeichen, Bereiche, KML- und Bild-Overlays
  (wie `device/[token]/page.tsx`) und rendert die read-only Ansicht.
- `events/route.ts` – SSE über `subscribeOperation(access.operationId, …)`.
- `geocode/route.ts` – `geocodeQuery` hinter dem Token.
- `overlays/[overlayId]/route.ts` – Bildbytes eines Bild-Overlays, gebunden an
  `access.operationId`.
- Alle Datenrouten antworten bei fehlendem Zugang mit `403` „Kein Zugang".

### Ansicht (Client)

- Neue Komponente `src/map/ViewLinkView.tsx` (angelehnt an `DeviceView.tsx`),
  **ohne** `useDeviceLocation`, Standort-Badge, Eigenstandort-Knopf,
  `WipeLock`/„Sperren" und ohne `navigationUrl`-Aufruf beim Tippen.
  Wiederverwendet: `SituationMap` (`readOnly`), `SearchBar` + `useMapSearch`,
  `useOperationEvents` (mit „Verbindung getrennt"-Anzeige), `useStalenessClock`,
  `toPlacedSymbols`, `DeviceClosed`. Geocode-Fetch gegen
  `/view/<token>/geocode`, SSE gegen `/view/<token>/events`,
  Bild-Overlays gegen `/view/<token>/overlays/<id>`.
- Auswahl eines Kartenzeichens/Suchtreffers ruft nur `jumpTo` (zentrieren),
  nicht `window.open`.

### Abschluss-Seite

- `src/map/DeviceClosed.tsx`: Text neutralisieren – den Satz zur
  Standortübermittlung entfernen, sodass er für Geräte- und Ansichtslink passt
  (z. B. nur „Dieser Zugang ist nicht mehr aktiv."). Bestehende Nutzer der
  Komponente bleiben unverändert.

### Verwaltung (UI)

- Knopf **Teilen** in der Lageansicht-Kopfzeile (`LageansichtShell`), sichtbar
  neben dem Status-Badge; öffnet ein Mantine-`Modal`.
- Neue Komponente `src/map/ViewLinkPanel.tsx` (Kopier-/QR-Muster aus
  `DeviceLinkPanel.tsx`): Liste der Ansichtslinks (Bezeichnung, URL kopieren,
  QR ein-/ausblenden, Löschen mit Bestätigung) plus Erzeugen-Zeile
  (Bezeichnungs-Feld + „Ansichtslink erzeugen"). Leerer Zustand mit Hinweis.
- Server Actions in `src/app/operations/[id]/view-link-actions.ts` (Muster:
  `map-symbol-actions.ts`): `createViewLinkAction`, `deleteViewLinkAction`, je
  mit `requireUser()`, gebunden an `operationId` via `.bind`; nach Änderung
  `revalidatePath("/operations/<id>")`. **Keine** `publishOperationChanged`
  nötig (Verwaltung ändert die Lagekarte nicht).
- `LageansichtPage` (`src/app/operations/[id]/page.tsx`) lädt zusätzlich
  `listViewLinks(db, operation.id)` und reicht Liste + Actions durch.

### Datenschutz

- `src/app/datenschutz/page.tsx`, Abschnitt „Standortdaten" (7): ein Satz, dass
  ein Einsatz zusätzlich rein lesende **Ansichtslinks** ohne Standortübermittlung
  bereitstellen kann – keine neue Verarbeitungskategorie (Kartenkacheln/Ortssuche
  wie bereits beschrieben). Kein eigener neuer Abschnitt nötig.

---

## Non-goals

- **Kein** Standortmelden über den Ansichtslink (das bleibt der Gerätelink).
- **Keine** Bearbeitung über den Link (rein lesend).
- **Keine** Ablaufzeit / Selbstverfall des Tokens (Widerruf ausschließlich per
  Löschen oder Einsatz-Abschluss).
- **Keine** Zugriffsprotokollierung / Zähler geöffneter Links.
- **Kein** Weiterbestehen des Zugangs nach Einsatz-Abschluss.
- **Kein** Passwortschutz oder Empfänger-Authentifizierung pro Link.
- **Keine** feingranularen Sichtbarkeiten (Ebenen aus-/einblenden je Link);
  der Mitleser sieht dieselben Kartenobjekte wie die Lagekarte.

## Success criteria

- Eine Führungskraft kann mehrere benannte Ansichtslinks je Einsatz erzeugen,
  kopieren (URL/QR) und einzeln löschen.
- Ein Empfänger sieht die Lagekarte read-only und live, ohne Login und ohne
  Standortabfrage.
- Löschen eines Links oder Abschluss des Einsatzes beendet den Zugang sofort und
  neutral, ohne Grundnennung.
- `npm run check` ist grün; neue Verhaltensweisen sind durch Tests gepinnt
  (Serverfunktionen inkl. `resolveViewAccess`-Bindung an `active`, Actions,
  `ViewLinkPanel`, `ViewLinkView`, Datenrouten-`403`).

## Abhängigkeiten zwischen Stories

- S1/S2/S3 (Verwaltung) hängen an Migration + Serverschicht (`view_links`,
  `createViewLink`/`listViewLinks`/`deleteViewLink`).
- S4 (Ansehen) hängt an `resolveViewAccess` + den `/view/[token]`-Routen +
  `ViewLinkView`.
- S5 (Zugang endet) hängt an `resolveViewAccess` (Active-Bindung),
  `ON DELETE CASCADE` und der neutralisierten `DeviceClosed`.
- Sinnvolle Reihenfolge: Migration → Serverschicht (+Tests) → Routen +
  `ViewLinkView` → Verwaltung (Panel + Actions + Einbindung) → `DeviceClosed`-Text
  + Datenschutz.
```
