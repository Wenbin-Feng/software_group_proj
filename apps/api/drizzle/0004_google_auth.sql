-- folio: rebuild-users-with-foreign-keys-disabled
-- The runner temporarily disables foreign keys before this transaction and
-- checks all relationships before commit. Existing user IDs remain unchanged.
CREATE TABLE users_google_migration (
 id TEXT PRIMARY KEY, wallet_address TEXT UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL DEFAULT '', student_id TEXT NOT NULL DEFAULT '',
 role TEXT CHECK(role IN ('student','teacher') OR role IS NULL),
 profile_complete INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
 google_sub TEXT UNIQUE, google_email TEXT,
 CHECK(wallet_address IS NOT NULL OR google_sub IS NOT NULL)
);
INSERT INTO users_google_migration(id,wallet_address,name,student_id,role,profile_complete,created_at)
SELECT id,wallet_address,name,student_id,role,profile_complete,created_at FROM users;
DROP TABLE users;
ALTER TABLE users_google_migration RENAME TO users;
-- Keep auth_sessions' original four columns so an older application image
-- continues to insert wallet sessions if deployment rolls back.
CREATE TABLE auth_session_methods (
 token_hash TEXT PRIMARY KEY REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
 method TEXT NOT NULL CHECK(method IN ('wallet','google'))
);
CREATE TABLE google_oauth_states (
 state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL,
 nonce TEXT NOT NULL, code_verifier TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('login','link')),
 link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 link_session_hash TEXT REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, consumed_at INTEGER,
 CHECK((mode='link' AND link_user_id IS NOT NULL AND link_session_hash IS NOT NULL)
    OR (mode='login' AND link_user_id IS NULL AND link_session_hash IS NULL))
);
CREATE INDEX google_oauth_expiry ON google_oauth_states(expires_at);
