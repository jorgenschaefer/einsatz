CREATE TABLE strength_reports (
  id                   uuid PRIMARY KEY,
  station_id           uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  journal_entry_id     uuid NOT NULL UNIQUE REFERENCES journal_entries(id) ON DELETE CASCADE,
  leaders              integer NOT NULL CHECK (leaders >= 0),
  sub_leaders          integer NOT NULL CHECK (sub_leaders >= 0),
  helpers              integer NOT NULL CHECK (helpers >= 0),
  additional_personnel integer NOT NULL CHECK (additional_personnel >= 0),
  note                 text
);

CREATE INDEX strength_reports_station_idx ON strength_reports (station_id);
