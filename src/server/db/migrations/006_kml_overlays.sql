CREATE TABLE kml_overlays (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations (id) ON DELETE CASCADE,
  source_type  text NOT NULL CHECK (source_type IN ('file', 'url')),
  source_url   text,
  name         text NOT NULL DEFAULT '',
  content      text NOT NULL,
  visible      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kml_overlays_operation_idx ON kml_overlays (operation_id);
