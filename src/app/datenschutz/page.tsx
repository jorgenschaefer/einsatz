import {
  Anchor,
  Container,
  List,
  ListItem,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Lageführung",
};

export default function DatenschutzPage() {
  return (
    <Container size="sm" py="lg">
      <Stack gap="lg">
        <Title order={1}>Datenschutzerklärung</Title>
        <Text>
          Diese Datenschutzerklärung informiert über die Verarbeitung
          personenbezogener Daten bei der Nutzung der Anwendung „Lageführung"
          (nachfolgend „die Anwendung"), einem Werkzeug zur schlanken
          Lageführung im Katastrophenschutz.
        </Text>
        <Text fw={500}>
          Grundsatz: Die Anwendung ist für taktische, lagebezogene Angaben ohne
          Personenbezug bestimmt. Personenbezogene Daten Dritter sollen nicht in
          die Anwendung eingegeben werden – insbesondere keine Gesundheits- oder
          anderen besonderen Daten nach Art. 9 DSGVO. Unvermeidbar verarbeitet
          werden im Wesentlichen nur Daten der angemeldeten Nutzenden selbst
          (Anmeldedaten, Protokoll- und Urheberangaben, freiwillige
          Standortmeldung), die nachfolgend beschrieben sind.
        </Text>

        <Stack gap="xs">
          <Title order={2} size="h4">
            1. Verantwortlicher
          </Title>
          <Text>
            Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO)
            ist:
          </Text>
          <Text>
            Jorgen Schäfer
            <br />
            Sonderburger Str. 1
            <br />
            22305 Hamburg
            <br />
            E-Mail:{" "}
            <Anchor href="mailto:Jorgen.Schaefer@gmail.com">
              Jorgen.Schaefer@gmail.com
            </Anchor>
          </Text>
          <Text>
            Ein Datenschutzbeauftragter ist nicht bestellt;
            datenschutzrechtliche Anfragen richten Sie bitte an den
            Verantwortlichen. Weitere Angaben finden Sie im{" "}
            <Anchor href="/impressum">Impressum</Anchor>.
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            2. Ihre Rechte
          </Title>
          <Text>
            Sie haben im Rahmen der gesetzlichen Vorgaben jederzeit das Recht
            auf:
          </Text>
          <List spacing="xs">
            <ListItem>Auskunft über Ihre Daten (Art. 15 DSGVO)</ListItem>
            <ListItem>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</ListItem>
            <ListItem>Löschung (Art. 17 DSGVO)</ListItem>
            <ListItem>Einschränkung der Verarbeitung (Art. 18 DSGVO)</ListItem>
            <ListItem>Datenübertragbarkeit (Art. 20 DSGVO)</ListItem>
            <ListItem>
              Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)
            </ListItem>
          </List>
          <Text>
            Zudem haben Sie das Recht, sich bei einer
            Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist die
            Aufsichtsbehörde des Bundeslandes des Verantwortlichen – für Hamburg
            der Hamburgische Beauftragte für Datenschutz und
            Informationsfreiheit (HmbBfDI).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            3. Hosting
          </Title>
          <Text>
            Die Anwendung wird bei einem externen Dienstleister betrieben, der
            die Server-Infrastruktur bereitstellt:
          </Text>
          <Text>IONOS SE, Deutschland</Text>
          <Text>
            Der Dienstleister verarbeitet die anfallenden Daten in unserem
            Auftrag auf Grundlage eines Vertrags zur Auftragsverarbeitung (Art.
            28 DSGVO). Technisch bedingt können auf Ebene des Servers bzw. des
            vorgelagerten Reverse-Proxy (Caddy) Protokolldateien anfallen (etwa
            mit IP-Adressen und Zeitpunkt des Zugriffs), die dem sicheren und
            stabilen Betrieb dienen. Rechtsgrundlage ist unser berechtigtes
            Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            4. Zugriffsdaten und Schutz vor Missbrauch
          </Title>
          <Text>
            Bei der Anmeldung und beim Ändern des Passworts wird Ihre IP-Adresse
            ausschließlich vorübergehend und ausschließlich im Arbeitsspeicher
            verwendet, um wiederholte fehlgeschlagene Versuche zu begrenzen
            (Schutz vor automatisierten Angriffen). Eine dauerhafte Speicherung
            der IP-Adresse durch die Anwendung findet nicht statt.
            Rechtsgrundlage ist unser berechtigtes Interesse an der
            IT-Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            5. Nutzerkonto und Anmeldung
          </Title>
          <Text>
            Zur Nutzung der geschützten Bereiche ist eine Anmeldung mit
            Nutzername und Passwort erforderlich. Gespeichert werden Nutzername,
            das Passwort ausschließlich als kryptografischer Hash (bcrypt, im
            Klartext nicht rekonstruierbar) sowie die zugewiesene Rolle. Nach
            erfolgreicher Anmeldung wird ein technisch notwendiges Cookie
            (Bezeichnung „__Host-einsatz_session") gesetzt, das ausschließlich
            der Aufrechterhaltung der Sitzung dient. Es ist als „httpOnly"
            gesetzt und nur über HTTPS gültig. Da dieses Cookie für den Betrieb
            unbedingt erforderlich ist, bedarf es keiner Einwilligung (§ 25 Abs.
            2 TDDDG). Rechtsgrundlage der Kontoverarbeitung ist die
            Bereitstellung des Dienstes bzw. unser berechtigtes Interesse (Art.
            6 Abs. 1 lit. b und f DSGVO).
          </Text>
          <Text>
            Eine Sitzung endet, wenn sie 24 Stunden lang nicht genutzt wurde,
            spätestens aber 30 Tage nach der Anmeldung. Beim Abmelden endet die
            Sitzung sofort; mit „Überall abmelden" beenden Sie alle Ihre anderen
            Sitzungen, etwa auf anderen Geräten.
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            6. Einsatzdaten und Einsatztagebuch (ETB)
          </Title>
          <Text>
            Im Rahmen der Lageführung werden Einsätze und deren Dokumentation
            verarbeitet: Einträge im Einsatztagebuch (Freitext, Uhrzeit, Angabe
            des Urhebers) sowie die Kartenobjekte der Lagekarte: Kartenzeichen,
            Bereiche, KML-Ebenen und Bild-Overlays (etwa hochgeladene
            Lagepläne). Zweck ist die Dokumentation und Führung des Einsatzes.
            Einträge im Einsatztagebuch werden revisionssicher geführt:
            Korrekturen werden als eigene Fassung gespeichert, frühere Fassungen
            bleiben zu Nachweiszwecken erhalten, solange der Einsatz besteht.
          </Text>
          <Text>
            Entsprechend dem oben genannten Grundsatz ist die Anwendung auf
            lagebezogene, taktische Angaben ohne Personenbezug ausgelegt;
            personenbezogene Daten Dritter sollen nicht eingegeben werden. Der
            bei jedem Eintrag erfasste Urheber sowie der Zeitpunkt betreffen die
            angemeldeten Nutzenden und dienen der Nachvollziehbarkeit der
            Dokumentation. Rechtsgrundlage ist insoweit unser berechtigtes
            Interesse an einer nachvollziehbaren Einsatzdokumentation (Art. 6
            Abs. 1 lit. f DSGVO). Wie lange ein Einsatz aufbewahrt wird, ist in
            Abschnitt 12 beschrieben.
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            7. Standortdaten
          </Title>
          <Text>
            Über einen Gerätelink kann eine Ansicht geöffnet werden, in der das
            Endgerät seinen Standort meldet. Die betroffene Person öffnet den
            Link selbst und gibt die Standortermittlung im Browser aktiv frei;
            daraufhin wird die geografische Position des Geräts an die Anwendung
            übertragen und als Position des zugehörigen Kartenzeichens auf der
            Lagekarte dargestellt. Gespeichert wird jeweils nur die zuletzt
            gemeldete Position; ein Bewegungsverlauf (Track) wird nicht
            angelegt. Der Zugang ist an das jeweilige Gerätelink-Token und den
            laufenden Einsatz gebunden.
          </Text>
          <Text>
            Soweit die Position einer identifizierbaren Person zugeordnet werden
            kann, handelt es sich um personenbezogene Daten. Rechtsgrundlage ist
            die Einwilligung, die durch das eigenständige Öffnen des Gerätelinks
            und die aktive Standortfreigabe erteilt wird (Art. 6 Abs. 1 lit. a
            DSGVO). Die Einwilligung ist freiwillig und kann jederzeit für die
            Zukunft widerrufen werden, indem die Ansicht geschlossen oder die
            Standortfreigabe im Browser entzogen wird.
          </Text>
          <Text>
            Daneben kann ein Einsatz rein lesende Ansichtslinks bereitstellen,
            über die die Lagekarte ohne Anmeldung nur betrachtet wird. Über
            einen Ansichtslink wird kein Standort abgefragt oder übertragen; er
            begründet gegenüber der oben beschriebenen Kartendarstellung und
            Ortssuche keine weitergehende Verarbeitung personenbezogener Daten.
          </Text>
          <Text>
            Ein Gerätelink oder Ansichtslink kann in der Lageführung jederzeit
            entfernt werden; er wird dabei gelöscht. Beim Abschließen eines
            Einsatzes werden alle Gerätelinks und Ansichtslinks dieses Einsatzes
            gelöscht. Ein gelöschter Link zeigt danach nur noch „Zugang
            beendet", auch wenn der Einsatz wieder geöffnet wird. Die zuletzt
            gemeldete Position bleibt als Position des Kartenzeichens auf der
            Lagekarte, bis das Kartenzeichen verschoben oder gelöscht wird,
            längstens bis der Einsatz gelöscht wird (Abschnitt 12).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            8. Kartendarstellung (MapTiler)
          </Title>
          <Text>
            Für die Darstellung der Karte werden Kartenkacheln vom Dienst
            MapTiler (Domain „api.maptiler.com") nachgeladen. Der Abruf erfolgt
            direkt aus Ihrem Browser; dabei wird Ihre IP-Adresse technisch
            bedingt an den Anbieter übermittelt. Rechtsgrundlage ist unser
            berechtigtes Interesse an einer funktionsfähigen Kartendarstellung
            (Art. 6 Abs. 1 lit. f DSGVO).
          </Text>
          <Text>
            Anbieter ist die MapTiler AG, Zugerstrasse 22, 6314 Unterägeri,
            Schweiz. Die Schweiz gilt aufgrund eines Angemessenheitsbeschlusses
            der Europäischen Kommission (Art. 45 DSGVO) als Land mit
            angemessenem Datenschutzniveau; für die Übermittlung sind daher
            keine zusätzlichen Garantien (etwa Standardvertragsklauseln)
            erforderlich.
          </Text>
          <Text>
            MapTiler ist der einzige externe Dienst, den Ihr Browser bei der
            Nutzung der Anwendung kontaktiert; alle übrigen Inhalte lädt er von
            der Anwendung selbst. Die Ortssuche (Abschnitt 9) und der Abruf von
            KML-Adressen und -Icons (Abschnitt 10) erfolgen über den Server.
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            9. Ortssuche (Photon)
          </Title>
          <Text>
            Für die Suche nach Adressen und Orten wird der Dienst Photon (Domain
            „photon.komoot.io") genutzt. Die Suchanfrage wird serverseitig durch
            die Anwendung an den Dienst weitergeleitet, sodass hierbei nicht
            Ihre Browser-IP-Adresse, sondern die des Servers übermittelt wird.
            Übertragen werden die von Ihnen eingegebenen Suchbegriffe.
            Rechtsgrundlage ist unser berechtigtes Interesse an einer
            funktionsfähigen Ortssuche (Art. 6 Abs. 1 lit. f DSGVO).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            10. Abruf von KML-Adressen und -Icons
          </Title>
          <Text>
            Wird eine KML-Ebene über eine Adresse (URL) eingebunden oder neu
            geladen, ruft der Server der Anwendung diese Adresse ab. Ebenso ruft
            er bei eingebundenen Adressen wie bei hochgeladenen KML- und
            KMZ-Dateien die darin verknüpften weiteren KML-Dateien
            (NetworkLinks) und die Icons der Kartenobjekte ab. Der jeweilige
            Anbieter erhält dabei die IP-Adresse des Servers und die abgerufene
            Adresse, nicht Ihre IP-Adresse. Die Icons werden in die gespeicherte
            KML-Ebene eingebettet, sodass auch beim späteren Betrachten der
            Karte kein Browser diese Anbieter kontaktiert. Rechtsgrundlage ist
            unser berechtigtes Interesse an der Darstellung externer
            Lageinformationen (Art. 6 Abs. 1 lit. f DSGVO).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            11. Datei-Uploads (Lagepläne und Overlays)
          </Title>
          <Text>
            Hochgeladene Bild- und Lageplan-Dateien werden serverseitig
            verarbeitet und im Dateispeicher des Servers abgelegt. Diese Dateien
            können personenbezogene Inhalte enthalten, soweit sie durch die
            Nutzenden hochgeladen werden. Zweck ist die Darstellung als Overlay
            auf der Lagekarte. Die Dateien werden zusammen mit dem Einsatz
            aufbewahrt und gelöscht (Abschnitt 12).
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            12. Speicherdauer und Löschung
          </Title>
          <Text>
            Ein Einsatz wird mit seinem Einsatztagebuch einschließlich früherer
            Fassungen, seinen Kartenobjekten und seinen Uploads aufbewahrt, bis
            ein Admin ihn löscht; gelöscht werden kann ein Einsatz erst, nachdem
            er abgeschlossen wurde. Mit dem Einsatz werden alle zugehörigen
            Daten und Dateien gelöscht. Darüber hinaus gibt es keine
            automatischen Löschfristen.
          </Text>
          <Text>
            Sitzungen enden nach 24 Stunden ohne Nutzung, spätestens nach 30
            Tagen (Abschnitt 5). Gerätelinks und Ansichtslinks werden beim
            Entfernen und beim Abschließen des Einsatzes gelöscht (Abschnitt 7).
            Nutzerkonten bleiben bestehen, bis ein Admin sie löscht. Der
            Nutzername bleibt dabei als Urheber in den Einträgen des
            Einsatztagebuchs erhalten, bis der Einsatz gelöscht wird.
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            13. Keine automatisierte Entscheidungsfindung, kein Tracking
          </Title>
          <Text>
            Es findet keine automatisierte Entscheidungsfindung einschließlich
            Profiling statt. Die Anwendung setzt keine Analyse-, Tracking- oder
            Werbedienste ein.
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            Änderungen dieser Datenschutzerklärung
          </Title>
          <Text>
            Diese Datenschutzerklärung wird angepasst, sobald Änderungen an der
            Anwendung oder der Rechtslage dies erforderlich machen.
          </Text>
        </Stack>
      </Stack>
    </Container>
  );
}
