import type Database from "better-sqlite3";
type Kind = "chat" | "generation";
export function createUsageMeter(
  db: Database.Database,
  now = () => Date.now(),
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS ai_usage (userId TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(userId,day,kind));",
  );
  return {
    consume(userId: string, kind: Kind) {
      // Keep usage accounting without enforcing a daily request quota.
      const day = new Date(now()).toISOString().slice(0, 10);
      const run = db.transaction(() => {
        db.prepare(
          "INSERT INTO ai_usage (userId,day,kind,count) VALUES (?,?,?,1) ON CONFLICT(userId,day,kind) DO UPDATE SET count=count+1",
        ).run(userId, day, kind);
      });
      if (db.inTransaction) run();
      else run.immediate();
    },
  };
}
