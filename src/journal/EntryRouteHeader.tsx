import { Text } from "@mantine/core";
import { type EntryRoute, formatEntryRoute } from "./entry-route";

/**
 * „Von X an Y" fett, der Weg gedimmt dahinter; nichts ohne alle drei Angaben.
 * Durchgestrichen bei früheren Fassungen und annullierten Einträgen.
 */
export function EntryRouteHeader({
  route,
  struck = false,
}: {
  route: EntryRoute;
  struck?: boolean;
}) {
  const header = formatEntryRoute(route);
  if (!header) return null;
  const { parties, channel } = header;
  const content = (
    <>
      {parties}
      {channel && (
        <Text span inherit fw={400} c="dimmed">
          {parties ? ` · ${channel}` : channel}
        </Text>
      )}
    </>
  );
  return (
    <Text size="sm" fw={600} mt={4}>
      {struck ? <del>{content}</del> : content}
    </Text>
  );
}
