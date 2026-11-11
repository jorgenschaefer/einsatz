---
effort: S
value: L
---

# ETB exportieren oder drucken

Idee aus einer alten Notizliste („Einsatz herunterladen“). Hier steht nur das
Problem, noch keine Lösung.

Nach einem Einsatz muss das Einsatztagebuch in die Akte. Heute lässt es sich
weder herunterladen noch drucken: Es gibt keinen Export, und kein Stylesheet
hat `@media print`. Es bleiben nur Screenshots oder Abschreiben.

Die Daten liegen schon vollständig vor: `listEntries` in
`src/server/journal/journal.ts:173` lädt die Einträge samt Fassungen,
angezeigt werden sie in `src/journal/JournalPanel.tsx`. Was in die Akte
geht, muss die Beweiskraft des ETB behalten. Korrekturen und Annullierungen
müssen also als Historie sichtbar bleiben, mit Urheber und Zeitstempel.
