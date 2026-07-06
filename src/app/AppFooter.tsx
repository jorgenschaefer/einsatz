"use client";

import { Anchor, Group } from "@mantine/core";
import { usePathname } from "next/navigation";

// Die Vollbild-Kartenseiten (Lageansicht /operations/<id>, Geräteansicht
// /device/<token>, Ansichtslink /view/<token>) füllen die volle Höhe; ein
// Footer darunter würde die Seite unnötig verlängern. Dort erscheinen Impressum
// und Datenschutz stattdessen in der Karten-Attribution (siehe leaflet-adapter).
// Auf allen übrigen Seiten (Login, Einsatzübersicht, Konto …) bleibt der Footer
// sichtbar.
export function isFullscreenMapPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    /^\/operations\/[^/]+$/.test(pathname) ||
    /^\/device\/[^/]+/.test(pathname) ||
    /^\/view\/[^/]+/.test(pathname)
  );
}

export function AppFooter() {
  if (isFullscreenMapPath(usePathname())) return null;
  return (
    <Group
      component="footer"
      justify="center"
      gap="md"
      py="sm"
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      <Anchor href="/impressum" size="xs" c="dimmed">
        Impressum
      </Anchor>
      <Anchor href="/datenschutz" size="xs" c="dimmed">
        Datenschutzerklärung
      </Anchor>
    </Group>
  );
}
