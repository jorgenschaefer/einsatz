-- Helfer heißen in der Stärke jetzt Einsatzkräfte (F/UF/E/G).
ALTER TABLE strength_reports RENAME COLUMN helpers TO crew;
ALTER TABLE strength_reports RENAME CONSTRAINT strength_reports_helpers_check TO strength_reports_crew_check;
