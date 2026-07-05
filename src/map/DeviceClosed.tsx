import { Center, Stack, Text, Title } from "@mantine/core";

/**
 * Neutrale Abschluss-Seite: für alle Wegfall-Gründe identisch und ohne Nennung
 * des Grundes, damit ein geleakter Link nichts über den Einsatz verrät.
 */
export function DeviceClosed() {
  return (
    <Center h="100dvh" p="lg">
      <Stack align="center" gap="xs" maw={420}>
        <Title order={2} ta="center">
          Zugang beendet
        </Title>
        <Text ta="center" c="dimmed">
          Dieser Zugang ist nicht mehr aktiv. Die Standortübermittlung wurde
          beendet.
        </Text>
      </Stack>
    </Center>
  );
}
