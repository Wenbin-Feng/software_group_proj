import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { HttpError } from "./types.js";
export type ParsedFile = {
  name: string;
  type: string;
  size: number;
  pages: { page: number; text: string }[];
  text: string;
};
export type FileJob = {
  id: string;
  materialId: string;
  userId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  error: string | null;
  metadata?: ParsedFile;
};
type Parser = (
  name: string,
  bytes: Buffer,
  progress: (percent: number) => void,
) => Promise<ParsedFile>;
export function createFileQueue(db: Database.Database, parse: Parser) {
  // A process interrupted during parsing retries from its durable original on startup.
  db.prepare(
    "UPDATE file_jobs SET status='queued',progress=0,updated_at=? WHERE status='running'",
  ).run(Date.now());
  let busy = false,
    closed = false,
    active: Promise<void> | undefined;
  const get = (materialId: string): FileJob | undefined => {
    const row = db
      .prepare(
        "SELECT j.*,o.metadata FROM file_jobs j JOIN originals o ON o.material_id=j.material_id WHERE j.material_id=?",
      )
      .get(materialId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      materialId: row.material_id,
      userId: row.user_id,
      status: row.status,
      progress: row.progress,
      error: row.error,
      ...(row.status === "succeeded"
        ? { metadata: JSON.parse(row.metadata) }
        : {}),
    };
  };
  async function tick() {
    if (closed || busy) return;
    const job = db
      .prepare(
        "SELECT j.*,o.path,o.metadata FROM file_jobs j JOIN originals o ON o.material_id=j.material_id WHERE j.status='queued' ORDER BY j.created_at,j.rowid LIMIT 1",
      )
      .get() as any;
    if (!job) return;
    const claimed = db
      .prepare(
        "UPDATE file_jobs SET status='running',progress=5,updated_at=? WHERE id=? AND status='queued'",
      )
      .run(Date.now(), job.id);
    if (!claimed.changes) return;
    busy = true;
    try {
      const raw = await readFile(job.path);
      const metadata = await parse(
        JSON.parse(job.metadata).name,
        raw,
        (percent) => {
          db.prepare(
            "UPDATE file_jobs SET progress=?,updated_at=? WHERE id=? AND status='running'",
          ).run(
            Math.max(5, Math.min(95, Math.round(percent))),
            Date.now(),
            job.id,
          );
        },
      );
      db.transaction(() => {
        db.prepare("UPDATE originals SET metadata=? WHERE material_id=?").run(
          JSON.stringify(metadata),
          job.material_id,
        );
        db.prepare(
          "UPDATE file_jobs SET status='succeeded',progress=100,error=NULL,updated_at=? WHERE id=?",
        ).run(Date.now(), job.id);
      })();
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : "This document could not be parsed. Try uploading it again.";
      db.prepare(
        "UPDATE file_jobs SET status='failed',error=?,updated_at=? WHERE id=?",
      ).run(message, Date.now(), job.id);
    } finally {
      busy = false;
    }
  }
  const wake = () => {
    if (!busy && !closed) active = tick();
  };
  const timer = setInterval(wake, 100);
  timer.unref();
  return {
    get,
    checkCapacity(userId: string) {
      const count = db
        .prepare(
          "SELECT count(*) AS total FROM file_jobs WHERE user_id=? AND status IN ('queued','running')",
        )
        .get(userId) as any;
      if (count.total >= 5)
        throw new HttpError(
          429,
          "You already have five documents waiting to be parsed. Please wait before uploading more.",
        );
    },
    enqueue(materialId: string, userId: string) {
      const old = get(materialId);
      if (old && ["queued", "running"].includes(old.status))
        throw new HttpError(409, "This document is already being parsed.");
      const id = randomUUID(),
        timestamp = Date.now();
      db.prepare(
        "INSERT INTO file_jobs(id,material_id,user_id,status,created_at,updated_at) VALUES(?,?,?,'queued',?,?) ON CONFLICT(material_id) DO UPDATE SET id=excluded.id,user_id=excluded.user_id,status='queued',progress=0,error=NULL,created_at=excluded.created_at,updated_at=excluded.updated_at",
      ).run(id, materialId, userId, timestamp, timestamp);
      return id;
    },
    async close() {
      closed = true;
      clearInterval(timer);
      await active;
    },
  };
}
