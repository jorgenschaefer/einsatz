-- Wann eine Stelle ihren Namen bekommen hat (Anlegen oder Umbenennen): Unter
-- den Gesprächspartnern zählt die Schreibweise der jüngsten Verwendung.
ALTER TABLE stations
  ADD COLUMN named_at timestamptz NOT NULL DEFAULT now();
UPDATE stations SET named_at = created_at;
