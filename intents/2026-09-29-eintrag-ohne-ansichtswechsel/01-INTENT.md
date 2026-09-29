# Intent: ETB-Eintrag und Stärkemeldung von der Karte aus ohne Hin- und Herwechseln

## Problem

Am Desktop arbeitet die Führungskraft an der Lagekarte und hält zwischendurch
kurz etwas im ETB fest oder erfasst eine Stärkemeldung. Seit ETB und Stärke am
Desktop eigene Hauptansichten sind, die die Lagekarte ersetzen, kostet jeder
dieser Vorgänge zwei zusätzliche Klicks: vorher weg von der Lagekarte, danach
zurück. Vorher stand das ETB als Reiter neben der Karte, und ein Eintrag hieß:
ins Feld klicken, tippen, absenden. Stattdessen soll ein ETB-Eintrag oder eine
Stärkemeldung von der Lagekarte aus ohne diesen Umweg gehen, und danach soll
die Führungskraft ohne weiteren Klick an der Karte weiterarbeiten können.

## Evidence

- Der Nutzer arbeitet am Desktop aktiv an der Karte und will „nur kurz
  Einträge im ETB machen. Das sind neuerdings zu viele Klicks." Gestört haben
  ihn die Klicks, nicht dass die Karte beim Schreiben verdeckt ist. Für
  Stärkemeldungen gilt laut Nutzer dasselbe. (Mündlich vom Nutzer,
  2026-09-29.)
- „Neuerdings": Commit `838f32c` (27.09.2026, „Add a main-view bar switching
  between Lagekarte and ETB") zeigt genau eine Hauptansicht zugleich. Davor
  war das ETB ein Reiter (`Tabs`, Standardreiter `"etb"`) in der Seitenleiste
  neben der Karte (`git show 838f32c^:einsatz/src/map/SituationWorkspace.tsx`).
  Mit `37d8cb1` kam „Stärke" als dritte Hauptansicht dazu.
- Heutiger Ablauf eines ETB-Eintrags am Desktop: „ETB" in der
  Hauptansichtsleiste klicken, ins Textfeld klicken, tippen, mit Strg+Enter
  oder Knopf absenden, „Lagekarte" klicken (`src/map/MainViewBar.tsx`,
  `src/app/operations/[id]/JournalPanel.tsx`; das Textfeld bekommt beim
  Wechsel keinen Fokus).
- Wie oft das im Einsatz vorkommt, ist nicht beziffert. Der Wechsel ist erst
  zwei Tage alt, ein Einsatz damit hat noch nicht stattgefunden.

## Done when

„Desktop" heißt hier: Fensterbreite ab der heutigen Desktop-Schwelle (48 em).

- **C-1** Am Desktop bei sichtbarer Lagekarte braucht ein neuer ETB-Eintrag
  außer Tippen und Absenden höchstens eine Aktion (Klick oder Tastendruck).
- **C-2** Am Desktop bei sichtbarer Lagekarte braucht eine neue
  Stärkemeldung einer Stelle höchstens eine Aktion mehr, als das Ausfüllen
  und Absenden der Meldung selbst braucht. Die Wahl der Stelle zählt zum
  Ausfüllen (vom Nutzer so entschieden). „Gesamtstärke melden" ist nicht
  gemeint. Ausnahme: Wurde die Stärke zuletzt nicht in der Übersicht der
  Stellen verlassen (z. B. Formular oder Verlauf einer anderen Stelle,
  Summenverlauf, Umbenennen), darf es eine Aktion mehr sein (vom Nutzer bei
  der Lösungssuche hingenommen: „Nimm die einfachste Lösung, die sind alle
  ok").
- **C-3** Nach dem Absenden aus C-1 oder C-2 ist die Lagekarte sichtbar, mit
  unverändertem Kartenausschnitt, und die nächste Kartenaktion (Karte
  verschieben, Kartenzeichen antippen) wirkt ohne vorherigen Klick.

## Constraints

- Am Smartphone bleibt die Bedienung wie heute: Leiste unten mit Lagekarte,
  ETB und Stärke (`IDEAS.md`, Thema 4). Eine Lösung, die dort etwas ändert,
  scheidet aus.
- Angefangene Eingaben im ETB und in der Stärke gehen nicht verloren, wenn
  die Führungskraft zwischendurch an der Karte arbeitet (heute zugesichert:
  die Ansichten bleiben eingehängt, ETB seit `838f32c`, Stärke seit
  `37d8cb1`). Eine Lösung, die sie
  verwirft, scheidet aus.
- Neue ETB-Einträge anderer bleiben bemerkbar, während die Führungskraft
  nicht ins ETB schaut (heute der Zähler an der Hauptansichtsleiste,
  `a049d9b`). Eine Lösung, die das verliert, scheidet aus.

## Not this

- Die Karte beim Schreiben im Blick behalten: laut Nutzer nicht das Problem.
- Welche Felder ein ETB-Eintrag hat (Von/An/Weg): `IDEAS.md`, Thema 2.

## User's solution

Aus `IDEAS.md`, Thema 4 „Desktop-Layout mit Seitenleiste". Laut `IDEAS.md`
steht die Lösung fest und ist umzusetzen:

„Am Desktop füllt die Lagekarte immer den Bildschirm. Rechts sitzt eine
Seitenleiste in Smartphone-Breite, im Grunde der Smartphone-Bildschirm: oben
zwei Knöpfe **ETB** und **Stärke**, darunter die gewählte Ansicht. Die
Hauptansichtsleiste links (`MainViewBar`) entfällt am Desktop. Die Karte ist
dort keine umschaltbare Ansicht mehr. […]

- Beide Ansichten der Seitenleiste bleiben beim Umschalten eingehängt,
  angefangene Eingaben bleiben also erhalten.
- Zeigt die Seitenleiste „Stärke", zählt der ETB-Knopf neue Einträge wie
  heute die Hauptansichtsleiste.
- Am Smartphone bleibt alles wie es ist: Leiste unten mit Lagekarte, ETB und
  Stärke."
