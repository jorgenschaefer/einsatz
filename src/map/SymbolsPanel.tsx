import { Badge, Button, Group, Image, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { PanelRow } from "./PanelRow";
import { QuickSelectToolbar } from "./QuickSelectToolbar";
import { QUICK_SELECT } from "./quick-select";
import type { PlacedSymbol } from "./SituationMap";
import type { WorkspaceSymbol } from "./SituationMapView";
import { renderSymbolDataUrl } from "./tactical-symbol";

/**
 * Das Kartenpanel „Kartenzeichen": Schnellauswahl und „Erweitert …" zum
 * Platzieren, darunter die Liste der platzierten Kartenzeichen.
 */
export function SymbolsPanel({
  symbols,
  placed,
  armedQuickId,
  onArmQuick,
  onOpenAdvanced,
  onJump,
  onEdit,
}: {
  symbols: WorkspaceSymbol[];
  /** Die Marker auf der Karte; die Liste zeigt dasselbe Icon und „veraltet". */
  placed: PlacedSymbol[];
  armedQuickId: string | null;
  onArmQuick: (quickId: string | null) => void;
  onOpenAdvanced: () => void;
  onJump: (lat: number, lng: number) => void;
  onEdit: (id: string) => void;
}) {
  const toolbarItems = useMemo(
    () =>
      QUICK_SELECT.map((i) => ({
        id: i.id,
        label: i.label,
        iconUrl: renderSymbolDataUrl(i.composition),
      })),
    [],
  );
  const rows = useMemo(() => {
    const placedById = new Map(placed.map((p) => [p.id, p]));
    return symbols.map((s) => {
      const marker = placedById.get(s.id);
      return {
        id: s.id,
        iconUrl: marker?.iconUrl ?? renderSymbolDataUrl(s.composition),
        name: s.composition.text?.trim() || "Ohne Bezeichnung",
        stale: (marker?.opacity ?? 1) < 1,
        device: s.positionSource === "device",
        lat: s.lat,
        lng: s.lng,
      };
    });
  }, [placed, symbols]);

  return (
    <Stack gap="sm">
      <Group gap="xs" align="flex-start">
        <QuickSelectToolbar
          items={toolbarItems}
          armedId={armedQuickId}
          onArm={onArmQuick}
        />
        <Button size="xs" variant="light" onClick={onOpenAdvanced}>
          Erweitert …
        </Button>
      </Group>
      {rows.length === 0 ? (
        <Text c="dimmed" size="sm">
          Noch keine Kartenzeichen. Zeichen wählen und auf die Karte tippen.
        </Text>
      ) : (
        <Stack gap={4}>
          {rows.map((row) => (
            <PanelRow
              key={row.id}
              name={row.name}
              onJump={() => onJump(row.lat, row.lng)}
              onEdit={() => onEdit(row.id)}
              icon={<Image src={row.iconUrl} alt="" w={22} h={22} />}
              meta={
                row.stale ? (
                  <Badge size="xs" color="orange">
                    veraltet
                  </Badge>
                ) : row.device ? (
                  <Badge size="xs" color="green">
                    live
                  </Badge>
                ) : null
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
