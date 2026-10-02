DELETE FROM sessions;
ALTER TABLE sessions RENAME COLUMN token TO token_hash;
