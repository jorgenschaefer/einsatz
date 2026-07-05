CREATE TABLE image_overlays (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations (id) ON DELETE CASCADE,
  file_path    text NOT NULL,
  name         text NOT NULL DEFAULT '',
  width_px     integer NOT NULL,
  height_px    integer NOT NULL,
  center_lat   double precision NOT NULL,
  center_lng   double precision NOT NULL,
  scale_m      double precision NOT NULL,
  rotation_deg double precision NOT NULL DEFAULT 0,
  opacity      double precision NOT NULL DEFAULT 1,
  visible      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX image_overlays_operation_idx ON image_overlays (operation_id);
