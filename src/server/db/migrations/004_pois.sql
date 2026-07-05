CREATE TABLE pois (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations (id) ON DELETE CASCADE,
  kennung      text NOT NULL,
  bezeichnung  text NOT NULL,
  lat          double precision,
  lng          double precision,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pois_operation_idx ON pois (operation_id);
