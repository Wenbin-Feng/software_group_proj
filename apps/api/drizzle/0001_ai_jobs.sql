CREATE TABLE IF NOT EXISTS ai_jobs (
 id TEXT PRIMARY KEY, userId TEXT NOT NULL, courseId TEXT NOT NULL, type TEXT NOT NULL,
 status TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
 payload TEXT NOT NULL, result TEXT, error TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_jobs_pending ON ai_jobs(status,createdAt);
