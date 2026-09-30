# Criteria: Rückfragen nennen ihr Ziel, lange Namen bleiben erreichbar

## Problem
Eine Rückfrage vor einer unwiderruflichen Aktion muss erkennen lassen, was
sie zerstört, und die Bedienelemente dafür müssen lesbar und erreichbar sein.
An drei Stellen ist das nicht so:

1. Die Rückfrage „Einsatz löschen“ in der Einsatzübersicht (`/operations`)
   nennt den Einsatz nicht. Nach einem Fehl-Tap auf die falsche Karte ist im
   Dialog nicht zu erkennen, dass gleich der falsche Einsatz samt
   Einsatztagebuch gelöscht wird.
2. Ein langer Dateiname ohne Leerzeichen im Ebenen-Panel der Lagekarte macht
   seine Zeile breiter als das Panel. Das Panel scrollt dann seitlich, die
   übrigen Bedienelemente sind links abgeschnitten, und am Handy liegt
   „Entfernen“ außerhalb des Bildschirms. Die Zeilen der Bild-Overlays sind
   gleich gebaut.
3. Dialog-Titel, die umbrechen, liegen ohne Zeilenabstand aufeinander und
   heben sich kaum vom Fließtext ab. Die Knöpfe der Rückfragen sind 36 px hoch
   und damit kleiner als für Touch üblich, obwohl die Lageführung am Handy
   unter Einsatzbedingungen bedient wird.

Stattdessen soll gelten: Jede Rückfrage zum Löschen eines Einsatzes nennt
ihn, jede Zeile im Ebenen-Panel bleibt bei jedem Namen im Panel, und Titel
und Knöpfe der Dialoge sind am Handy gut lesbar und bedienbar.

Aufgefallen ist alles bei der Abnahme von „Unwiderrufliche Aktionen
einheitlich bestätigen“ am 2026-09-30 im Browser, notiert in den Tickets 01,
04 und 07 unter `changes/2026-09-29-loeschen-bestaetigen/tickets/` (mit Commit
`fa67395` entfernt, in der Git-Historie nachzulesen). Verloren ging nichts; es
war ein Test-Einsatz.

## Acceptance criteria
Anführungszeichen in den ACs grenzen nur Texte der Oberfläche ab. Welche
Anführungszeichen die Oberfläche selbst zeigt, legen sie nicht fest.

- **AC-1** „Einsatz löschen“ im Menü „⋯“ einer Karte in `/operations` öffnet eine Rückfrage, deren Titel den Namen des Einsatzes dieser Karte nennt.
- **AC-2** Text und Knöpfe dieser Rückfrage bleiben: „Dieser Einsatz wird mit seinem gesamten Einsatztagebuch und allen Kartenobjekten unwiderruflich gelöscht.“, „Abbrechen“ und „Endgültig löschen“. Bestätigen löscht den Einsatz weiterhin, Abbrechen lässt ihn bestehen.
- **AC-3** Bei einem Einsatznamen aus 80 Zeichen ohne Leerzeichen bricht der Titel bei 390×844 und bei 1280×800 innerhalb des Dialogs um; der Dialog scrollt nicht seitlich, und beide Knöpfe sind ohne seitliches Scrollen sichtbar und antippbar.
- **AC-4** Im Ebenen-Panel mit je einer KML-Datei, einer KML-URL und einem Bild-Overlay, deren Namen aus 80 Zeichen ohne Leerzeichen bestehen: Bei 390×844 und bei 1280×800 scrollt das Panel nicht seitlich, jeder Name ist vollständig zu sehen (umgebrochen, nicht mit „…“ gekürzt), und Schalter sowie die Knöpfe „Entfernen“, „Neu laden“ und „Bearbeiten“ liegen im Panel und sind ohne seitliches Scrollen antippbar.
- **AC-5** Eine KML-Datei, eine KML-URL und ein Bild-Overlay mit dem Namen „Strecke“ stehen im Ebenen-Panel bei 390×844 und bei 1280×800 je in einer einzeiligen Zeile: Schalter, Name und Knöpfe nebeneinander wie bisher.
- **AC-6** In jedem Dialog der App ist der Titel halbfett, und bricht er auf mehrere Zeilen um, haben die Zeilen sichtbaren Abstand zueinander.
- **AC-7** In jeder Rückfrage (`ConfirmationModal`) sind „Abbrechen“ und der Bestätigungsknopf bei jeder Breite mindestens 44 px hoch.
- **AC-8** Knöpfe in den übrigen Dialogen, etwa „Speichern“ im Kartenzeichen-Dialog, behalten ihre bisherige Höhe.

## Agreed design
Die Rückfrage nennt den Einsatz im Titel, wie es die Rückfragen zu KML-Overlay
und Ansichtslink schon tun. Im Ebenen-Panel bricht der Name um, Schalter und
Knöpfe stehen oben in der Zeile. Der Titel aller Dialoge wird halbfett mit
Zeilenabstand, und das Schließen-X steht auf Höhe seiner ersten Zeile; die
Knöpfe werden nur in den Rückfragen 44 px hoch.

Specimen: <https://claude.ai/artifact/1PLS6cG2aAsQb7XToTRKa6>, Kopie in
[`specimens/varianten.html`](specimens/varianten.html).

**Agreed; build to this, do not redesign.**

## Nudges
- `OperationLifecycleActions` bekommt den Namen des Einsatzes als neue Prop; `OperationsOverview` reicht ihn durch.
- Den Titel nach dem Muster der KML-Rückfrage in `KmlPanel` bilden, also Gegenstand, Name in Anführungszeichen, Verb.
- Den Titel-Stil (Gewicht, Zeilenhöhe, `minWidth: 0`, `overflowWrap: "anywhere"`) einmal für `Modal` in `theme.ts` setzen und die `styles`-Prop in `ConfirmationModal`, die das heute dort tut, entfernen. Im selben Zug den Kopf des Dialogs oben ausrichten, damit das Schließen-X bei umbrechendem Titel nicht in die Mitte rutscht.
- Die 44 px an den beiden Knöpfen in `ConfirmationModal` setzen, nicht per Theme an `Button`.
- In den Zeilen des Ebenen-Panels (`KmlPanel`, `ImageOverlayPanel`) `miw={0}` und `overflowWrap: "anywhere"` am Label des Schalters, wie in `UserAdminPanel` und `OperationsOverview`; die Zeile oben ausrichten (`align="flex-start"`).
- AC-1 mit einem Testing-Library-Test pinnen. AC-3 bis AC-8 im Browser bei 390×844 und 1280×800 prüfen (Skill `run-einsatz`), weil jsdom kein Layout rechnet.
- Die Kürzung in `PanelRow` und `ViewLinkPanel` nicht anfassen.

## Out of scope
- Lage und Auffälligkeit der Lösch-Knöpfe.
- Der Fokus nach dem Schließen einer Rückfrage (Backlog: `fokus-nach-rueckfrage`).
- 44 px hohe Touch-Ziele außerhalb der Rückfragen.

## Ruled out
- **Name im Text statt im Titel** - weicht von den Rückfragen zu KML-Overlay und Ansichtslink ab.
- **Name zur Bestätigung eintippen** - bremst am Handy unter Einsatzbedingungen und wäre ein Sonderfall unter zwölf Rückfragen.
- **Dateiname mit „…“ kürzen** - hochgeladene Dateinamen unterscheiden sich meist erst am Ende.
- **Knöpfe unter den Namen** - macht jede Zeile zweizeilig, auch bei kurzem Namen.
- **Titel-Stil nur in `ConfirmationModal`** - die Dialoge hätten danach zwei Arten von Titel.
- **44 px hohe Knöpfe in allen Dialogen** - greift in Formulare ein, die diese Änderung sonst nicht berührt.
