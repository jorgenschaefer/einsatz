---
effort: XS
complexity: XS
utility: S
---

# Langer KML-Name verschiebt das Ebenen-Panel

Im Ebenen-Panel der Lagekarte steht jedes eingebundene KML-Overlay als Zeile mit seinem Namen und dem Knopf „Entfernen“ (`src/map/KmlPanel.tsx`). Der Name ist bei einer hochgeladenen Datei der Dateiname und bricht in der Zeile nicht um. Ein langer Name ohne Leerzeichen, etwa `EinsatzabschnittEinsatzabschnitt….kml` mit 80 Zeichen, macht die Zeile breiter als das Panel. Das Panel scrollt dann seitlich, sodass die übrigen Bedienelemente (Datei-Upload, KML-URL, Bild-Overlays) links abgeschnitten sind. Das passiert bei 1280×800 und bei 390×844. Am Handy liegt „Entfernen“ bei x≈826 von 390 und ist nur durch seitliches Wischen erreichbar. Bei der Abnahme von „Unwiderrufliche Aktionen einheitlich bestätigen“ (2026-09-30) ist das im Browser aufgefallen, Ticket 04 hatte es schon notiert. Dort war es ausgeklammert, weil „Lage und Auffälligkeit der Lösch-Knöpfe“ nicht zum Umfang gehörte. Hier geht es aber nicht um die Lage des Knopfs. Das Problem ist, dass der Knopf und das Panel wegen eines Überlaufs nicht erreichbar sind. Die Kontenliste und die Einsatzübersicht haben dasselbe Problem schon mit `overflowWrap: "anywhere"` und `miw={0}` gelöst (Tickets 06 und 07). Die Zeile im Ebenen-Panel braucht vermutlich dasselbe.
