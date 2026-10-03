# Criteria: Sicherheitsreview umsetzen

## Problem
Einsatz soll öffentlich im Internet erreichbar sein. Das Sicherheitsreview vom
2. Oktober 2026 hat gezeigt, dass das heute nicht verantwortbar ist:

- Ein angemeldeter Nutzer kann sich zum Admin machen.
- Ein angemeldeter Nutzer kann den Server für alle lahmlegen und jeden Einsatz
  samt ETB endgültig löschen.
- Ein Anonymer kann ohne Login den Speicher erschöpfen und das
  Login-Rate-Limit umgehen.
- Es fehlen Sicherheits-Header und Ressourcengrenzen; Sitzungen und
  Passwörter sind schwächer geschützt, als ein öffentlicher Betrieb braucht;
  die Datenschutzerklärung verspricht eine Löschung, die es nicht gibt.

Stattdessen kann die App öffentlich laufen. Ein Nutzer kann nur, was seine
Rolle erlaubt; weder ein Nutzer noch ein Anonymer kann sie für andere
unbenutzbar machen; Daten gehen nicht verloren und werden nicht länger
gehalten als versprochen.

Einen Vorfall gab es nicht; Grundlage ist der
[Review-Bericht](https://claude.ai/code/artifact/24f5b5db-c202-43cb-9dcc-487029786d6f).

## Acceptance criteria
- **AC-1** Enthält die Bezeichnung eines Kartenzeichens oder die Beschriftung eines Bereichs HTML (etwa `<img src=x onerror=alert(1)>`), steht auf der Lagekarte – in Lageansicht, Ansichtsansicht und Geräteansicht – genau dieser Text; kein Element entsteht, kein Skript läuft.
- **AC-2** Jede Seite wird mit einer Content-Security-Policy ausgeliefert, unter der ein eingeschleustes `<script>` oder Event-Handler-Attribut nicht ausgeführt wird. Darunter funktionieren Lagekarte, KML-Ebenen, Bild-Overlays, Kartensuche, QR-Codes, ETB, Stärke, Nutzerverwaltung und die Geräteansicht mit Standortfreigabe wie heute.
- **AC-3** Keine Seite der App lässt sich in eine fremde Seite einbetten.
- **AC-4** Jede Antwort trägt `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security` mit mindestens einem Jahr und eine `Permissions-Policy`, die Standort nur der App selbst erlaubt; keine trägt `X-Powered-By`; jede Seite ist als `noindex` markiert.
- **AC-5** Jede KML- oder KMZ-Datei bis 20 MB – beim Einbinden einer Datei, einer URL und beim „Neu laden" – wird höchstens doppelt so lange verarbeitet wie eine gewöhnliche KML-Datei gleicher Größe, egal was sie enthält; insbesondere `<href>` gefolgt von 20.000 Leerzeichen ohne `</href>` und 10.000 nicht geschlossene `<NetworkLink>` oder `<Document>`.
- **AC-6** Jedes Einbinden einer KML-Ebene – als Datei oder per URL – und jedes „Neu laden" ruft höchstens 20 Adressen ab (URL, NetworkLinks und Icons zusammen), liest zusammen höchstens 20 MB und bricht eine Antwort ab, sobald sie 20 MB übersteigt, auch ohne `Content-Length`. Übersteigt die Datei oder die URL selbst 20 MB, erscheint „Die KML-Datei ist größer als 20 MB."; NetworkLinks und Icons jenseits der Grenzen werden übersprungen wie ein toter Verweis.
- **AC-7** Kein Abruf beim KML-Import – URL, NetworkLink, Icon – erreicht eine Adresse außerhalb des öffentlichen Unicast-Adressraums, auch wenn ein DNS-Name zwischen Prüfung und Abruf auf eine andere Adresse zeigt. Betrifft es die URL selbst, erscheint „Diese Adresse ist nicht erlaubt."; ein NetworkLink oder Icon wird übersprungen wie ein toter Verweis.
- **AC-8** Nach dem Einbinden oder „Neu laden" einer KML-Ebene lädt kein Browser, der sie zeigt, etwas von einem anderen Host als der App selbst und MapTiler. Icons von http(s)-Adressen sind eingebettet; ein Icon, das sich nicht laden lässt, kein Bild ist oder größer als 256 KB ist, erscheint als Standard-Marker.
- **AC-9** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch Google „Meine Karten" mit NetworkLink und eigenen Icons. Ausnahme: KML-Ebenen, die vor dieser Änderung eingebunden wurden, zeigen Icons von anderen Hosts als Standard-Marker, bis sie neu geladen (URL) oder neu eingebunden (Datei) werden.
- **AC-10** „Einsatz löschen" sehen nur Admins, und nur bei einem abgeschlossenen Einsatz. Ruft ein Nicht-Admin die Löschung trotzdem auf, oder wird ein laufender Einsatz gelöscht, ist danach nichts gelöscht.
- **AC-11** Hat ein Kartenzeichen einen Gerätelink, bietet sein Panel „Gerätelink entfernen" mit Rückfrage an. Nach dem Bestätigen bietet das Panel „Gerätelink erzeugen" an, ein offenes Gerät zeigt ohne Neuladen „Zugang beendet", der alte Link führt zu „Zugang beendet", und das Kartenzeichen ist wieder manuell verortet.
- **AC-12** „Abschließen" fragt nach, bevor der Einsatz abgeschlossen wird; die Rückfrage sagt, dass dabei alle Gerätelinks und Ansichtslinks gelöscht werden. Nach dem Abschließen führen alle bisherigen Links zu „Zugang beendet", auch nach „Wieder öffnen"; die Panels bieten dann an, neue zu erzeugen. Kartenzeichen, deren Gerätelink so gelöscht wurde, sind wieder manuell verortet.
- **AC-13** Eine ausgeblendete KML-Ebene oder ein ausgeblendetes Bild-Overlay ist in Ansichts- und Geräteansicht nicht zu sehen und in den Daten, die der Browser dort bekommt, nicht enthalten; ihre Bildadresse unter `/view/…` bzw. `/device/…` liefert 404. Eingeblendet erscheint sie dort ohne Neuladen.
- **AC-14** Ohne gültige Sitzung nimmt die App keinen Request-Body über 1 MB an, eine Standortmeldung keinen über 1 KB – auch wenn der Body ohne `Content-Length` gesendet wird. Angemeldet lassen sich KML-Dateien und Bild-Overlays bis 20 MB weiter einbinden, hochladen und ersetzen.
- **AC-15** Eine Standortmeldung, die weniger als 5 Sekunden nach der zuletzt gespeicherten desselben Gerätelinks kommt, wird weder gespeichert noch an andere gemeldet; das Gerät zeigt deswegen keinen Fehler.
- **AC-16** Ändert sich ein Einsatz viele Male in kurzer Zeit, lädt jeder Client höchstens zweimal pro Sekunde neu, und die letzte Änderung ist spätestens eine Sekunde nach ihr bei allen zu sehen.
- **AC-17** Je Nutzer und je Gerätelink bestehen höchstens 10 Live-Verbindungen gleichzeitig, je Ansichtslink höchstens 50; weitere werden abgelehnt. Ein abgelehnter Browser zeigt „Verbindung getrennt" und versucht es weiter.
- **AC-18** Nach Abmelden, Ablauf oder Ende der Sitzung, Löschen des Nutzers, Löschen eines Ansichtslinks, Entfernen oder Neugenerieren eines Gerätelinks und Abschließen oder Löschen des Einsatzes endet jede betroffene Live-Verbindung innerhalb von 30 Sekunden.
- **AC-19** Die App fragt Photon höchstens einmal pro Sekunde. Suchen über Ansichts- und Gerätelinks zusammen höchstens einmal in 3 Sekunden, sodass den angemeldeten Nutzern mindestens zwei Drittel bleiben. Eine Suchanfrage über 200 Zeichen ergibt keine Treffer, ohne Photon zu fragen.
- **AC-20** Beim Ersetzen der Datei eines Bild-Overlays landet die neue Datei im Verzeichnis des Einsatzes, zu dem das Overlay gehört, egal welche Einsatz-ID der Aufruf mitliefert; außerhalb des Upload-Verzeichnisses wird nie etwas angelegt oder geschrieben.
- **AC-21** Eine PDF mit beliebig großer erster Seite und einem Seitenverhältnis bis 4000:1 wird mit höchstens 4000 px an der längeren Kante umgewandelt; eine PDF mit extremerem Seitenverhältnis wird mit „Die PDF-Datei konnte nicht umgewandelt werden." abgelehnt; ein PNG über 100 Megapixel wird mit „Das Bild konnte nicht verarbeitet werden." abgelehnt. In keinem Fall stürzt die App ab.
- **AC-22** Jede Server Action lehnt falsche Typen, IDs, die keine UUID sind, unbekannte Bereichsformen (alles außer Polygon, Linie, Kreis) und Strings über ihrer Höchstlänge mit einer Meldung ab statt mit einem Serverfehler, und speichert dann nichts. Höchstlängen: Namen, Bezeichnungen, Beschriftungen, Von/An und Weg 200 Zeichen; KML-URL 2.000; Einsatzbeschreibung und Notizen 2.000; ETB-Text 10.000; Bereichsfarbe genau `#` und sechs Hex-Ziffern. Ein Polygon hat mindestens 3 Punkte, eine Linie mindestens 2.
- **AC-23** Ändern oder Löschen eines Kartenzeichens, Bereichs, einer KML-Ebene, eines Bild-Overlays oder Ansichtslinks unter der ID eines Einsatzes, zu dem es nicht gehört, ändert nichts und meldet einen Fehler.
- **AC-24** Von einer IP-Adresse aus – bei IPv6 einem /64 – werden in 5 Minuten höchstens 5 Fehlversuche je Nutzername und 20 insgesamt geprüft, auch bei gleichzeitigen Anfragen; jeder weitere Versuch bekommt „Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.".
- **AC-25** Die Prüfung des aktuellen Passworts beim Passwortwechsel unterliegt demselben Limit.
- **AC-26** Beim Erst-Admin, beim Anlegen, Zurücksetzen und Wechseln wird ein Passwort mit einer Meldung abgelehnt, wenn es dem Nutzernamen ohne Rücksicht auf Groß-/Kleinschreibung gleicht oder länger als 72 Byte ist.
- **AC-27** `.env.example` enthält kein Admin-Passwort. Gibt es schon Nutzer, startet der Container auch ohne `ADMIN_USERNAME` und `ADMIN_PASSWORD`.
- **AC-28** Ein Nutzername, der sich von einem vorhandenen nur in Groß-/Kleinschreibung unterscheidet, lässt sich nicht anlegen: „Dieser Nutzername ist bereits vergeben.".
- **AC-29** Eine Sitzung endet frühestens 24 Stunden und spätestens 24 Stunden und 5 Minuten nach der letzten Nutzung, spätestens aber 30 Tage nach der Anmeldung. Nutzung ist, was der Nutzer selbst tut: eine Seite laden oder neu laden und jede Aktion, auch ein Upload; ein Link-Klick innerhalb der App, die Live-Verbindung und das automatische Neuladen nach Änderungen zählen nicht.
- **AC-30** Die Kontoseite bietet „Überall abmelden" mit der Rückfrage „Alle anderen Sitzungen beenden?". Danach sind alle anderen Sitzungen des Nutzers beendet, die eigene bleibt, und die Seite zeigt „Alle anderen Sitzungen wurden beendet.".
- **AC-31** Meldet man sich in einem Browser neu an, ist die vorherige Sitzung dieses Browsers beendet.
- **AC-32** Aus dem Inhalt der Datenbank lässt sich keine gültige Sitzung gewinnen.
- **AC-33** Das Sitzungs-Cookie heißt in Produktion mit dem Präfix `__Host-`.
- **AC-34** Im Container läuft die App nicht als root.
- **AC-37** Der Produktions-Container hat eine Speicher- und eine Prozessgrenze; überschreitet die App die Speichergrenze, startet nur ihr Container neu; erreicht sie die Prozessgrenze, scheitert nur in ihrem Container das Starten weiterer Prozesse. In beiden Fällen laufen Host und andere Dienste weiter.
- **AC-35** Ohne `MAPTILER_API_KEY` startet die App in Produktion nicht und sagt im Log, warum; in Produktion lädt kein Browser Kacheln von `tile.openstreetmap.org`. In der Entwicklung bleibt OSM der Ersatz.
- **AC-36** Die Datenschutzerklärung beschreibt, dass ein Einsatz mit ETB, Kartenobjekten und Uploads aufbewahrt wird, bis ein Admin ihn nach dem Abschließen löscht; die Laufzeit von Sitzungen (24 h ohne Nutzung, höchstens 30 Tage); den serverseitigen Abruf von KML-Adressen und -Icons; und dass beim Abschließen alle Geräte- und Ansichtslinks gelöscht werden. Sie nennt genau die Dienste, die ein Browser kontaktiert, und beschreibt serverseitige Abrufe (Photon, KML-Adressen und -Icons) als solche.

## Agreed design
Die App schützt sich selbst und verlässt sich nicht auf den Reverse-Proxy:
Header, CSP mit Nonce und Body-Grenzen setzt sie selbst. Das flache
Vertrauensmodell bleibt; Admin ist die Grenze für das Löschen eines
Einsatzes. Ein abgeschlossener Einsatz bleibt bearbeitbar, verliert aber alle
Links. Daten bleiben, bis ein Admin den abgeschlossenen Einsatz löscht; die
Datenschutzerklärung sagt das so. KML-Icons bettet der Server beim Import ein.
Session-Tokens werden gehasht gespeichert, Link-Tokens nicht. Das Login-Limit
bleibt je IP.

**Agreed; build to this, do not redesign.**

## Nudges
- Tooltips bekommen einen DOM-Knoten mit `textContent`, wie `kmlPopupContent` in `src/map/kml-layer.ts`.
- Die KML-Regexes in `src/kml/kmz.ts` durch `indexOf`/`lastIndexOf` ersetzen, statt sie nur umzuformulieren.
- CSP mit Nonce in einer neuen `src/proxy.ts` nach `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`; `style-src` mit `'unsafe-inline'` für Mantine und Leaflet. Die übrigen Header statisch in `next.config.ts`.
- Uploads (KML-Datei, Bild-Overlay hinzufügen und ersetzen) laufen über eigene Route Handler, die den Body als Stream lesen und bei 20 MB abbrechen; `serverActions.bodySizeLimit` geht zurück auf 1 MB. `src/proxy.ts` läuft nicht für Server-Action-Anfragen und Route Handler (Matcher), weil der Proxy jeden Body puffert und bei `proxyClientMaxBodySize` abschneidet.
- KML-Icons über denselben SSRF-geprüften Abruf in `src/server/kml/kml-fetch.ts` laden und wie in `inlineKmzAssets` als `data:`-URL einbetten. Die geprüfte IP auch für die Verbindung verwenden (undici-`Agent` mit eigenem `connect.lookup`).
- Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.
- Session-Tokens als SHA-256 speichern; die Migration beendet alle bestehenden Sitzungen.
- `last_seen_at` höchstens alle 5 Minuten schreiben.
- Standort-Drosselung in der Bedingung des bestehenden UPDATE in `reportPosition`.
- `publishOperationChanged` je Einsatz entprellen, statt in jedem Client.
- Ein geöffneter Live-Stream schließt nach höchstens 1 Stunde; EventSource verbindet neu.
- Geocoding: das gemeinsame `RateGate` (1 s) in `src/server/geocoder/geocode-service.ts` bleibt; die Token-Routen gehen zusätzlich durch ein eigenes `RateGate` (3 s).
- `UBIQUITOUS_LANGUAGE.md` anpassen: Gerätelinks sind entfernbar, und Abschließen löscht Geräte- und Ansichtslinks.
- Ein eindeutiger Index auf `lower(username)`; die Migration bricht mit einer klaren Meldung ab, falls es schon Kollisionen gibt.
- `USER node` im `Dockerfile`, `data` in `.dockerignore`, `exec next start` statt `npm run start` in `docker-entrypoint.sh`; in `docker-compose.prod.yml` `init: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `mem_limit`, `pids_limit` und Log-Rotation.

## Out of scope
- Alles in `../drk-barmbek`: Header und Body-Grenzen im Caddy, Backup des `uploads`-Volumes, Backup auf einen anderen Rechner, das committete `database/.env`. Das wird eine eigene Änderung dort.
- Client-IP hinter Caddy ist korrekt; dass andere Container am `database_network` Port 3000 direkt erreichen, gehört zu `../drk-barmbek`.
- Backups: das tägliche DB-Backup läuft in `../drk-barmbek`; ein Dump vor dem Deploy gehört dort dazu.
- Rechte je Einsatz; das flache Vertrauensmodell bleibt.
- Konten sperren.
- Automatische Löschfristen.
- Ablaufdatum für Links und eine Anzeige, wann ein Link zuletzt benutzt wurde.
- Gehashte Gerätelink- und Ansichtslink-Tokens.
- Ein Login-Limit je Nutzername über alle IPs hinweg, CAPTCHA.
- Ein abgeschlossener Einsatz bleibt bearbeitbar; Abschließen sperrt nichts außer den Links.

## Ruled out
- **Caddy und Backup über `docker-compose.prod.yml` dieses Repos ausrollen** – greift in einen Host, den andere Dienste teilen; gehört nach `../drk-barmbek`.
- **Reverse-Proxy als Schutzschicht für die App** – die App muss hinter jedem Proxy sicher sein.
- **Löschen archiviert nur** – ein Archiv mit Wiederherstellen ist mehr, als „Einfachheit vor Funktionsfülle" rechtfertigt; Admin als Grenze reicht.
- **Keine manuelle Löschung, nur Fristen** – ein Test-Einsatz ließe sich nicht sofort löschen; die Aufbewahrungsdauer eines ETB hängt von der Organisation ab, nicht von der App.
- **Abgeschlossener Einsatz schreibgeschützt (ganz oder nur ETB)** – Nachträge nach dem Abschließen sollen möglich bleiben.
- **Links mit Ablaufdatum** – Einstellungen und Verlängern im laufenden Einsatz; Löschen beim Abschließen deckt den realistischen Fall.
- **Löschfrist oder Anonymisierung nach N Monaten** – siehe oben; Freitext lässt sich nicht verlässlich anonymisieren.
- **KML-Icons weiter direkt laden und nur in der Datenschutzerklärung nennen** – verrät die IP jedes Betrachters und verhindert eine strenge CSP.
- **Nur eingebettete KML-Icons zulassen** – „Meine Karten"-Ebenen verlören ihre Icons.
- **Gerätelinks und Ansichtslinks gehasht oder verschlüsselt speichern** – nur einmal anzeigbar bzw. ein neues Geheimnis zu verwalten; ein DB-Dump enthält ohnehin alles, was ein Ansichtslink zeigt.
- **Feste Sitzungsdauer von 24 h** – meldet mitten im Einsatz ab.
- **Nur „Überall abmelden" ohne Leerlauf-Timeout** – eine vergessene Sitzung auf einem geteilten Gerät bliebe 30 Tage gültig.
- **CSP ohne Skript-Regel** – hätte die XSS aus AC-1 nicht abgefangen.
- **Konten sperren** – Passwort zurücksetzen leistet dasselbe.
- **Login-Wartezeit je Nutzername** – damit kann jeder jeden aussperren.
- **Wartezeit je Nutzername nur für unbekannte Geräte** – Signaturschlüssel und Geräte-Cookie für wenig Gewinn neben 12 Zeichen und einer Liste häufiger Passwörter.
- **Kontosperre nach N Fehlversuchen, CAPTCHA** – Aussperren durch Angreifer bzw. ein externer Dienst.
- **„Überall abmelden" beendet auch die eigene Sitzung** – unnötig, ein Passwortwechsel behält sie auch.
- **Ausgeblendete Ebenen als reine Anzeige dokumentieren** – wer vor dem Teilen ausblendet, erwartet, dass sie für Außenstehende weg ist.
- **Icons bestehender KML-Ebenen beim ersten Start einbetten** – ein einmaliger Lauf mit Netzzugriff für wenige Ebenen; neu laden bzw. neu einbinden reicht.
- **CSP erlaubt Bilder von jedem `https:`-Host, solange alte Ebenen existieren** – hebt die strenge Bildregel auf unbestimmte Zeit auf.
- **Jede Anfrage zählt als Nutzung, auch automatisches Neuladen** – ein vergessener Tab liefe nie ab.
- **Nur Anfragen eines sichtbaren Tabs zählen** – ein vergessener sichtbarer Tab liefe nie ab, und der Browser müsste Sichtbarkeit melden.
- **10 Live-Verbindungen auch je Ansichtslink** – ein geteilter Link im Stabsraum bliebe ab dem elften Betrachter stehen.
- **Nur eine globale Grenze für Live-Verbindungen** – ein einziger Link könnte sie aufbrauchen.
- **Getrennte Photon-Grenzen von je einer Anfrage pro Sekunde** – verdoppelt die Last auf einem freien, geteilten Dienst.
- **Dump vor dem Deploy in `bin/deploy-prod` dieses Repos** – braucht die Datenbank-Einrichtung aus `../drk-barmbek`.
- **Link-Klicks innerhalb der App als Nutzung melden** – eine zusätzliche Komponente und Anfrage je Navigation für einen unrealistischen Fall.
- **`__Host-`-Präfix auch in der Entwicklung** – Anmelden vom Handy im lokalen Netz über http ginge nicht mehr.
- **Neustart auch an der Prozessgrenze per Healthcheck** – die Prozessgrenze ist nur eine Sicherung; ein Healthcheck bräuchte Feinabstimmung gegen langsame Uploads.
- **PDFs mit extremem Seitenverhältnis trotzdem umwandeln** – kein realer Lageplan hat diese Form.
- **Photon aus der Datenschutzerklärung streichen** – Suchbegriffe gehen weiter an Photon; die Erklärung wäre unvollständig.
- **Fehlermeldung für „Wieder öffnen"** – scheitert nur bei gefälschten Aufrufen.
- **Liste häufiger Passwörter** – bei 12 Zeichen Mindestlänge fast wirkungslos (`password1234` ging durch); bei der Abnahme gestrichen.
