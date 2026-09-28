CREATE TABLE stations (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX stations_operation_name_idx ON stations (operation_id, lower(name));
