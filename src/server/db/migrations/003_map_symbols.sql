CREATE TABLE map_symbols (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations (id) ON DELETE CASCADE,
  composition  jsonb NOT NULL,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX map_symbols_operation_idx ON map_symbols (operation_id);
