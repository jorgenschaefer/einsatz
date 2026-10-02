"use client";

import { Notifications } from "@mantine/notifications";
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from "@/map/lageansicht-sizes";
import { useIsDesktop } from "@/map/useIsDesktop";

const GAP = "var(--mantine-spacing-sm)";

/**
 * Die Benachrichtigungen der App. Sie liegen unter der Kopfleiste der
 * Lageansicht: am Handy oben mittig, am Desktop oben rechts über der Karte,
 * links der Seitenleiste und nicht breiter als die Kartenfläche.
 */
export function ActionNotifications() {
  const desktop = useIsDesktop() ?? false;
  return (
    <Notifications
      position={desktop ? "top-right" : "top-center"}
      style={desktop ? DESKTOP_PLACEMENT : PHONE_PLACEMENT}
    />
  );
}

// Mantine gibt den Stil jedem seiner sechs Container, auch den unbenutzten
// unten; ohne `bottom: auto` reichten die mit dem `top` über die ganze Seite
// und fingen jeden Klick ab.
const PHONE_PLACEMENT = {
  top: `calc(${HEADER_HEIGHT.base}px + ${GAP})`,
  bottom: "auto",
};

const DESKTOP_PLACEMENT = {
  bottom: "auto",
  top: `calc(${HEADER_HEIGHT.sm}px + ${GAP})`,
  right: `calc(${SIDEBAR_WIDTH}px + ${GAP})`,
  maxWidth: `min(var(--notifications-container-width), 100% - ${SIDEBAR_WIDTH}px - 2 * ${GAP})`,
};
