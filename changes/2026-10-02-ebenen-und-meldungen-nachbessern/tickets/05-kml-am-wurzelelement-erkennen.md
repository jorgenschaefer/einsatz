---
criteria:  CRITERIA.md
closes:    AC-15, AC-16, AC-17, AC-18
advances:
after:
status:    done
attempts:  1
---

## Build
Was beim Einbinden per URL oder Datei und beim „Neu laden“ ankommt, muss als
Wurzelelement `<kml>` haben; sonst entsteht kein Overlay, der bisherige
Inhalt bleibt, und die Action meldet, dass es kein KML ist.

## Done when
> **AC-15** Liefert eine URL beim Einbinden einen Inhalt, dessen Wurzelelement nicht `<kml>` ist (davor nur XML-Deklaration, Kommentare und Leerraum), entsteht kein Overlay; es erscheint „Die Adresse liefert keine KML-Datei.“, und „Name“ und „KML-/KMZ-URL“ behalten ihren Inhalt.

> **AC-16** Liefert eine bestehende URL beim „Neu laden“ kein KML im Sinne von AC-15 mehr, bleibt der bisherige Inhalt des Overlays, und es erscheint „Die Adresse liefert keine KML-Datei.“.

> **AC-17** Ist eine eingebundene Datei – bei einem KMZ dessen Haupt-KML – kein KML im Sinne von AC-15, entsteht kein Overlay, und es erscheint „Die Datei ist keine KML- oder KMZ-Datei.“.

> **AC-18** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch „Meine Karten“ mit NetworkLink. Ein NetworkLink-Ziel, das kein KML liefert, wird übersprungen wie ein toter Verweis.

## Nudges
> AC-15–17: eine Prüfung im Server (etwa `assertKmlDocument(text, message)`), aufgerufen in `fetchKmlFromUrl` und `addKmlFileAction`, jeweils mit ihrem Text.

## Context
- **URL:** `addKmlUrlAction` und `reloadKmlAction`
  (`src/app/operations/[id]/kml-actions.ts`) holen über `fetchKmlFromUrl`
  (`src/server/kml/kml-fetch.ts`): Status, Größe, `extractKml` (KMZ entpacken,
  sonst UTF-8 lesen, `src/kml/kmz.ts`), dann `resolveKmlNetworkLinks`, das
  jedes NetworkLink-Ziel wieder über `fetchKmlFromUrl` holt und ein Ziel, das
  wirft, überspringt. `reloadKmlOverlay` (`src/server/kml/kml-overlays.ts`)
  schreibt erst nach erfolgreichem Holen; wirft das Holen, bleibt der Inhalt.
  Eine Prüfung in `fetchKmlFromUrl` gibt damit AC-16 und den zweiten Satz von
  AC-18 ohne weiteren Code.
- **Datei:** Der Client liest die Datei (`readKml` in `src/map/KmlPanel.tsx`,
  entpackt KMZ über `extractKml`) und schickt den Text an `addKmlFileAction`,
  der NetworkLinks auflöst und speichert.
- **Fehlertext:** `operationAction(…, LOAD_FAILED)` gibt die Meldung eines
  `ValidationError` als `{ error }` zurück; das Panel zeigt sie (nach Ticket 01
  als Benachrichtigung „KML-Ebenen“, vorher über dem Panel – für dieses
  Ticket egal). Nach einem Fehler leert `KmlPanel.addUrl` „Name“ und
  „KML-/KMZ-URL“ nicht (nur nach Erfolg).
- **Tests:** `src/app/operations/[id]/kml-actions.test.ts` mockt
  `fetchKmlFromUrl` ganz (Default `"<kml/>"`) und sieht eine Prüfung darin
  nicht. `src/server/kml/kml-fetch.test.ts` hat `scriptedFetch`: eine
  Fetch-Attrappe für IP-Literal-Hosts (DNS löst ohne Netz auf), die man
  `fetchKmlFromUrl(url, 0, doFetch)` mitgibt. `TextDecoder` entfernt ein BOM.
  Bestehende Tests, deren Inhalt kein `<kml>` als Wurzel hat (etwa
  `"<b/>"`-Inhalte), laufen nur dann gegen die Prüfung, wenn sie über
  `fetchKmlFromUrl` oder `addKmlFileAction` gehen; die betroffenen auf KML
  umstellen.

## Plan
1. **AC-Tests zuerst, rot.** Neue Datei
   `src/app/operations/[id]/kml-actions.document.test.ts`, die
   `@/server/kml/kml-fetch` **nicht** mockt (DB, Auth und Events wie in
   `kml-actions.test.ts` gemockt): globales `fetch` per `vi.stubGlobal` mit
   `scriptedFetch`, URLs auf IP-Literal-Hosts. `scriptedFetch` zieht dafür
   aus `src/server/kml/kml-fetch.test.ts` nach `src/test/scripted-fetch.ts`
   (neu), beide Tests importieren es. `kml-overlays` ist gemockt;
   `reloadKmlOverlay` ruft im Mock den übergebenen Fetcher mit einer
   IP-Literal-URL (`(db, id, fetcher) => fetcher("http://93.184.216.34/x.kml")`),
   damit das echte `fetchKmlFromUrl` läuft.
   - `addKmlUrlAction` mit HTML (`<!doctype html><html>…`) → `{ error: "Die
     Adresse liefert keine KML-Datei." }`, `createKmlOverlay` nicht gerufen
     (AC-15).
   - `reloadKmlAction` mit HTML → dieselbe Meldung (AC-16, Teil Meldung).
   - `addKmlFileAction` mit `"{}"` bzw. `"<html/>"` → `{ error: "Die Datei ist
     keine KML- oder KMZ-Datei." }`, kein `createKmlOverlay` (AC-17).
   - `addKmlUrlAction` mit `<?xml …?>`, Kommentar und Leerraum vor `<kml …>`
     und mit einer KMZ-Antwort → Overlay angelegt; ein NetworkLink-Dokument,
     dessen eines Ziel HTML liefert, wird mit dem anderen Ziel angelegt
     (AC-18).
   Beweis: rot.
2. **Prüfung.** In `src/server/kml/kml-fetch.ts`
   `assertKmlDocument(text: string, message: string): void`: erlaubt vor dem
   Wurzelelement nur Leerraum, eine XML-Deklaration und Kommentare; das
   Wurzelelement muss `kml` heißen (mit oder ohne Namensraum-Präfix, etwa
   `<kml:kml>`); sonst `ValidationError(message)`. Beweis: neuer
   `describe("assertKmlDocument")` in `src/server/kml/kml-fetch.test.ts`,
   neben der Datei, in der die Funktion steht (KML mit/ohne Deklaration,
   Kommentare, BOM-freier Text, Präfix; HTML, JSON, leerer Text, `<kml`
   erst nach einem anderen Element, DOCTYPE davor → abgelehnt).
3. **URL.** `fetchKmlFromUrl` ruft nach `extractKml` und vor
   `resolveKmlNetworkLinks` `assertKmlDocument(kml, "Die Adresse liefert keine
   KML-Datei.")`. Beweis: Tests aus Schritt 1 (URL, Neu laden, NetworkLink);
   `src/server/kml/kml-fetch.test.ts` grün.
4. **Datei.** `addKmlFileAction` ruft vor `resolveKmlNetworkLinks`
   `assertKmlDocument(content, "Die Datei ist keine KML- oder KMZ-Datei.")`
   (import aus `kml-fetch`; in `kml-actions.test.ts` den Mock um
   `assertKmlDocument` ergänzen oder echt durchreichen). Beweis: Test aus
   Schritt 1 (Datei).
5. **Bleibt der Inhalt?** `src/server/kml/kml-overlays.test.ts`: prüfen, dass
   ein Test `reloadKmlOverlay` mit werfendem Fetcher den Inhalt unverändert
   lässt; sonst ergänzen (AC-16, Teil Inhalt). Beweis: Test; `npm run check`
   grün.
6. **Panel.** Neue Datei `src/map/KmlPanel.document.test.tsx`: `onAddUrl`
   liefert `{ error: "Die Adresse liefert keine KML-Datei." }` → die Meldung
   ist zu sehen (`findByRole("alert")`), „Name“ und „KML-/KMZ-URL“ behalten
   ihren Inhalt (AC-15, Teil Panel). Beweis: Test grün.

## Not here
- Leere, aber gültige KML wird angenommen (Out of scope); keine Prüfung auf
  Placemarks, kein XML-Parser im Server (Ruled out).
- Wo und wie die Meldung erscheint (Benachrichtigung „KML-Ebenen“): Ticket 01.
- Der Client (`readKml`) prüft nicht selbst; die Prüfung ist im Server.

## Left standing

**Ohne automatischen Test geprüft**

- AC-15 im laufenden Programm: Beide Reviews haben „Per URL einbinden“ mit
  `https://example.com/` (HTML) ausgelöst, bei 1920 px und bei 360 bzw.
  390 px. Es erschien „Die Adresse liefert keine KML-Datei.“, es entstand kein
  Overlay, und „Name“ und „KML-/KMZ-URL“ behielten ihren Inhalt.
- AC-17 mit einem KMZ, dessen Haupt-KML kein KML ist: Kein Test führt das
  durch Panel und Server. Der Server bekommt vom Client nur das entpackte
  Haupt-KML (`readKml`). Für ihn ist das derselbe Fall wie eine KML-Datei mit
  falschem Inhalt, und den deckt `kml-actions.document.test.ts` ab.
- AC-18 mit einer echten Google-„Meine Karten“-Adresse: nicht live geprüft.
  Die Tests spielen das mit einer Fetch-Attrappe nach: ein NetworkLink-Dokument
  mit einem HTML-Ziel und einem KML-Ziel ergibt das KML-Ziel.

**Abweichungen vom Plan**

- Die Prüfung ist kein einzelner regulärer Ausdruck. Die erste Fassung war
  einer, und das Review fand darin Backtracking: Etwa 40 Kommentare (rund
  320 Bytes) oder einige hundert kB Leerraum hätten den Server-Prozess
  minuten- bis stundenlang blockiert. Jetzt läuft `hasKmlRoot` den Prolog
  Schritt für Schritt ab, in linearer Zeit. Zwei Tests mit einem Zeitlimit
  halten das fest.
- Zusätzlich abgelehnt: eine Verarbeitungsanweisung wie `<?xml-stylesheet …?>`
  vor der Wurzel. AC-15 erlaubt davor nur die XML-Deklaration.
- `scriptedFetch` nimmt jetzt auch Bytes als Antwort an, damit ein KMZ per URL
  getestet werden kann.
- Die Tests aus Schritt 5 (`kml-overlays.test.ts`) und Schritt 6
  (`KmlPanel.document.test.tsx`) waren nie rot, weil sie bestehendes Verhalten
  festhalten. Dass sie dieses Verhalten wirklich prüfen, habe ich mit einer
  absichtlich eingebauten Änderung am Code geprüft: Beide schlugen fehl.
