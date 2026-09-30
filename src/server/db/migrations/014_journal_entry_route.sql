-- Von, An und Weg eines ETB-Eintrags und jeder seiner Fassungen; optional,
-- bestehende Einträge bleiben ohne.
ALTER TABLE journal_entries
  ADD COLUMN sender text,
  ADD COLUMN recipient text,
  ADD COLUMN channel text;
ALTER TABLE journal_entry_revisions
  ADD COLUMN sender text,
  ADD COLUMN recipient text,
  ADD COLUMN channel text;
