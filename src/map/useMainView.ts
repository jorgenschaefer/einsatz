"use client";

import { useEffect, useRef, useState } from "react";
import type { JournalEntryView } from "@/journal/JournalPanel";
import type { MainView } from "./MainViewBar";
import type { MapPanel } from "./MapPanelSwitch";
import { countUnseenEntries } from "./unseen-entries";
import { useIsDesktop } from "./useIsDesktop";
import { useKeyboardOpen } from "./useKeyboardOpen";

/**
 * Was die Lageansicht zeigt: die Hauptansicht (ETB, Lagekarte, Stärke), das
 * Kartenpanel, ob die Karte und die Kartenpanel-Reihe zu sehen sind – am Handy
 * und am Desktop nach eigenen Regeln. Dazu die Zahl neuer ETB-Einträge an der
 * Leiste und der Cursor im ETB.
 */
export function useMainView({
  journalEntries,
  currentUsername,
}: {
  journalEntries: JournalEntryView[];
  /** Eigene ETB-Einträge zählen nicht als neu. */
  currentUsername: string;
}) {
  const isDesktop = useIsDesktop();
  const keyboardOpen = useKeyboardOpen();
  const [mainView, setMainView] = useState<MainView>("etb");
  const [openPanel, setOpenPanel] = useState<MapPanel | null>(null);
  const newEntryRef = useRef<HTMLTextAreaElement>(null);
  const [newEntryFocusRequests, setNewEntryFocusRequests] = useState(0);
  const latestEntryNumber = Math.max(
    0,
    ...journalEntries.map((entry) => entry.number),
  );
  // Höchste Eintragsnummer, die im ETB zu sehen war; beim Laden gilt alles
  // Vorhandene als gesehen. Lebt nur in dieser Seite.
  const [seenUpTo, setSeenUpTo] = useState(latestEntryNumber);
  const newEtbEntries =
    mainView === "map" || mainView === "strength"
      ? countUnseenEntries(journalEntries, seenUpTo, currentUsername)
      : 0;

  // Am Desktop steht unter „Lagekarte" in der Seitenleiste immer ein Panel;
  // am Handy ist das Panel ein Blatt über der Karte, das auch zu sein kann.
  const shownPanel: MapPanel | null = isDesktop
    ? mainView === "map"
      ? (openPanel ?? "symbols")
      : null
    : openPanel;

  const mapShown = isMapShown(isDesktop, mainView);
  // Am Handy weicht die Reihe mit der Leiste der Bildschirmtastatur.
  const panelSwitchShown =
    mainView === "map" && !(isDesktop === false && keyboardOpen);

  const switchMainView = (view: MainView) => {
    setMainView(view);
    if (view === "etb" || mainView === "etb") setSeenUpTo(latestEntryNumber);
  };
  // Am Desktop setzt jeder Klick auf „ETB" den Cursor ins Eingabefeld, auch
  // wenn das ETB schon gezeigt wird. Der Effekt fokussiert erst nach dem
  // Rendern, wenn das Feld sichtbar ist.
  const selectMainView = (view: MainView) => {
    switchMainView(view);
    if (view === "etb" && isDesktop) setNewEntryFocusRequests((n) => n + 1);
  };
  useEffect(() => {
    if (newEntryFocusRequests > 0) newEntryRef.current?.focus();
  }, [newEntryFocusRequests]);

  const selectMapPanel = (panel: MapPanel) => {
    if (!isDesktop) {
      setOpenPanel((open) => (open === panel ? null : panel));
      return;
    }
    setOpenPanel(panel);
  };
  // Am Handy liegt das Blatt über der unteren Kartenhälfte; wer dort auf der
  // Karte weiterarbeitet (platzieren, zeichnen, angesprungenes Ziel ansehen),
  // braucht die Fläche. Am Desktop steht das Panel in der Seitenleiste und bleibt.
  const closeSheetOnPhone = () => {
    if (!isDesktop) setOpenPanel(null);
  };

  return {
    isDesktop,
    mainView,
    selectMainView,
    newEtbEntries,
    newEntryRef,
    mapShown,
    shownPanel,
    panelSwitchShown,
    selectMapPanel,
    closeSheet: () => setOpenPanel(null),
    closeSheetOnPhone,
  };
}

/**
 * Am Desktop steht die Karte immer neben der Seitenleiste, am Handy nur unter
 * „Lagekarte". Bei unbekannter Breite (vor dem Mount) entscheidet das CSS.
 */
function isMapShown(isDesktop: boolean | null, mainView: MainView) {
  return isDesktop !== false || mainView === "map";
}
