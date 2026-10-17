CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, wallet_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL DEFAULT '', student_id TEXT NOT NULL DEFAULT '',
 role TEXT CHECK(role IN ('student','teacher') OR role IS NULL),
 profile_complete INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_challenges (
 id TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, address TEXT NOT NULL,
 message TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS challenge_expiry ON auth_challenges(expires_at);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS records (
 collection TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL,
 PRIMARY KEY(collection,id), CHECK(json_valid(json))
);
CREATE TABLE IF NOT EXISTS originals (
 material_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 course_id TEXT NOT NULL, path TEXT NOT NULL, metadata TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
