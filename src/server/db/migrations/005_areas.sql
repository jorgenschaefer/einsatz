CREATE TABLE areas (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations (id) ON DELETE CASCADE,
  geometry     jsonb NOT NULL,
  color        text NOT NULL,
  opacity      double precision NOT NULL,
  label        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX areas_operation_idx ON areas (operation_id);
