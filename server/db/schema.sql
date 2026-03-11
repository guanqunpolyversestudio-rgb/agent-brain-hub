CREATE TABLE IF NOT EXISTS brains (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  author      TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  visibility  TEXT NOT NULL DEFAULT 'public',
  version     TEXT NOT NULL DEFAULT '1.0.0',
  tags        TEXT NOT NULL DEFAULT '[]',
  file_path   TEXT NOT NULL,
  file_size   INTEGER NOT NULL DEFAULT 0,
  checksum    TEXT NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merge_logs (
  id          TEXT PRIMARY KEY,
  brain_a     TEXT NOT NULL,
  brain_b     TEXT NOT NULL,
  strategy    TEXT NOT NULL DEFAULT 'manual',
  result_path TEXT NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brains_visibility ON brains(visibility);
CREATE INDEX IF NOT EXISTS idx_brains_author ON brains(author);
CREATE INDEX IF NOT EXISTS idx_brains_created ON brains(created_at DESC);
