import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
export type Job = {
  id: string;
  userId: string;
  courseId: string;
  type: "courseware" | "visualization" | "wiki" | "board";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  attempts: number;
  payload: any;
  result: any;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
const inflate = (row: any): Job | undefined =>
  row
    ? {
        ...row,
        payload: JSON.parse(row.payload),
        result: row.result ? JSON.parse(row.result) : null,
      }
    : undefined;
export function createJobQueue(
  db: Database.Database,
  execute: (job: Job, progress: (value: number) => void) => Promise<any>,
) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS ai_jobs (id TEXT PRIMARY KEY,userId TEXT NOT NULL,courseId TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL,result TEXT,error TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL); CREATE INDEX IF NOT EXISTS ai_jobs_pending ON ai_jobs(status,createdAt);`,
  );
  db.prepare(
    "UPDATE ai_jobs SET status='queued',progress=0 WHERE status='running'",
  ).run();
  db.prepare(
    "UPDATE ai_jobs SET status='failed',error='This task stopped three times. Please start a new task.' WHERE status='queued' AND attempts>=3",
  ).run();
  let busy = false,
    closed = false;
  let active: Promise<void> | undefined;
  const get = (id: string) =>
    inflate(db.prepare("SELECT * FROM ai_jobs WHERE id=?").get(id));
  async function tick() {
    if (busy || closed) return;
    const job = inflate(
      db
        .prepare(
          "SELECT * FROM ai_jobs WHERE status='queued' ORDER BY createdAt LIMIT 1",
        )
        .get(),
    );
    if (!job) return;
    const claimed = db
      .prepare(
        "UPDATE ai_jobs SET status='running',progress=5,attempts=attempts+1,updatedAt=? WHERE id=? AND status='queued'",
      )
      .run(new Date().toISOString(), job.id);
    if (!claimed.changes) return;
    busy = true;
    try {
      const result = await execute(job, (value) => {
        db.prepare(
          "UPDATE ai_jobs SET progress=?,updatedAt=? WHERE id=? AND status='running'",
        ).run(
          Math.min(95, Math.max(5, value)),
          new Date().toISOString(),
          job.id,
        );
      });
      db.prepare(
        "UPDATE ai_jobs SET status='succeeded',progress=100,result=?,error=NULL,updatedAt=? WHERE id=?",
      ).run(JSON.stringify(result), new Date().toISOString(), job.id);
    } catch (error) {
      const safe =
        error instanceof Error
          ? error.message.slice(0, 240)
          : "Generation failed. Please retry.";
      db.prepare(
        "UPDATE ai_jobs SET status='failed',error=?,updatedAt=? WHERE id=?",
      ).run(safe, new Date().toISOString(), job.id);
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(() => {
    if (!busy) active = tick();
  }, 800);
  timer.unref();
  return {
    get,
    list(userId: string, courseId: string) {
      return (
        db
          .prepare(
            "SELECT * FROM ai_jobs WHERE userId=? AND courseId=? ORDER BY createdAt DESC LIMIT 20",
          )
          .all(userId, courseId) as any[]
      ).map((row) => inflate(row)!);
    },
    enqueue(userId: string, courseId: string, type: Job["type"], payload: any) {
      const count = db
        .prepare(
          "SELECT COUNT(*) AS n FROM ai_jobs WHERE userId=? AND status IN ('queued','running')",
        )
        .get(userId) as any;
      if (count.n >= 2)
        throw Object.assign(
          new Error("You already have two generation tasks in progress."),
          { statusCode: 429 },
        );
      const job: Job = {
        id: randomUUID(),
        userId,
        courseId,
        type,
        status: "queued",
        progress: 0,
        attempts: 0,
        payload,
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.prepare(
        "INSERT INTO ai_jobs (id,userId,courseId,type,status,progress,attempts,payload,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).run(
        job.id,
        userId,
        courseId,
        type,
        job.status,
        0,
        0,
        JSON.stringify(payload),
        job.createdAt,
        job.updatedAt,
      );
      return job;
    },
    retry(id: string) {
      const job = get(id);
      if (!job || job.status !== "failed" || job.attempts >= 3)
        throw Object.assign(
          new Error(
            "Only failed tasks with fewer than three attempts can be retried.",
          ),
          { statusCode: 400 },
        );
      const count = db
        .prepare(
          "SELECT COUNT(*) AS n FROM ai_jobs WHERE userId=? AND status IN ('queued','running')",
        )
        .get(job.userId) as any;
      if (count.n >= 2)
        throw Object.assign(
          new Error("You already have two generation tasks in progress."),
          { statusCode: 429 },
        );
      db.prepare(
        "UPDATE ai_jobs SET status='queued',progress=0,error=NULL,updatedAt=? WHERE id=?",
      ).run(new Date().toISOString(), id);
      return get(id)!;
    },
    async close() {
      closed = true;
      clearInterval(timer);
      await active;
    },
    tick,
  };
}
