CREATE TABLE IF NOT EXISTS file_jobs (
 id TEXT PRIMARY KEY, material_id TEXT NOT NULL UNIQUE REFERENCES originals(material_id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
 progress INTEGER NOT NULL DEFAULT 0, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS file_jobs_pending ON file_jobs(status,created_at);
