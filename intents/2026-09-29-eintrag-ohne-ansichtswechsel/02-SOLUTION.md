# Solution: Seitenleiste am Desktop mit Lagekarte, ETB und Stärke

## Intent

`01-INTENT.md` in diesem Verzeichnis. Übernommen werden C-1 bis C-3 und alle
drei Constraints.

## Approach

Am Desktop (ab 48 em, dieselbe Schwelle wie heute) ist die Lagekarte immer
sichtbar und füllt die Fläche links. Rechts steht eine **Seitenleiste** in
Smartphone-Breite (360 px, wie das heutige Kartenpanel). Unten in der
Seitenleiste steht dieselbe Leiste wie am Smartphone: **Lagekarte**, **ETB**
und **Stärke**. Darüber steht die gewählte Ansicht (vom Nutzer so
entschieden: „nicht oben, sondern unten, wie auf dem Telefon", abweichend
vom Wortlaut in `IDEAS.md`). Die Leiste links
(`MainViewBar` als Spalte, 72 px) entfällt am Desktop. Muster:
`specimens/seitenleiste.html`.

- Unter **Lagekarte** zeigt die Seitenleiste das Kartenpanel, das heute
  neben der Karte liegt (Kartenzeichen, Bereiche, Ebenen). Es ist dort immer
  eines der drei Panels offen: anfangs Kartenzeichen, danach das zuletzt
  gewählte. Ein Kartenknopf stellt die Seitenleiste auf „Lagekarte" und zeigt
  sein Panel. Ein „Schließen" gibt es am Desktop nicht. Das weicht bewusst
  von `IDEAS.md` ab, wo die Seitenleiste nur ETB und Stärke hat. Der Nutzer
  hat es so entschieden: „Die Seitenleiste für die Karteninteraktion ist die
  gleiche Seitenleiste. Damit gibt es in der Seitenleiste den
  ‚Lagekarte'-Button auch auf dem Desktop." „Immer ein Panel" hat der Nutzer
  ebenfalls gewählt.
- Unter **ETB** und **Stärke** stehen `JournalPanel` und `StrengthPanel` wie
  heute. Am Desktop steht das Feld für den neuen Eintrag fest unten in der
  ETB-Ansicht, die Einträge scrollen darüber. Jeder Klick auf „ETB" setzt am
  Desktop den Cursor in dieses Feld, auch wenn das ETB schon gezeigt wird.
  So kostet ein Eintrag höchstens einen Klick, egal was die Seitenleiste
  vorher zeigt und wie lang das ETB ist.

Am Smartphone ändert sich nichts. Dort gibt es weiter die Leiste unten, die
Karte als eigene Ansicht und das Kartenpanel als Blatt über der Karte.

Es gibt weiter genau einen Zustand für die gewählte Ansicht (`MainView`:
`map`, `etb`, `strength`). Am Smartphone heißt `map` wie heute „Karte
zeigen". Am Desktop heißt es „Seitenleiste zeigt das Kartenpanel". Die Karte
selbst ist am Desktop von diesem Zustand unabhängig immer da. Deshalb übersteht
die Wahl auch einen Wechsel über die Schwelle hinweg (Tablet drehen).

Heute beendet ein Wechsel der Hauptansicht jeden Karten-Modus (Platzieren,
Zeichnen, Kreis verschieben, Bild-Overlay bearbeiten), damit ein späterer Tap
auf die wieder gezeigte Karte nicht unerwartet etwas auslöst
(`switchMainView` in `src/map/SituationWorkspace.tsx`). Diese Regel gilt
künftig nur noch dann, wenn die Karte durch den Wechsel verschwindet, also nur
am Smartphone. Am Desktop bleibt die Karte sichtbar und mit ihr der
Modusstreifen oben auf der Karte, deshalb bleibt der Modus dort bestehen.

Die Stärkemeldungs-Lösung (`intents/2026-09-26-staerkemeldungen/`) sieht
„Stärke" als dritten Punkt der Hauptansichtsleiste vor. `IDEAS.md` wollte
das am Desktop aufheben. Durch die Entscheidung des Nutzers für den
„Lagekarte"-Knopf bleibt es aber bei denselben drei Punkten wie am
Smartphone, nur steht die Leiste am Desktop unten in der Seitenleiste statt
links.

Für die Umsetzung: Heute steuern Inline-`display`-Stile die Sichtbarkeit, das
Kartenpanel sitzt in `.map-view`, und die Leiste steckt in Navbar bzw. Footer
von `LageansichtShell`. Künftig braucht es einen DOM-Aufbau, der am
Smartphone Karte mit Blatt und Leiste im Footer ergibt und am Desktop Karte
plus Seitenleiste (Ansicht, darunter Leiste). Beim Überschreiten der
Schwelle bleibt alles eingehängt, wie es die bestehenden Tests verlangen
(„does not recreate the map", „keeps … when switching"). Die Regel vor der
Hydration in `situation-workspace.css` blendet heute am Desktop das ETB aus
und muss für AC-10 umgedreht werden. Tests, die das bisherige Verhalten
festhalten, werden umgeschrieben: Wechsel beendet den Modus, Desktop startet
auf der Karte, Panel mit ✕ und Umschaltknopf.

## Behaviour

- **AC-1** Am Desktop füllt die Lagekarte die Fläche links neben einer
  360 px breiten Seitenleiste, unabhängig davon, was die Seitenleiste zeigt.
  Unten in der Seitenleiste stehen die Knöpfe „Lagekarte", „ETB" und
  „Stärke", darüber die gewählte Ansicht. Links gibt es keine Leiste. *(C-1, C-2, C-3)*
- **AC-2** Jeder Klick auf „ETB" in der Seitenleiste setzt am Desktop den
  Cursor in das Textfeld für einen neuen Eintrag, auch wenn das ETB schon
  gezeigt wird. *(C-1)*
- **AC-12** Zeigt die Seitenleiste am Desktop das ETB, ist das Textfeld für
  einen neuen Eintrag samt Absende-Knopf sichtbar, ohne zu scrollen, auch bei
  langem ETB. Die Einträge scrollen darüber. *(C-1)*
- **AC-3** Zeigt die Seitenleiste das ETB, ist ein neuer Eintrag: ins Feld
  klicken, tippen, mit Strg+Enter oder „Eintrag hinzufügen" absenden. Danach zeigt die
  Seitenleiste weiter das ETB, und die Karte hat denselben Ausschnitt und
  denselben Modus wie vorher. *(C-1, C-3)*
- **AC-4** Zeigt die Seitenleiste „Stärke", öffnet ein Klick auf eine Stelle
  deren Meldungsformular. Nach „Melden" oder „Unverändert melden" zeigt die
  Seitenleiste wieder die Übersicht der Stellen, und die Karte hat denselben
  Ausschnitt und Modus wie vorher. *(C-2, C-3)*
- **AC-5** Ein Wechsel zwischen „Lagekarte", „ETB" und „Stärke" ändert am
  Desktop weder den Kartenausschnitt noch beendet er einen Karten-Modus. Am
  Smartphone beendet ein Wechsel, der die Karte ausblendet, den Modus wie
  heute. *(C-3)*
- **AC-6** Ein Mausklick oder Ziehen auf der Karte wirkt direkt nach dem
  Absenden aus AC-3 oder AC-4, ohne dass vorher etwas angeklickt werden muss
  (Ziehen verschiebt die Karte, ein Klick auf ein Kartenzeichen öffnet es).
  *(C-3)*
- **AC-7** ETB und Stärke bleiben beim Wechsel eingehängt. Ein angefangener
  ETB-Eintrag oder ein angefangenes Meldungsformular ist nach einem Wechsel
  zu „Lagekarte" oder nach Arbeit an der Karte unverändert da. *(Constraint:
  angefangene Eingaben)*
- **AC-8** Zeigt die Seitenleiste nicht das ETB, zählt der Knopf „ETB" die
  neuen Einträge anderer, nach denselben Regeln wie heute die
  Hauptansichtsleiste (`countUnseenEntries`). *(Constraint: neue Einträge
  bemerkbar)*
- **AC-9** Unter „Lagekarte" zeigt die Seitenleiste am Desktop immer genau
  eines der Panels Kartenzeichen, Bereiche oder Ebenen: nach dem Laden
  Kartenzeichen, danach das zuletzt gewählte. Ein Klick auf einen Kartenknopf
  stellt die Seitenleiste auf „Lagekarte" mit diesem Panel. Ein erneuter
  Klick auf den Knopf des gezeigten Panels ändert nichts. Der Knopf des
  gezeigten Panels ist hervorgehoben, solange die Seitenleiste „Lagekarte"
  zeigt. Am Desktop hat das Panel keinen „Schließen"-Knopf. *(Lösung des
  Nutzers; hält die Kartenarbeit aus C-3 ohne zweite Spalte neben der
  Seitenleiste möglich)*
- **AC-10** Nach dem Laden zeigt die Seitenleiste am Desktop das ETB, auch
  schon vor der Hydration, ohne sichtbares Umspringen. *(Keine Bedingung;
  Startansicht nach dem Anlass des Intents: kurz etwas ins ETB schreiben)*
- **AC-11** Am Smartphone (unter 48 em) verhält sich alles wie vor dieser
  Änderung: Leiste unten mit Lagekarte, ETB und Stärke, Startansicht ETB,
  Kartenpanel als Blatt über der Karte mit „Schließen", kein automatischer
  Cursor im ETB-Feld. *(Constraint: Smartphone unverändert)*

## Edge cases

- **Wechsel über die Schwelle.** Die gewählte Ansicht bleibt erhalten.
  Desktop → Smartphone mit „Lagekarte": Das Smartphone zeigt die Karte. Wurde
  am Desktop ein Kartenknopf gedrückt, ist dessen Panel als Blatt offen,
  sonst ist das Blatt geschlossen. Smartphone → Desktop mit geschlossenem
  Blatt: Unter „Lagekarte" steht Kartenzeichen. (Vom Nutzer beim Schneiden
  so gewählt: „Was einfacher ist.")
- **Stärke nicht in der Übersicht verlassen.** Ein Klick auf „Stärke" zeigt
  die Stärke so, wie sie verlassen wurde, wie heute. Stand dort noch ein
  Formular, der Verlauf einer Stelle, der Summenverlauf, das Umbenennen oder
  Anlegen einer Stelle oder eine Korrektur, braucht eine Meldung für eine
  andere Stelle „Zurück" und dann die Stelle. Kommt die Führungskraft vom
  ETB, sind das zwei Aktionen vor dem Ausfüllen („Stärke", „Zurück"). Ein
  angefangenes Formular geht dabei verloren, wie heute. Diese Ausnahme von
  C-2 hat der Nutzer hingenommen (siehe `Accepted tradeoffs`).
- **Karten-Modus und Seitenleiste.** Ist am Desktop ein Kartenzeichen zum
  Platzieren gewählt und schreibt die Führungskraft dann ins ETB, bleibt der
  Modus mit seinem Streifen auf der Karte bestehen. Der nächste Klick auf die
  Karte platziert das Zeichen (AC-5). Ein Karten-Modus endet, sobald die
  Karte verschwindet: am Smartphone durch einen Wechsel weg von „Lagekarte",
  und ebenso, wenn das Fenster unter die Schwelle schmaler wird, während die
  Seitenleiste ETB oder Stärke zeigt. (Vom Nutzer beim Schneiden
  freigegeben.)
- **Modals.** Bereich-Editor, Kartenzeichen-Details und „Kartenzeichen
  zusammensetzen" bleiben Modals über allem, wie heute.

## Non-goals

- Karte und Kartenpanel gleichzeitig mit ETB oder Stärke sehen. Die
  Seitenleiste zeigt immer genau eine Ansicht.
- Tastenkürzel für ETB oder Stärke.
- Eine verstellbare oder einklappbare Seitenleiste.
- Änderungen an Ansichts- und Geräteansicht (`DeviceView`); sie haben keine
  Hauptansichtsleiste.

## Accepted tradeoffs

- **Die Karte ist am Desktop immer 360 px schmaler.** Heute hat sie bei
  geschlossenem Kartenpanel die volle Breite abzüglich 72 px Leiste. Dafür
  sind ETB und Stärke immer nur einen Klick entfernt, ohne dass die Karte
  verschwindet (C-1 bis C-3).
- **ETB und Stärke sind am Desktop nur noch 360 px breit statt bis zu
  720 px.** Lange Einträge brechen öfter um, und im ETB zurückzulesen braucht
  mehr Scrollen. Dafür ist die Seitenleiste dieselbe Oberfläche wie am
  Smartphone, die für 360 px schon gebaut ist (Stärke: AC-15 der
  Stärkemeldungs-Lösung).
- **Kartenpanel und ETB schließen sich gegenseitig aus.** Wer beim Schreiben
  die Kartenzeichenliste braucht, muss umschalten. Dafür gibt es keine
  zweite 360-px-Spalte, die die Karte weiter verkleinert.
- **Eine Aktion zu viel, wenn „Stärke" nicht in der Übersicht verlassen
  wurde** (siehe `Edge cases`). Dafür bleibt `StrengthPanel` unverändert.
  Die Alternative, dass „Stärke" zur Übersicht springt, außer ein Formular
  ist schon angefangen, hätte C-2 in den meisten dieser Fälle gehalten, aber
  eine Erkennung angefangener Eingaben gebraucht. Vom Nutzer hingenommen:
  „Nimm die einfachste Lösung, die sind alle ok".
- **Ein Karten-Modus bleibt an, auch wenn sein Panel nicht zu sehen ist.**
  Zeigt die Seitenleiste ETB oder Stärke, während ein Bild-Overlay bearbeitet
  oder ein Bereich gezeichnet wird, fehlen die Bedienelemente aus dem Panel
  (Deckkraft, Ersetzen, Löschen im Ebenen-Panel, Formwahl im
  Bereiche-Panel). Auf der Karte bleibt nur der Modusstreifen mit
  „Fertig"/„Abbrechen". Dafür reißt ein kurzer ETB-Eintrag den Modus nicht
  ab (AC-5). Zurück kommt man über „Lagekarte" oder den Kartenknopf.
- **Am Desktop kein „Schließen" mehr für das Kartenpanel.** Es gibt nichts
  mehr, was durch Schließen frei würde, weil die Seitenleiste ohnehin da ist.

## Ruled out

Laut `IDEAS.md` steht die Lösung für Thema 4 fest und ist nicht zu
hinterfragen. Das Feld wurde deshalb nicht zu Mustern ausgebaut, sondern nur so
weit betrachtet, dass die Entscheidung mit ihren Alternativen festgehalten
ist.

- **Seitenleiste nur mit ETB und Stärke, Kartenpanel wie heute als eigene
  Spalte daneben** (der Wortlaut von `IDEAS.md` vor der Zusatzinfo des
  Nutzers): Bei offenem Kartenpanel stünden zwei 360-px-Spalten neben der
  Karte, und die Karte verlöre 720 px. Vom Nutzer durch „die gleiche
  Seitenleiste" ersetzt.
- **ETB und Stärke als Fenster über der Karte, per Knopf oder Tastenkürzel
  geöffnet und nach dem Absenden geschlossen:** Das erfüllt C-1 bis C-3 auch
  und lässt die Karte breit. Laut `IDEAS.md` aber nicht gewählt.
- **Die Reiter von vor `838f32c` wiederherstellen** (ETB als Reiter neben
  Kartenzeichen, Bereichen und Ebenen): Das ist dieselbe Form mit vier
  gleichrangigen Reitern statt drei. „Stärke" käme als fünfter Reiter dazu,
  und die Leiste wäre eine andere als am Smartphone.
- **Ein ETB-Schnellfeld direkt auf der Karte:** Es deckt Stärkemeldungen
  nicht ab (C-2) und bräuchte einen eigenen Weg, neue Einträge zu zeigen.
