# Token-Routen für Geräte- und Ansichtslink

Vorschlag aus dem Vereinfachungs-Durchgang vom 2026-09-28 (Commit `602bf31`).
Er ändert Verhalten, Oberfläche oder Tests spürbar und braucht deshalb eine
Entscheidung.

**Heute.** `events/route.ts` und `geocode/route.ts` gibt es je unter
`/device/[token]` und `/view/[token]`; sie unterscheiden sich nur in der
Zugangsprüfung (`resolveDeviceAccess` bzw. `resolveViewAccess`).

**Vorschlag.** Je Route einen gemeinsamen Handler, dem die Zugangsprüfung
übergeben wird.

**Bringt.** Vier fast gleiche Dateien werden zu zwei Handlern plus vier
Einzeilern.

**Kostet.** Eine Indirektion mehr; die Routen sind heute je rund 15 Zeilen und
gut lesbar. Geringer Nutzen – nur umsetzen, wenn ohnehin an den Routen
gearbeitet wird.
