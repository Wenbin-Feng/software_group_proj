import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").unique(),
  googleSub: text("google_sub").unique(),
  googleEmail: text("google_email"),
  name: text("name").notNull().default(""),
  studentId: text("student_id").notNull().default(""),
  role: text("role"),
  profileComplete: integer("profile_complete", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
});
export const records = sqliteTable(
  "records",
  {
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    json: text("json").notNull(),
  },
  (t) => [primaryKey({ columns: [t.collection, t.id] })],
);
export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const authSessionMethods = sqliteTable("auth_session_methods", {
  tokenHash: text("token_hash")
    .primaryKey()
    .references(() => authSessions.tokenHash, { onDelete: "cascade" }),
  method: text("method").notNull(),
});
export const authChallenges = sqliteTable("auth_challenges", {
  id: text("id").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  address: text("address").notNull(),
  message: text("message").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
});
export const originals = sqliteTable("originals", {
  materialId: text("material_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  courseId: text("course_id").notNull(),
  path: text("path").notNull(),
  metadata: text("metadata").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const aiJobs = sqliteTable("ai_jobs", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  courseId: text("courseId").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  progress: integer("progress").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  payload: text("payload").notNull(),
  result: text("result"),
  error: text("error"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: text("userId").notNull(),
    day: text("day").notNull(),
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.kind] })],
);
export const fileJobs = sqliteTable("file_jobs", {
  id: text("id").primaryKey(),
  materialId: text("material_id")
    .notNull()
    .unique()
    .references(() => originals.materialId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull(),
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const googleOAuthStates = sqliteTable("google_oauth_states", {
  stateHash: text("state_hash").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  nonce: text("nonce").notNull(),
  codeVerifier: text("code_verifier").notNull(),
  mode: text("mode").notNull(),
  linkUserId: text("link_user_id").references(() => users.id),
  linkSessionHash: text("link_session_hash").references(
    () => authSessions.tokenHash,
  ),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  consumedAt: integer("consumed_at"),
});
