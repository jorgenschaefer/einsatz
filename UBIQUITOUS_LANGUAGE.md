# Ubiquitous Language

Die Domänensprache ist Deutsch. Code-Bezeichner bleiben Englisch; bei nicht-englischen Begriffen steht der englische Bezeichner in `code-font`-Klammern hinter dem fett gesetzten Begriff.

## Terminology

- **Bereich** (`Area`) – eine farbig markierte Geometrie mit Deckkraft und Beschriftung auf der Lagekarte in einer von drei Formen: **Polygon** (Fläche, z. B. Einsatzabschnitt oder Gefahrenzone), **Linie** (Linienzug, z. B. Absperrung oder Route) oder **Kreis** (Mittelpunkt + Radius, z. B. Gefahrenradius). Kein taktisches Zeichen, sondern ein eigenständiges Kartenobjekt.
- **Bild-Overlay** (`ImageOverlay`) – ein als Kartenebene eingepasstes Bild (aus PDF oder PNG), typischerweise ein Lageplan. Wird interaktiv per Auge über Verschieben, Skalieren und Drehen platziert (nicht geo-exakt referenziert).
- **Bezeichnung** – die frei wählbare Beschriftung (`text`) eines **Kartenzeichens**, angezeigt als Label neben dem Zeichen; oft ein Funkrufname (z. B. „Rotkreuz Musterstadt 83/1"), aber jeder Name ist möglich. Optional.
- **Einheit** – **rein sprachlicher Begriff**, kein eigener Objekttyp: ein **Kartenzeichen**, das eine **Bezeichnung** (meist ein Funkrufname) und/oder einen **Gerätelink** trägt, also eine im Einsatz eingesetzte Kraft darstellt. Das System unterscheidet an keiner Stelle formal zwischen „Einheit" und sonstigem Kartenzeichen; die Kräfteortung hängt allein am Vorhandensein eines Gerätelinks.
- **Einsatz** (`Operation`) – die zentrale Klammer des Werkzeugs: eine Lage mit eigener **Lagekarte**, eigenem **Einsatztagebuch** und den dabei eingesetzten Kräften. Aggregat-Wurzel; alle Kartenobjekte und Tagebuch-Einträge gehören zu genau einem Einsatz.
- **Einsatztagebuch** (`Journal`, kurz **ETB**) – die chronologische, fortlaufend nummerierte Dokumentation wichtiger Ereignisse eines **Einsatzes**. Einträge tragen einen nicht editierbaren Zeitstempel; Korrekturen bleiben als durchgestrichene Historie sichtbar.
- **ETB-Eintrag** (`JournalEntry`) – eine dokumentierte Zeile im **Einsatztagebuch** mit fortlaufender Nummer, nicht editierbarem Zeitstempel, Freitext, einem **Typ**, einem **Urheber** und einer sichtbaren Änderungshistorie.
- **Führungskraft** – die Person, die die Lage führt und das Werkzeug bedient. Im System als **Nutzer** mit voller Bearbeitungsberechtigung abgebildet.
- **Gerätelink** (`DeviceLink`) – ein geheimer Link (mit QR-Code) pro **Kartenzeichen**, über den ein mobiles Endgerät ohne Login den Standort meldet und die **Lagekarte** ansieht. Neu generierbar, wodurch ein alter Link ungültig wird.
- **Kartenobjekt** – Oberbegriff für alles, was auf der **Lagekarte** liegt: **Kartenzeichen**, **Bereiche**, **KML-** und **Bild-Overlays**.
- **Kartenzeichen** (`MapSymbol`) – ein auf der **Lagekarte** platziertes **Taktisches Zeichen**: eine DV-102-Komposition (siehe dort) plus Position, optionaler **Bezeichnung** und optionalem **Gerätelink**. Vereint die früher getrennten Begriffe „Einheit" und „taktisches Zeichen (Objekt)" zu einem einzigen Objekttyp. Ohne Gerätelink immer manuell verortet; mit meldendem Gerätelink live verortet.
- **Kräfteortung** – das Melden und Anzeigen der Live-Standorte von Kräften über deren mobile Endgeräte (Gerätelink).
- **Lage** – die Gesamtheit der Situation, die ein **Einsatz** abbildet. Im Sprachgebrauch oft gleichbedeutend mit dem sichtbaren Zustand der **Lagekarte**.
- **Lagekarte** (`SituationMap`) – die Karte eines **Einsatzes** mit allen Kartenobjekten (**Kartenzeichen**, **Bereiche**, Overlays).
- **Organisation** (`Organization`) – die Zugehörigkeit eines **Kartenzeichens**; bestimmt standardkonform die Feldfarbe des taktischen Zeichens. Es gibt genau die **8 festen DV-102-Kategorien** der Bibliothek `taktische-zeichen-core`: Feuerwehr (rot), THW (blau), Polizei (grün), Bundeswehr (braun), Führung (gelb), Gefahrenabwehr (orange), **Hilfsorganisationen** (weiß), Zivile Einheiten (grau). DRK/ASB/JUH/MHD/DLRG sind standardkonform **keine eigenen Organisationen**, sondern alle „Hilfsorganisationen" (weiß); eine feinere farbliche Unterscheidung gibt es bewusst nicht.
- **Taktisches Zeichen** (`TacticalSymbol`) – ein standardisiertes Symbol nach DV 102, kompositorisch erzeugt mit der Bibliothek `taktische-zeichen-core` aus den Achsen Grundzeichen, Organisation, Fachaufgabe, Größenordnung (Einheit), Verwaltungsstufe, Funktion, Symbol und Text. Als *platzierte Instanz* auf der Karte heißt es **Kartenzeichen**.
- **Urheber** (`author`) – der Nutzername des Nutzers, der einen **ETB-Eintrag** bzw. eine Korrektur-Fassung angelegt hat. Wird als **Momentaufnahme** gespeichert (denormalisiert, kein Verweis auf das Konto), damit ein gelöschter Nutzer die Beweiskraft des Tagebuchs nicht bricht. Automatische Einträge tragen keinen menschlichen Urheber. Nur im ETB geführt, nicht an Kartenobjekten.

## Aliases to avoid

- „taktisches Zeichen (Objekt)" / „taktisches Element" als eigener Objekttyp – verwende **Kartenzeichen**. Es gibt keinen von der Einheit getrennten Objekttyp mehr.
- „eigen/fremd" – **nicht mehr modelliert**. Da die Feldfarbe rein den 8 DV-102-Kategorien folgt und alle Hilfsorganisationen identisch weiß sind, gibt es keine eigen/fremd-Unterscheidung und keine Sonderrolle für DRK.
- „Quelle" als eigenes Feld am ETB-Eintrag – verwende **Typ** (`manuell` bzw. je automatischer Anlass ein eigener Wert). Herkunft und Kategorie sind zu einem Feld verschmolzen.
- „Ereignis" für Tagebuch-Einträge – verwende **ETB-Eintrag** für die dokumentierte Zeile und **Domänenereignis** (`Domain Event`) für technische Ereignisse im System.
