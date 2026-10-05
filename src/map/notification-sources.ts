import {
  dismissActionErrors,
  type NotificationSource,
} from "@/app/action-notification";

export const KML_OVERLAYS: NotificationSource = {
  id: "kml-ebenen",
  title: "KML-Ebenen",
};

export const IMAGE_OVERLAYS: NotificationSource = {
  id: "bild-overlays",
  title: "Bild-Overlays",
};

export const VIEW_LINKS: NotificationSource = {
  id: "ansichtslinks",
  title: "Ansichtslinks",
};

/**
 * Die Karten-Interaktionen ohne eigenes Panel (Platzieren, Zeichnen, Kreis
 * verschieben, Kartenzeichen ziehen).
 */
export const SITUATION_MAP: NotificationSource = {
  id: "karte",
  title: "Karte",
};

const LAGEANSICHT_SOURCES = [
  KML_OVERLAYS,
  IMAGE_OVERLAYS,
  VIEW_LINKS,
  SITUATION_MAP,
];

/**
 * Beim Verlassen der Lageansicht bleibt keine ihrer Benachrichtigungen stehen,
 * auch keine einer Action, die erst danach scheitert.
 */
export function closeLageansichtNotifications() {
  for (const notificationSource of LAGEANSICHT_SOURCES) {
    dismissActionErrors(notificationSource);
  }
}
