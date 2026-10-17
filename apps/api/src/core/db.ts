import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import * as schema from "./schema.js";
export function openDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, "folio.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(
    "CREATE TABLE IF NOT EXISTS __folio_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  try {
    const folder = new URL("../../drizzle/", import.meta.url);
    for (const name of readdirSync(folder)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(new URL(name, folder), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = db
        .prepare("SELECT hash FROM __folio_migrations WHERE name=?")
        .get(name) as { hash: string } | undefined;
      if (existing && existing.hash !== hash)
        throw new Error(`Applied migration changed: ${name}`);
      if (!existing) {
        // SQLite cannot change foreign_keys inside a transaction. Only this
        // reviewed table-rebuild migration may disable it; a failed integrity
        // check rolls back the whole migration before FK enforcement resumes.
        const rebuildUsers =
          name === "0004_google_auth.sql" &&
          sql.startsWith(
            "-- folio: rebuild-users-with-foreign-keys-disabled\n",
          );
        if (rebuildUsers) db.pragma("foreign_keys = OFF");
        try {
          db.transaction(() => {
            db.exec(sql);
            if ((db.pragma("foreign_key_check") as unknown[]).length)
              throw new Error(`Foreign key validation failed: ${name}`);
            db.prepare("INSERT INTO __folio_migrations VALUES (?,?,?)").run(
              name,
              hash,
              new Date().toISOString(),
            );
          })();
        } finally {
          if (rebuildUsers) db.pragma("foreign_keys = ON");
        }
      }
    }
  } catch (error) {
    db.close();
    throw error;
  }
  return { db, orm: drizzle(db, { schema }) };
}
