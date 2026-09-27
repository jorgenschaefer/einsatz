"use client";

import { UnstyledButton } from "@mantine/core";
import { IconMap, IconNotebook } from "@tabler/icons-react";
import "./main-view-bar.css";

export type MainView = "map" | "etb";

const ITEMS: { view: MainView; label: string; Icon: typeof IconMap }[] = [
  { view: "map", label: "Lagekarte", Icon: IconMap },
  { view: "etb", label: "ETB", Icon: IconNotebook },
];

export function MainViewBar({
  activeView,
  onSelect,
}: {
  /** "default": die Startansicht steht noch nicht fest (vor der Hydration). */
  activeView: MainView | "default";
  onSelect: (view: MainView) => void;
}) {
  return (
    <div className="main-view-bar">
      {ITEMS.map(({ view, label, Icon }) => (
        <UnstyledButton
          key={view}
          className="main-view-bar-item"
          aria-current={activeView === view ? "page" : undefined}
          onClick={() => onSelect(view)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </UnstyledButton>
      ))}
    </div>
  );
}
