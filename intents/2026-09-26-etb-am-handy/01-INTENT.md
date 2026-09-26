# Intent: Das ETB am Handy hat zu wenig Platz

## Problem

Unterwegs führt der Führungsassistent das ETB am Handy; die Lagekarte braucht
er dort kaum. Die Führungsansicht teilt den schmalen Bildschirm trotzdem so
auf, als stünden Karte und ETB gleichrangig nebeneinander: Links bleibt ein
Streifen Karte, den niemand nutzt, ein langer Einsatzname bricht in der
Kopfzeile um und läuft über sie hinaus, und der Knopf „Teilen" (für
Ansichtslinks) ist abgeschnitten. Für das Lesen und Schreiben von Einträgen
bleibt nur ein Teil des Bildschirms. Das ist benutzbar, aber mühsam.
Stattdessen soll am Handy die Ansicht, mit der gerade gearbeitet wird (ETB,
künftig auch die Stärke), die Bildschirmfläche bekommen, und alle
Bedienelemente sollen vollständig sichtbar und erreichbar sein.

## Evidence

- Cyclassics 2026: Der Führungsassistent hat das Werkzeug im ELW auf dem
  Tablet und unterwegs auf dem Handy genutzt, auf dem Handy vor allem für das
  ETB. Beobachtet: links ein Streifen Karte, der lange Einsatzname in der
  Kopfzeile umgebrochen, der Knopf „Teilen" nicht vollständig sichtbar.
  „Grundsätzlich war es benutzbar, es war nur keine Freude es zu benutzen."
  (Mündlich vom Nutzer.)
- Die Führungsansicht hat kein eigenes Handylayout: Die Seitenleiste ist fest
  360 px breit, beim Öffnen ausgeklappt und steht neben der Karte
  (`src/map/SituationWorkspace.tsx`, `w={360}`, `useDisclosure(true)`). Die
  Kopfzeile (`src/app/operations/[id]/LageansichtShell.tsx`) setzt Zurück-Link,
  Einsatzname, Teilen-Knopf und Status in eine nicht umbrechende Zeile von
  56 px Höhe.
- Ein messbarer Schaden (verpasster oder verspäteter Eintrag) ist nicht
  berichtet.

## Done when

Gemessen im Hochformat bei 360 × 640 CSS-Pixeln, jeweils mit dem Einsatznamen
„Cyclassics 2026 – Einsatzabschnitt 4 Nord" (41 Zeichen):

- **C-1** Während die Führungskraft das ETB liest oder schreibt, nehmen die
  ETB-Einträge die volle Bildschirmbreite ein (abzüglich höchstens 16 px Rand
  je Seite), und die Lagekarte ist nirgends auf dem Bildschirm sichtbar.
- **C-2** Während das ETB genutzt wird, belegen alle Bedienelemente, die nicht
  zum ETB gehören, zusammen höchstens 120 px der Bildschirmhöhe.
- **C-3** Vom ETB aus ist jedes Element der heutigen Kopfzeile (Zurück zu
  „Einsätze", Einsatzname, „Teilen", Status) vollständig sichtbar oder mit
  einem Tipp erreichbar; von der Lagekarte aus gilt dasselbe für Kartenzeichen,
  Bereiche und Ebenen. Die Seite scrollt nicht waagerecht. Der Einsatzname darf
  gekürzt angezeigt werden, wenn er mit einem Tipp vollständig lesbar ist.
  (Vom Nutzer bei der Lösungssuche geändert: Kartenzeichen, Bereiche und
  Ebenen gehören zur Lagekarte und müssen nicht vom ETB aus in einem Tipp
  erreichbar sein.)
- **C-4** Von der Arbeit im ETB aus ist die Lagekarte mit höchstens 2 Tipps
  erreichbar und von dort das ETB ebenso.
- **C-5** C-1 bis C-4 gelten ebenso für die Stärke-Ansicht aus
  `intents/2026-09-26-staerkemeldungen/`, sobald es sie gibt.

## Constraints

- Alle Funktionen der Führungsansicht bleiben auf jeder Bildschirmgröße
  erreichbar. Eine Lösung, die am Handy, Tablet oder Desktop Funktionen
  weglässt, scheidet aus.

## Not this

- Ein Problem am Tablet oder Desktop lösen: Dort ist keins berichtet. Eine
  Lösung darf das Layout dort mitändern (z. B. dieselbe Aufteilung in
  Reiter), muss es aber nicht. (Vom Nutzer so entschieden: „Wir ändern das
  Layout, wir können auch Desktop mitdenken.")
- Geräte- und Ansichtslink-Ansicht (`DeviceView`, `ViewLinkView`).
- Bedienung der Lagekarte selbst am Handy (Zeichnen, Kartenzeichen setzen).

## User's solution

„‚Einsatztagebuch' und das neue Tab ‚Stärkemeldungen' liegen parallel zu
‚Lagekarte', die Tabs ‚Kartenzeichen', ‚Bereiche' und ‚Ebenen' gehören zur
Lagekarte. Das heißt wir haben eine Hauptnavigation mit den drei
Navigationspunkten, die sowohl in der Desktop- als auch in der
Handynavigation ‚Fullscreen' sind. Allgemein ist das Handylayout
verbesserungswürdig."
