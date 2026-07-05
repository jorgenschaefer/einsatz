ALTER TABLE map_symbols
  ADD COLUMN device_link_token text UNIQUE,
  ADD COLUMN position_source   text NOT NULL DEFAULT 'manual' CHECK (position_source IN ('manual', 'device')),
  ADD COLUMN reported_at        timestamptz;
