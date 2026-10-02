DO $$
DECLARE
  collisions text;
BEGIN
  SELECT string_agg(names, '; ')
    INTO collisions
    FROM (
      SELECT string_agg(username, ', ' ORDER BY username COLLATE "C") AS names
        FROM users
       GROUP BY lower(username)
      HAVING count(*) > 1
    ) AS groups;
  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Nutzernamen unterscheiden sich nur in Groß-/Kleinschreibung: %. Je Gruppe alle bis auf einen umbenennen oder löschen, dann erneut migrieren.', collisions;
  END IF;
END $$;

CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));
