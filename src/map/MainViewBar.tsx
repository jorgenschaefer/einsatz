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
  newEtbEntries,
}: {
  /** "default": die Startansicht steht noch nicht fest (vor der Hydration). */
  activeView: MainView | "default";
  onSelect: (view: MainView) => void;
  newEtbEntries: number;
}) {
  return (
    <div className="main-view-bar">
      {ITEMS.map(({ view, label, Icon }) => {
        const count = view === "etb" ? newEtbEntries : 0;
        return (
          <UnstyledButton
            key={view}
            className="main-view-bar-item"
            aria-label={
              count > 0 ? `${label} ${newEntriesText(count)}` : undefined
            }
            aria-current={activeView === view ? "page" : undefined}
            onClick={() => onSelect(view)}
          >
            <span className="main-view-bar-icon">
              <Icon size={22} />
              {count > 0 && (
                <span className="main-view-bar-count">{count}</span>
              )}
            </span>
            <span>{label}</span>
          </UnstyledButton>
        );
      })}
    </div>
  );
}

const newEntriesText = (count: number) =>
  count === 1 ? "1 neuer Eintrag" : `${count} neue Einträge`;
