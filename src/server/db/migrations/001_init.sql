CREATE TABLE users (
  id            uuid PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE operations (
  id           uuid PRIMARY KEY,
  name         text NOT NULL CHECK (length(btrim(name)) > 0),
  description  text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  default_view jsonb
);

CREATE TABLE journal_entries (
  id           uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES operations (id) ON DELETE CASCADE,
  number       integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  text         text NOT NULL,
  type         text NOT NULL,
  state        text NOT NULL DEFAULT 'gueltig' CHECK (state IN ('gueltig', 'annulliert')),
  author       text,
  UNIQUE (operation_id, number)
);
