---
effort: XS
utility: S
---

# ⋮-Menü auf schmalen Bildschirmen

Bei 320 px Breite lässt sich das ⋮-Menü im Kopf der Lageansicht nicht
bedienen. Gesehen am 25.10.2026 bei einer Prüfung der Kartenpanels-Änderung
(Stand `7e83571`, auf `main` unverändert), Telefon-Ansicht 320x640 mit Touch.

- Das Menü öffnet bei left:308px mit einer Breite von 221px (max-content),
  reicht also von x 308 bis 529.
- Die Seite wird dadurch 529px breit (innerWidth und scrollWidth 529, der
  sichtbare Bereich bleibt 320).
- Vom Menü ist nur ein Streifen von etwa 12px am rechten Rand zu sehen. Die
  Einträge liegen bei x=313 und lassen sich nicht antippen.
- AKTIV-Badge und ⋮ rutschen auf x 423 bis 517, die untere Leiste auf
  y=1003, beides außerhalb des Bildschirms.
- Nach Escape ist die Seite wieder 320 breit.

Bei 360 und 390 px Breite erscheint das Menü richtig.

Das Menü ist `<Menu position="bottom-end">` in
`src/map/LageansichtShell.tsx:91`, mit den Einträgen Teilen,
Standard-Ausschnitt festlegen und Zurück zu Einsätze.
