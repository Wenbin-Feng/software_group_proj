import type Database from "better-sqlite3";
type Kind = "chat" | "generation";
export function createUsageMeter(
  db: Database.Database,
  now = () => Date.now(),
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS ai_usage (userId TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(userId,day,kind));",
  );
  const limitFor = (kind: Kind) => {
    const value =
      process.env[
        kind === "chat" ? "H2A_DAILY_CHAT_LIMIT" : "H2A_DAILY_GENERATION_LIMIT"
      ];
    const parsed =
      value === undefined ? (kind === "chat" ? 60 : 10) : Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10000
      ? parsed
      : kind === "chat"
        ? 60
        : 10;
  };
  return {
    consume(userId: string, kind: Kind) {
      // Requests and retries count even if the provider fails. The budget bounds paid attempts.
      const day = new Date(now()).toISOString().slice(0, 10),
        limit = limitFor(kind);
      const run = db.transaction(() => {
        const row = db
          .prepare(
            "SELECT count FROM ai_usage WHERE userId=? AND day=? AND kind=?",
          )
          .get(userId, day, kind) as { count: number } | undefined;
        if ((row?.count || 0) >= limit)
          throw Object.assign(
            new Error(
              `Your daily ${kind === "chat" ? "chat" : "generation"} limit has been reached. Please try again after 00:00 UTC.`,
            ),
            { statusCode: 429 },
          );
        db.prepare(
          "INSERT INTO ai_usage (userId,day,kind,count) VALUES (?,?,?,1) ON CONFLICT(userId,day,kind) DO UPDATE SET count=count+1",
        ).run(userId, day, kind);
      });
      if (db.inTransaction) run();
      else run.immediate();
    },
  };
}
