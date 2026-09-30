---
effort: S
complexity: S
utility: S
---

# Fokus nach einer Rückfrage liegt auf dem Schließen-X

Seit alle unwiderruflichen Aktionen über das gemeinsame `ConfirmationModal` bestätigt werden, liegen einige Rückfragen über einem anderen Dialog: Kartenzeichen löschen und Gerätelink neu generieren über dem Kartenzeichen-Dialog, Bereich löschen über dem Bereich-Dialog und Ansichtslink löschen über „Ansichtslinks teilen“. Wird die Rückfrage geschlossen, egal ob durch Abbrechen oder nach Erfolg, landet der Tastaturfokus auf dem Schließen-X des darunterliegenden Dialogs. Er landet nicht auf dem Knopf, der die Rückfrage geöffnet hat. Drückt man dann Enter, schließt sich der Kartenzeichen- oder Bereich-Dialog, und noch nicht gespeicherte Eingaben gehen ohne Nachfrage verloren. Das widerspricht der Absicht, dass nach dem Abbrechen „alles wie vorher“ ist (AC-6 der Änderung „Unwiderrufliche Aktionen einheitlich bestätigen“). Es betrifft allerdings nur die Bedienung per Tastatur. Außerdem liegt der Fokus schon beim Öffnen einer Rückfrage auf ihrem eigenen Schließen-X und nicht auf „Abbrechen“. Beides ist Mantines Standardverhalten. Die Tickets 02, 03, 04 und 05 haben es notiert, bei der Abnahme am 2026-09-30 war der Fokusring nach „Neu generieren“ zu sehen. Das `KmlPanel` zeigt, wie es gehen kann: Seine Rückfrage ist von Anfang an gemountet, und der Fokus kehrt deshalb richtig auf „Entfernen“ zurück.
