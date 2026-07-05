-- Korrektur-Fassungen: die aktuelle Fassung steht weiter in journal_entries;
-- edited_at hält deren Schreibzeitpunkt (NULL = nie korrigiert), frühere
-- Fassungen wandern mit eigenem Urheber und Zeitstempel in diese Tabelle.
ALTER TABLE journal_entries ADD COLUMN edited_at timestamptz;

CREATE TABLE journal_entry_revisions (
  seq        bigint GENERATED ALWAYS AS IDENTITY,
  id         uuid PRIMARY KEY,
  entry_id   uuid NOT NULL REFERENCES journal_entries (id) ON DELETE CASCADE,
  text       text NOT NULL,
  author     text,
  created_at timestamptz NOT NULL
);

-- seq gibt die stabile Einfügereihenfolge vor (created_at kann bei schnellen
-- Korrekturen kollidieren, da now() den Transaktionsstart liefert).
CREATE INDEX journal_entry_revisions_entry_idx ON journal_entry_revisions (entry_id, seq);
