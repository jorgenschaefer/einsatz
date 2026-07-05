import { Anchor, Container, Stack, Text, Title } from "@mantine/core";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum – Lageführung",
};

export default function ImpressumPage() {
  return (
    <Container size="sm" py="lg">
      <Stack gap="lg">
        <Title order={1}>Impressum</Title>

        <Stack gap="xs">
          <Title order={2} size="h4">
            Angaben gemäß § 5 DDG
          </Title>
          <Text>
            Jorgen Schäfer
            <br />
            Sonderburger Str. 1
            <br />
            22305 Hamburg
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            Kontakt
          </Title>
          <Text>
            E-Mail:{" "}
            <Anchor href="mailto:Jorgen.Schaefer@gmail.com">
              Jorgen.Schaefer@gmail.com
            </Anchor>
            <br />
            Telefon: <Anchor href="tel:+4915738767308">+49 1573 8767308</Anchor>
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </Title>
          <Text>
            Jorgen Schäfer
            <br />
            Sonderburger Str. 1
            <br />
            22305 Hamburg
          </Text>
        </Stack>

        <Stack gap="xs">
          <Title order={2} size="h4">
            Haftung für Inhalte und Links
          </Title>
          <Text>
            Die Inhalte dieser Anwendung werden mit Sorgfalt erstellt. Für die
            Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch
            keine Gewähr übernommen werden. Diese Anwendung kann Verweise auf
            externe Websites Dritter enthalten, auf deren Inhalte kein Einfluss
            besteht. Für diese fremden Inhalte ist stets der jeweilige Anbieter
            verantwortlich.
          </Text>
        </Stack>

        <Text size="sm" c="dimmed">
          Siehe auch die{" "}
          <Anchor href="/datenschutz">Datenschutzerklärung</Anchor>.
        </Text>
      </Stack>
    </Container>
  );
}
