---
criteria:  CRITERIA.md
closes:    AC-3, AC-6, AC-8
advances:
after:     05-von-an-weg-korrigieren
status:    done
attempts:  1
---

## Build
Jedes Gerät merkt sich je Gesamteinsatz, wann es welchen Von- und An-Wert
zuletzt benutzt hat und welchen Weg der letzte neue Eintrag hatte. Die
Chip-Zeilen sortieren danach, und die Weg-Auswahl startet mit dem gemerkten
Weg.

## Done when
> **AC-3** Jede Zeile ist sortiert nach der letzten erfolgreichen Verwendung in diesem Feld auf diesem Gerät in diesem Gesamteinsatz, die zuletzt benutzte zuerst; danach folgen die übrigen Werte alphabetisch. Groß- und Kleinschreibung zählen dabei nicht. Als Verwendung zählt nur das Speichern eines neuen Eintrags, keine Korrektur. Die Reihenfolge übersteht ein Neuladen der Seite. Ohne Browser-Speicher (z. B. privater Modus) ist alles alphabetisch, und alles andere funktioniert.

> **AC-6** Der Weg ist eine Auswahl neben „Eintrag hinzufügen“ mit *Funk*, *Telefon*, *Persönlich*, *Andere …* und *ohne*. *Andere …* macht aus der Auswahl ein Freitextfeld an derselben Stelle, das bei 360 px Breite mindestens 150 px breit ist; „×“ macht wieder die Auswahl daraus. Vorbelegt ist der Weg des zuletzt auf diesem Gerät in diesem Gesamteinsatz gespeicherten neuen Eintrags, auch ein Freitext-Weg und auch *ohne*; eine Korrektur ändert ihn nicht. Auf einem Gerät ohne gemerkten Weg ist es *Funk*.

> **AC-8** Nach erfolgreichem Speichern ist der Text leer, Von und An sind abgewählt, offene „andere …“-Felder sind geschlossen, der Weg bleibt. Bei einem Fehler bleiben Text, Von, An und Weg erhalten, und die Fehlermeldung erscheint wie heute. Reihenfolge (AC-3) und gemerkter Weg (AC-6) ändern sich nur bei erfolgreichem Speichern.

## Nudges
> Reihenfolge und gemerkten Weg nach dem Muster von `src/map/last-view-storage.ts` im `localStorage` halten: Schlüssel je Gesamteinsatz, jeder Zugriff in try/catch.

## Context
**Nach Ticket 02 bis 05.** `src/journal/EntryRouteFields.tsx` zeigt die
Chip-Zeilen Von/An mit den Werten aus `correspondents` alphabetisch, mit
„andere …“ und der Weg-Auswahl (*Funk*, *Telefon*, *Persönlich*, *Andere …*
mit Freitext, *ohne*). Beim Korrigieren steht ein vorbelegter Chip vorne in
seiner Zeile; das muss so bleiben. „×“ am Freitext-Weg kehrt zu dem Weg
zurück, der vor *Andere …* gewählt war; das bleibt auch mit gemerktem Weg so. `JournalPanel`
(`src/app/operations/[id]/JournalPanel.tsx`) hält die Route des neuen Eintrags
im Zustand, beginnt mit Weg *Funk* und setzt nach Erfolg Text, Von und An
zurück, der Weg bleibt. `JournalPanel` kennt die `operationId` bisher nicht;
`SituationWorkspace` hat sie als Prop.

**Vorbild.** `src/map/last-view-storage.ts` speichert den letzten
Kartenausschnitt je Einsatz im `localStorage`: Schlüssel
`einsatz:lastView:${operationId}`, Lesen prüft die Form und fällt auf `null`
zurück, jeder Zugriff in try/catch. Gelesen wird er nur in einem `useEffect`
(`src/map/SituationMap.tsx`, um Zeile 161), nie beim Rendern.

**Server-Rendering.** `page.tsx` ist eine Server Component und rendert
`SituationWorkspace` und `JournalPanel` auf dem Server vor. Dort gibt es keinen
`localStorage`: Das erste Rendern muss alphabetisch und mit *Funk* sein, sonst
weicht die Hydration ab.

**Werte vergleichen.** AC-2 fasst Werte ohne Rücksicht auf Groß- und
Kleinschreibung zusammen und zeigt die jüngste Schreibweise; deshalb wird hier
nach `wert.toLowerCase()` gemerkt, nicht nach der Schreibweise.

## Plan
1. **AC-3 und AC-6 als Tests, rot.** In
   `src/app/operations/[id]/JournalPanel.route.test.tsx` (mit echtem
   jsdom-`localStorage`, vor jedem Test geleert):
   - Nach „Von UHSt 2 an EAL“ speichern steht in Von „UHSt 2“ vorne, in An
     „EAL“; nach „Von EAL an UHSt 2“ ist es umgekehrt; übrige Werte
     alphabetisch dahinter.
   - Gemerkt „UHSt 2“, `correspondents` liefert jetzt „UHST 2“ → steht vorne.
   - Neu rendern (Neuladen) behält die Reihenfolge.
   - Eine Korrektur mit Von „UHSt 4“ ändert die Reihenfolge nicht.
   - Ein anderer Gesamteinsatz (andere `operationId`) hat seine eigene Reihenfolge.
   - Weg: Nach Speichern mit *Telefon* startet ein neu gerendertes Panel mit
     *Telefon*; nach *ohne* mit *ohne*; nach Freitext „Melder“ mit dem
     Freitextfeld „Melder“; ohne Gemerktes mit *Funk*; eine Korrektur mit
     *Persönlich* ändert ihn nicht.
   - `localStorage.setItem`/`getItem` werfen (privater Modus) → alphabetisch,
     *Funk*, Speichern funktioniert.
   *Beweis:* rot, weil nichts gemerkt wird.
2. **Speicher.** `src/journal/entry-route-storage.ts` (neu) nach dem Muster von
   `last-view-storage.ts`: Schlüssel `einsatz:entryRoute:${operationId}`, Inhalt
   `{ sender: Record<string, number>, recipient: Record<string, number>, channel?: string | null }`
   (Wert klein geschrieben → Zeitstempel; `channel` fehlt = nichts gemerkt,
   `null` = *ohne*). Funktionen `readEntryRouteMemory(operationId)` und
   `rememberEntryRoute(operationId, route)`. Lesen prüft die Form, sonst leer.
   *Beweis:* `src/journal/entry-route-storage.test.ts` (neu): Schreiben und
   Lesen, kaputter Inhalt ergibt leer, werfender Speicher ergibt leer ohne
   Fehler.
3. **Sortieren als reine Funktion.** `orderCorrespondents(values, used)` in
   `src/journal/entry-route.ts`: zuerst die in `used` bekannten nach Zeitstempel
   absteigend (Vergleich klein geschrieben), dann die übrigen alphabetisch.
   *Beweis:* Tabellentest in `src/journal/entry-route.test.ts`.
4. **Einbauen.** `SituationWorkspace` reicht `operationId` an `JournalPanel`.
   `JournalPanel` liest das Gemerkte in einem `useEffect` nach dem Mounten
   (nicht beim Rendern, siehe *Server-Rendering*): Die Reihenfolge wird immer
   übernommen, der Weg nur, wenn die Weg-Auswahl seit dem Mounten nicht bedient
   wurde. `rememberEntryRoute` nur nach erfolgreichem `onAdd`, nie nach
   `onCorrect` und nie bei einem Fehler. Beim Korrigieren
   bleibt der vorbelegte Chip vorne.
   *Beweis:* Tests aus Schritt 1 grün; ein Test, der den Weg vor dem Effekt
   wählt (z. B. Speicher erst nach dem ersten Rendern füllen und dann
   `rerender`), zeigt, dass die Wahl nicht überschrieben wird; bestehende Tests
   in `JournalPanel.correct.test.tsx` und `JournalPanel.route.test.tsx` bleiben
   grün.
5. **AC-8 zu Ende.** Test in `JournalPanel.route.test.tsx`: Ein fehlgeschlagenes
   Speichern (`{ error }`) ändert weder Reihenfolge noch gemerkten Weg.
   *Beweis:* grün.
6. **Im Browser prüfen.** Mit dem Skill `run-einsatz`: zwei Einträge mit
   wechselnder Richtung anlegen, Seite neu laden, Reihenfolge und Weg bleiben;
   in einem privaten Fenster ist alles alphabetisch und *Funk*; die
   Browser-Konsole zeigt beim Laden keinen Hydration-Fehler.
   *Beweis:* Beobachtung unter `## Left standing`.

## Not here
- Nichts davon wird auf dem Server gespeichert; die Werteliste selbst bleibt `listCorrespondents` aus Ticket 03.
- Aus *Out of scope*: Chips entfernen, z. B. durch langes Drücken. Wird gebaut, falls vertippte Werte im Einsatz stören.

## Left standing
- Review-Nit nicht umgesetzt: `JournalPanel` gibt `presetChannel` ausdrücklich
  als *Funk* weiter, wenn nichts gemerkt ist, obwohl `NEW_ENTRY` schon mit
  *Funk* beginnt. Ohne diese Zeile bliebe beim Wechsel in einen anderen
  Gesamteinsatz ohne Neuladen der gemerkte Weg des vorigen stehen, weil
  `EntryForm` einen fehlenden Wert nicht übernimmt.
- Review-Nit nicht umgesetzt: Speichert ein zweiter Tab desselben
  Gesamteinsatzes auf demselben Gerät, zeigt der erste die alte Reihenfolge,
  bis er neu lädt oder selbst speichert. Gespeichert wird trotzdem richtig,
  weil `rememberEntryRoute` vor dem Schreiben neu liest. Auf das
  `storage`-Ereignis zu hören, verlangt kein Kriterium.
- Nicht erneut geprüft: Den Blocker der zweiten Review (Von, An und Weg wurden
  ungetrimmt gemerkt, der Server speichert sie getrimmt) und ihren Should-fix
  (Test, dass das Server-Rendern das Gemerkte nicht liest) habe ich nach der
  zweiten und letzten Runde behoben, jeweils mit einem Test, der zuerst
  fehlschlug. Eine dritte Review und ein Blick in den Browser darauf gab es
  nicht. Dafür ist `trimToNull` aus `src/server/journal/journal.ts` als
  `trimRouteValue` nach `src/journal/entry-route.ts` gezogen, damit Server und
  Gerät dieselbe Regel benutzen.
- Was kein automatischer Test prüft, haben die Reviewer im Browser geprüft
  (360×800 und 1920×1080): Nach Neuladen bleiben Reihenfolge und Weg (*Telefon*,
  Freitext „Melder“, *ohne*). Die Browser-Konsole zeigt beim Laden keinen
  Hydration-Fehler, mit und ohne Gemerktes. Der Freitext-Weg ist bei 360 px
  151,2 px breit, „Eintrag hinzufügen“ daneben ungekürzt. Ein echtes privates
  Fenster ließ sich mit dem Browser-Treiber nicht öffnen. Stattdessen haben
  sie den Speicher geleert (alphabetisch, *Funk*) und `localStorage` werfen
  lassen (Speichern geht, keine Fehlermeldung, alphabetisch). Das Neuladen
  zeigt bis zur Hydration kurz alphabetisch und *Funk*, dann springen Chips
  und Weg auf das Gemerkte. Das folgt aus der Vorgabe zum Server-Rendern; im
  Dev-Modus ist der Sprung sichtbar.
- Abweichung vom Plan, Schritt 1: Die Tests stehen in der neuen Datei
  `JournalPanel.remembered.test.tsx`, nicht in `JournalPanel.route.test.tsx`,
  die schon 300 Zeilen hat. `localStorage` leert jetzt `src/test/setup.ts`
  nach jedem Test, für alle DOM-Tests, weil auch andere Testdateien Einträge
  speichern und sich sonst über die Reihenfolge beeinflussen würden.
- Abweichung vom Plan, Schritt 2: Gemerkt wird statt eines Zeitstempels eine
  Zahl je Feld, die mit jeder Verwendung um eins über die bisher größte
  steigt. Zwei Einträge in derselben Millisekunde hätten sonst denselben Wert.
  `NOTHING_REMEMBERED` ist zusätzlich exportiert, als Anfangszustand des Panels.
- Abweichung vom Plan, Schritt 4: Den gemerkten Weg übernimmt `EntryForm` über
  die neue Prop `presetChannel`, solange die Weg-Auswahl nicht bedient wurde.
  `EntryChannelSelect` wird dafür zum Textfeld, auch wenn ein Freitext-Weg
  erst nach dem Mounten kommt, und bleibt eines, wenn man es leert
  (Should-fix der ersten Review). Der Test „Wahl wird nicht überschrieben“
  wechselt die `operationId` beim `rerender`, denn gelesen wird nur beim
  Mounten und beim Wechsel des Gesamteinsatzes.
- Abweichung vom Plan, Schritt 6: Im Browser habe ich nicht selbst geprüft.
  Das haben die Reviewer in beiden Runden übernommen, mit den Beobachtungen
  oben.
- Zum TDD-Ablauf: Einige Tests liefen gleich grün, weil ihr Erwartungswert
  „nichts ändert sich“ ist: „keeps its own order in each Gesamteinsatz“,
  „presets Funk on a device that remembers no Weg“, „keeps its own Weg in each
  Gesamteinsatz“, „keeps a Weg chosen before the remembered one arrives“,
  „orders alphabetically, presets Funk and adds without browser storage“,
  „changes neither order nor remembered Weg when adding fails“, „renders on
  the server alphabetically …“, „puts the pinned value before the one used
  last“ und die Tests für kaputten Speicherinhalt. Gegen kaputten Code
  schlugen fehl: der Weg-Test ohne Prüfung auf `channelChosen`, der
  Fehler-Test mit Merken vor der Fehlerprüfung, der Korrektur-Test mit Merken
  nach einer Korrektur, der Test ohne Browser-Speicher ohne try/catch um
  `setItem`, der Server-Test mit Lesen beim ersten Rendern und die Tests für
  kaputten Inhalt ohne Formprüfung. Die übrigen habe ich so nicht geprüft. Die
  Sortierung in `EntryRouteChips` habe ich vor ihrem Test eingebaut; den Test
  habe ich gegen den Stand ohne diese Änderung laufen lassen, er schlug fehl.
