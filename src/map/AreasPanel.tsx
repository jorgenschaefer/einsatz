import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { type AreaShape, areaCenter } from "./area";
import { PanelRow } from "./PanelRow";
import type { RenderedArea } from "./SituationMap";

const AREA_SHAPES: { shape: AreaShape; label: string }[] = [
  { shape: "polygon", label: "Polygon" },
  { shape: "line", label: "Linie" },
  { shape: "circle", label: "Kreis" },
];

const SHAPE_LABEL = Object.fromEntries(
  AREA_SHAPES.map(({ shape, label }) => [shape, label]),
) as Record<AreaShape, string>;

/**
 * Das Kartenpanel „Bereiche": eine Form wählen, um einen Bereich zu zeichnen,
 * darunter die Liste der Bereiche.
 */
export function AreasPanel({
  areas,
  drawShape,
  onToggleDraw,
  onJump,
  onEdit,
}: {
  areas: RenderedArea[];
  drawShape: AreaShape | null;
  onToggleDraw: (shape: AreaShape) => void;
  onJump: (lat: number, lng: number) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        {AREA_SHAPES.map(({ shape, label }) => (
          <Button
            key={shape}
            size="xs"
            variant={drawShape === shape ? "filled" : "default"}
            aria-pressed={drawShape === shape}
            onClick={() => onToggleDraw(shape)}
          >
            {label}
          </Button>
        ))}
      </Group>
      {areas.length === 0 ? (
        <Text c="dimmed" size="sm">
          Noch keine Bereiche. Form wählen und auf die Karte zeichnen.
        </Text>
      ) : (
        <Stack gap={4}>
          {areas.map((area) => (
            <PanelRow
              key={area.id}
              name={area.label || "Bereich"}
              onJump={() => {
                const center = areaCenter(area.geometry);
                onJump(center.lat, center.lng);
              }}
              onEdit={() => onEdit(area.id)}
              icon={
                <Box
                  w={14}
                  h={14}
                  style={{
                    background: area.color,
                    borderRadius: 3,
                    flex: "none",
                  }}
                />
              }
              meta={
                <Text size="xs" c="dimmed">
                  {SHAPE_LABEL[area.geometry.shape]}
                </Text>
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
