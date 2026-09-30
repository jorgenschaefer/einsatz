---
criteria:  CRITERIA.md
closes:    AC-5, AC-13
advances:  AC-6, AC-8, AC-14, AC-15
after:     03-von-an-chips
status:    done
attempts:  1
---

## Build
Werte außerhalb der Chips: „andere …“ fest am rechten Rand jeder Chip-Zeile
öffnet in derselben Zeile ein Eingabefeld mit Vorschlägen, und *Andere …* macht
aus der Weg-Auswahl ein Freitextfeld.

## Done when
> **AC-5** „andere …“ ist in jeder Zeile ohne Wischen sichtbar. Ein Tipp darauf ersetzt die Chips in derselben Zeile durch ein Eingabefeld, das beim Tippen die Werte aus AC-2 vorschlägt, die das Getippte ohne Rücksicht auf Groß- und Kleinschreibung irgendwo enthalten („2“ schlägt „UHSt 2“ vor). Enter übernimmt den markierten Vorschlag. Öffnen von „andere …“ wählt einen gewählten Chip ab; „×“ verwirft die Eingabe und holt die Chips zurück. Die Eingabe wird getrimmt und so gespeichert, wie sie getippt wurde.

> **AC-13** In der Desktop-Seitenleiste (360 px breit) ist der Bereich für neue Einträge höchstens 80 px höher als vor dieser Änderung.

Dazu von den ACs unter *Toward*:

- AC-6: *Andere …* in der Weg-Auswahl macht daraus ein Freitextfeld an derselben Stelle, bei 360 px mindestens 150 px breit; „×“ macht wieder die Auswahl daraus, mit dem Weg, der vor *Andere …* gewählt war; der Freitext wird als Weg gespeichert.
- AC-8: Nach erfolgreichem Speichern sind offene „andere …“-Felder geschlossen; bei einem Fehler bleiben sie mit ihrer Eingabe offen.
- AC-14: Bei 360 px Breite scrollt die Seite auch mit offenem „andere …“-Feld und mit Freitext-Weg nicht waagerecht.
- AC-15: Strg/⌘+Enter aus dem „andere …“-Feld und aus dem Freitext-Weg schickt den neuen Eintrag samt Von, An und Weg ab.

## Toward
> **AC-6** Der Weg ist eine Auswahl neben „Eintrag hinzufügen“ mit *Funk*, *Telefon*, *Persönlich*, *Andere …* und *ohne*. *Andere …* macht aus der Auswahl ein Freitextfeld an derselben Stelle, das bei 360 px Breite mindestens 150 px breit ist; „×“ macht wieder die Auswahl daraus. Vorbelegt ist der Weg des zuletzt auf diesem Gerät in diesem Gesamteinsatz gespeicherten neuen Eintrags, auch ein Freitext-Weg und auch *ohne*; eine Korrektur ändert ihn nicht. Auf einem Gerät ohne gemerkten Weg ist es *Funk*.

> **AC-8** Nach erfolgreichem Speichern ist der Text leer, Von und An sind abgewählt, offene „andere …“-Felder sind geschlossen, der Weg bleibt. Bei einem Fehler bleiben Text, Von, An und Weg erhalten, und die Fehlermeldung erscheint wie heute. Reihenfolge (AC-3) und gemerkter Weg (AC-6) ändern sich nur bei erfolgreichem Speichern.

> **AC-14** Bei 360 px Breite scrollt die Seite nicht waagerecht; eine lange Kopfzeile bricht im Eintrag um.

> **AC-15** Strg/⌘+Enter schickt den Eintrag samt Von, An und Weg ab, aus jedem seiner Eingabefelder, beim neuen Eintrag wie beim Korrigieren.

## Nudges
> Ein Bauteil für neuen Eintrag und Korrektur; die Kopfzeile formatiert eine reine Funktion mit eigenen Tests.

## Context
Nach Ticket 02 und 03 gibt es `src/journal/EntryRouteFields.tsx` mit den
Chip-Zeilen Von/An (`EntryRouteChips`, Werte aus `correspondents`,
alphabetisch, waagerecht scrollend) und der Weg-Auswahl (`EntryChannelSelect`,
natives `<select aria-label="Weg">` mit *Funk*, *Telefon*, *Persönlich*,
*ohne*). `JournalPanel` hält die
Route im Zustand und schickt sie mit `onAdd` ab. Tests für das Bauteil stehen in
`src/journal/EntryRouteFields.test.tsx`, für das ETB in
`src/app/operations/[id]/JournalPanel.route.test.tsx`.

**Gestaltung** (vereinbart, nicht neu entwerfen; Muster in
`changes/2026-09-30-von-an-weg-im-etb/specimens/eingabe-am-handy.html`):
„andere …“ ist ein gestrichelter Chip rechts in der Zeile, *außerhalb* des
waagerecht scrollenden Bereichs, und wischt nicht mit. Offen ersetzt ein
Eingabefeld die Chips in derselben Zeile und in derselben Höhe; der Knopf zeigt
dann „×“ (zugängliche Bezeichnung „Zurück zur Auswahl“). Beim Weg wird die
Auswahl selbst zum Textfeld mit „×“ daneben, der Knopf „Eintrag hinzufügen“
bleibt rechts.

Mantine `Autocomplete` filtert standardmäßig „enthält, ohne Rücksicht auf Groß-
und Kleinschreibung“ und übernimmt mit Enter den markierten Vorschlag. Beides
verlangt AC-5; im Plan ist zu prüfen, dass die Standardeinstellung genau das tut.

Die Zeile „Weg“ liegt am Handy und in der Desktop-Seitenleiste bei 360 px
Außenbreite; nach 16 px Rand je Seite bleiben 328 px für Weg und Knopf.

**Baseline für AC-13.** Ticket 02 hat unter `## Left standing` die Höhe des
Eingabebereichs vor dieser Änderung (Commit `6392481`) gemessen, Ticket 03 die
Höhe mit Chip-Zeilen.

## Plan
1. **AC-5 als Test, rot.** In `src/app/operations/[id]/JournalPanel.route.test.tsx`:
   „andere …“ bei Von antippen → Feld erscheint, ein zuvor gewählter Von-Chip
   ist abgewählt; „2“ tippen → „UHSt 2“ wird vorgeschlagen, „ua“ schlägt
   „UHSt 1“ vor (enthält, ohne Groß-/Kleinschreibung); Pfeil runter + Enter
   übernimmt; Absenden speichert „UHSt 2“. Zweiter Fall: „ Neu “ tippen,
   absenden → `sender: "Neu"`. Dritter Fall: tippen, „×“ → Chips zurück, Wert
   verworfen, Absenden ohne Von.
   *Beweis:* Der Test schlägt fehl, weil es „andere …“ noch nicht gibt.
2. **„andere …“ im Bauteil.** In `src/journal/EntryRouteFields.tsx` je Zeile
   einen festen Knopf „andere …“ rechts außerhalb des Scrollbereichs; offen:
   Mantine `Autocomplete` mit `data={correspondents}` an Stelle der Chips,
   Knopf „×“. Öffnen setzt den Wert des Feldes auf leer (wählt den Chip ab);
   Tippen setzt den Wert; „×“ setzt leer und schließt. Ob die Zeile offen ist,
   gibt das Bauteil dem Aufrufer bekannt oder nimmt es als Prop, damit
   `JournalPanel` sie nach dem Speichern schließen kann.
   *Beweis:* Test aus Schritt 1 grün; Einzeltests in
   `src/journal/EntryRouteFields.test.tsx` für Öffnen/Schließen.
3. **Freitext-Weg.** Die Weg-Auswahl bekommt *Andere …*; gewählt, ersetzt ein
   Textfeld (`aria-label="Weg"`, kein sichtbares Label) die Auswahl, daneben
   „×“. Die Eingabe wird der Weg; „×“ führt zurück zur Auswahl mit dem Weg,
   der vor *Andere …* gewählt war (entschieden in diesem Ticket; AC-6 sagt nur,
   dass wieder die Auswahl erscheint). Das Textfeld bekommt eine
   Mindestbreite von 150 px, der Knopf „Eintrag hinzufügen“ darf schrumpfen,
   aber nicht umbrechen.
   *Beweis:* Test in `JournalPanel.route.test.tsx`: *Andere …* wählen, „Melder“
   tippen, absenden → `channel: "Melder"`; *Telefon* wählen, dann *Andere …*,
   dann „×“ → Auswahl mit *Telefon*.
4. **Zurücksetzen nach dem Speichern.** `JournalPanel` schließt nach Erfolg
   offene „andere …“-Felder; bei Fehler bleibt alles offen. Der Freitext-Weg
   bleibt nach Erfolg stehen (der Weg bleibt, AC-8).
   *Beweis:* Tests in `JournalPanel.route.test.tsx` für Erfolg und `{ error }`.
5. **Strg/⌘+Enter aus allen Feldern.** Das „andere …“-Feld und der
   Freitext-Weg rufen bei Strg/⌘+Enter dasselbe Absenden wie das Textfeld
   (`submitOnCtrlEnter`). Einfaches Enter im „andere …“-Feld übernimmt nur den
   Vorschlag und schickt nicht ab.
   *Beweis:* Tests in `JournalPanel.route.test.tsx` für beide Felder;
   Enter allein ruft `onAdd` nicht.
6. **Im Browser prüfen.** Mit dem Skill `run-einsatz` bei 360 px (Handy) und
   in der Desktop-Seitenleiste: „andere …“ ohne Wischen sichtbar; offenes Feld
   in gleicher Höhe; Freitext-Weg ≥ 150 px breit (DevTools); keine
   waagerechte Seiten-Scrollbar; Höhe des Eingabebereichs gegenüber dem
   Messwert vor dieser Änderung aus Ticket 02 höchstens 80 px mehr, mit
   geschlossenen und offenen Feldern.
   *Beweis:* Messwerte unter `## Left standing`.

## Not here
- Korrigieren mit denselben Bedienelementen: Ticket `05-von-an-weg-korrigieren`.
- Reihenfolge der Chips und gemerkter Weg, auch ein gemerkter Freitext-Weg: Ticket `06-reihenfolge-und-weg-je-geraet`.
- Aus *Out of scope*: Abgleich ähnlicher Schreibweisen über Groß- und Kleinschreibung hinaus („UHSt2“ und „UHSt 2“). Die Vorschläge filtern nur „enthält“.
- Aus *Out of scope*: Chips entfernen, z. B. durch langes Drücken. Wird gebaut, falls vertippte Werte im Einsatz stören.

## Left standing
- Review-Nit nicht umgesetzt: Mit den Pfeiltasten durch die geschlossene
  Weg-Auswahl zu gehen, macht aus ihr ein Textfeld, sobald *Andere …* erreicht
  ist. Chromium löst dort bei jedem Pfeil ein `change` aus. *ohne* erreicht man
  per Tastatur dann nur durch Tippen von „o“ oder über die geöffnete Liste
  (Alt+↓). Der Fall folgt aus der vereinbarten Gestaltung (natives `<select>`,
  *Andere …* vor *ohne*). Ihn zu beheben, hieße, diese Gestaltung zu ändern
  oder Tastendrücke mitzuverfolgen. Beides habe ich nicht getan. In der ersten
  Review war das ein Should-fix, in der zweiten ein Nit.
- Abweichung von der Gestaltung: Das „×“ des Freitext-Wegs steht *im* Feld
  (Mantine `CloseButton` rechts im Feld), nicht daneben, und sieht anders aus
  als das gestrichelte „×“ bei Von und An. Daneben bliebe dem Feld bei 360 px
  neben dem ungekürzten „Eintrag hinzufügen“ keine 150 px. Das Feld ist jetzt
  151 px breit, davon sind etwa 103 px Platz für Text. Das sollte bei der
  Abnahme bestätigt werden.
- Abweichung vom Plan, Schritt 1: Die Tests stehen in einer neuen Datei
  `src/app/operations/[id]/JournalPanel.other.test.tsx`, nicht in
  `JournalPanel.route.test.tsx`, die schon 300 Zeilen hat. Der Plan-Fall „„ua“
  schlägt „UHSt 1“ vor“ ist falsch, denn „UHSt 1“ enthält „ua“ nicht. Der Test
  nimmt „uh“ und erwartet „UHSt 1“ und „UHSt 2“.
- Abweichung vom Plan, Schritt 1 und AC-5 „getrimmt“: Der Client trimmt nicht.
  Das tut der Server schon (`trimToNull` in `src/server/journal/journal.ts`),
  gepinnt in `journal.test.ts` seit Ticket 02. Den Plan-Fall „„ Neu “ →
  `sender: "Neu"`“ an `onAdd` gibt es deshalb nicht. Dass „so gespeichert,
  wie getippt“ gilt, zeigt „adds the typed value as An“.
- Zusätzlich zum Plan (Blocker aus der ersten Review): Drückt man Strg/⌘+Enter,
  während ein Vorschlag mit den Pfeiltasten markiert ist, wird der markierte
  Vorschlag gespeichert, nicht das bis dahin Getippte. `EntryRouteChips` meldet
  Strg/⌘+Enter dafür über `onSubmit(wert)` statt über `onKeyDown`. Außerdem
  öffnet das Feld seine Vorschläge erst beim Tippen, nicht schon beim Öffnen
  (Should-fix: die volle Liste verdeckte die Zeile „An“ und den Knopf). Und der
  Abstand zwischen Weg und „Eintrag hinzufügen“ ist `sm` statt `md`, damit der
  Knopf neben dem 150-px-Feld ungekürzt bleibt (Should-fix).
- AC-13, AC-14, die 150 px aus AC-6, „ohne Wischen sichtbar“ und „in derselben
  Höhe“ aus AC-5 prüft kein automatischer Test, denn jsdom misst kein Layout.
  Der Reviewer hat es in beiden Runden im Browser gemessen, bei 360 px am Handy
  und in der Desktop-Seitenleiste mit denselben Werten. Höhe von
  `.journal-new-entry`: 178,375 px geschlossen, mit beiden „andere …“-Feldern
  offen und mit Freitext-Weg, gegenüber 102,375 px vor dieser Änderung
  (+76 px, Grenze +80 px). Das offene Feld ist 28 px hoch, so hoch wie die
  Chip-Zeile. „andere …“ steht bei voller Chip-Zeile fest bei x 260–344. Der
  Freitext-Weg ist 151,23 px breit, „Eintrag hinzufügen“ ist nicht gekürzt.
  `scrollWidth` ist gleich `clientWidth` (360), auch mit offenem Feld, offener
  Vorschlagsliste und langem Freitext-Weg.
- Nicht in der zweiten Review geprüft: dass nach „×“ am Freitext-Weg der Fokus
  wieder auf der Weg-Auswahl steht. Das habe ich nach der zweiten Review aus
  einem ihrer Nits gebaut. Es ist in „brings back the Weg chosen before on ×“
  gepinnt, im Browser aber nicht nachgesehen.
- Zum TDD-Ablauf: Die Tests für die Vorschläge („suggests the correspondents
  containing …“), Enter übernimmt den Vorschlag, „×“, An frei eingeben und die
  zwei Tests in `EntryRouteFields.test.tsx` für Öffnen und Schließen liefen
  gleich grün. Das Autocomplete kam mit dem ersten Test ins Bauteil, und Filter
  und Enter sind Mantine-Standard. „closes the fields after adding“ lief auch
  gleich grün; ohne `setOtherOpen(NO_OTHER_OPEN)` schlägt er fehl.
- Der erste Reviewer hat vermutlich ein Einsatz „Critique-Andere“
  (`f3472fc7-0206-4aa5-b64b-2418992aa102`) in der Dev-Datenbank liegen lassen.
  Der Lauf wurde während der zweiten Review abgebrochen. Ich habe es nicht
  gelöscht.
- Den offenen Punkt aus Ticket 03 (Von und An mit demselben Wert in
  verschiedener Schreibweise in einem Eintrag, `listCorrespondents` wählt ohne
  feste Regel) kann die freie Eingabe jetzt auslösen. Er gehört zu AC-2, nicht
  zu diesem Ticket, und ist weiter offen.
- `JournalPanel.tsx` hat jetzt gut 430 Zeilen. Den Eingabebereich in ein
  eigenes Bauteil zu ziehen, gehört zum Nudge „ein Bauteil für neuen Eintrag
  und Korrektur“ und damit zu Ticket 05.
