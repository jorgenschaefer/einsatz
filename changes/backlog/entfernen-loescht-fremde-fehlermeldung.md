---
effort: S
complexity: S
utility: M
---

# Ein erfolgreiches Entfernen löscht die Meldung einer anderen Aktion

Offen, die Entscheidung steht aus. Im KML-Panel räumt ein erfolgreiches
„Entfernen“ die Meldung des Panels weg (`KmlPanel.tsx`, `remove`), im
Ansichtslink-Panel ein erfolgreiches Löschen (`ViewLinkPanel.tsx`,
`deleteLink`). Das ist auch dann so, wenn die Meldung von einer anderen Aktion
stammt.

So nachgestellt: „Neu laden“ für ein KML-Overlay läuft, man öffnet die
Rückfrage „Entfernen“ für ein anderes. „Neu laden“ scheitert, während die
Rückfrage offen ist; die Meldung erscheint hinter dem Dialog. Man bestätigt
das Entfernen, es gelingt, und die Meldung ist weg. Dass das Neuladen
gescheitert ist, erfährt man nie.

Das Verhalten ist gewollt und durch den Test „clears a failure that arrived
while the confirmation was open once the overlay is removed“ gepinnt. AC-3 von
„Karte und Ebenen nachbessern“ lässt es wörtlich zu: Die Entfernung ist die
neuere Aktion, und eine gelungene Aktion zeigt keine Meldung. Der zweite
Review hielt dagegen, dass die Meldung weiter gilt, weil sie ein anderes
Overlay betrifft. Bei der Abnahme am 2026-10-01 offen geblieben.

Vorschlag: Ein erfolgreiches Entfernen oder Löschen lässt die Meldung des
Panels stehen. Dafür braucht AC-3 eine Regel für eine Meldung, die eintrifft,
während eine Rückfrage offen ist.
