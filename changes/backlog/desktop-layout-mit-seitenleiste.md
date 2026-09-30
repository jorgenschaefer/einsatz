# Desktop-Layout mit Seitenleiste

Rückmeldung aus dem Einsatz (u. a. Cyclassics 2026). Die Lösung steht fest
und wird als Ganzes umgesetzt; offene Detailfragen entscheidet die Umsetzung
im Sinne von „Einfachheit vor Funktionsfülle".

Am Desktop füllt die Lagekarte immer den Bildschirm. Rechts sitzt eine
Seitenleiste in Smartphone-Breite, im Grunde der Smartphone-Bildschirm: oben
zwei Knöpfe **ETB** und **Stärke**, darunter die gewählte Ansicht. Die
Hauptansichtsleiste links (`MainViewBar`) entfällt am Desktop. Die Karte ist
dort keine umschaltbare Ansicht mehr.

- Beide Ansichten der Seitenleiste bleiben beim Umschalten eingehängt,
  angefangene Eingaben bleiben also erhalten.
- Zeigt die Seitenleiste „Stärke", zählt der ETB-Knopf neue Einträge wie
  heute die Hauptansichtsleiste.
- Am Smartphone bleibt alles wie es ist: Leiste unten mit Lagekarte, ETB und
  Stärke.
