import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import type { User, RecordData } from "./types.js";
import { HttpError } from "./types.js";
import { requestUser, toUser } from "./auth.js";
export function createStore(
  app: FastifyInstance,
  base: {
    db: Database.Database;
    dataDir: string;
    publicUrl: string;
    now: () => number;
  },
) {
  const { db } = base;
  const all = (collection: string): RecordData[] =>
    (
      db
        .prepare("SELECT json FROM records WHERE collection=? ORDER BY rowid")
        .all(collection) as any[]
    ).map((r) => JSON.parse(r.json));
  const get = (collection: string, id: string): RecordData | undefined => {
    if (typeof id !== "string" || !id) return undefined;
    const row = db
      .prepare("SELECT json FROM records WHERE collection=? AND id=?")
      .get(collection, id) as any;
    return row ? JSON.parse(row.json) : undefined;
  };
  const put = (collection: string, record: RecordData) => {
    db.prepare(
      "INSERT INTO records(collection,id,json) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json",
    ).run(collection, record.id, JSON.stringify(record));
  };
  const enrolled = (userId: string, courseId: string) =>
    all("enrollments").some(
      (e) => e.studentId === userId && e.courseId === courseId,
    );
  const canTeach = (user: User, id: string) =>
    user.role === "teacher" && get("courses", id)?.teacherId === user.id;
  const canReadCourse = (user: User, id: string) =>
    canTeach(user, id) || (user.role === "student" && enrolled(user.id, id));
  const canReadSession = (user: User, r: RecordData) =>
    Boolean(
      r &&
      canReadCourse(user, r.courseId) &&
      enrolled(r.studentId, r.courseId) &&
      (canTeach(user, r.courseId) || r.studentId === user.id),
    );
  const canReadMaterial = (user: User, r: RecordData) =>
    Boolean(
      r &&
      canReadCourse(user, r.courseId) &&
      (!r.ownerId ||
        (enrolled(r.ownerId, r.courseId) &&
          (canTeach(user, r.courseId) || r.ownerId === user.id))),
    );
  const canReadNote = (user: User, r: RecordData) =>
    Boolean(
      r &&
      user.role === "student" &&
      r.studentId === user.id &&
      canReadCourse(user, r.courseId),
    );
  const canReadThread = (user: User, r: RecordData) =>
    Boolean(
      r &&
      canReadCourse(user, r.courseId) &&
      enrolled(r.studentId, r.courseId) &&
      get("courses", r.courseId)?.teacherId === r.teacherId &&
      (user.role === "teacher"
        ? r.teacherId === user.id
        : r.studentId === user.id),
    );
  const workspace = (user: User) => {
    const courses = all("courses")
      .filter((c) => canReadCourse(user, c.id))
      .map((c) => {
        const { joinCode, ...rest } = c;
        return canTeach(user, c.id) ? c : rest;
      });
    const courseIds = new Set(courses.map((c) => c.id));
    const enrollments = all("enrollments").filter(
      (e) =>
        courseIds.has(e.courseId) &&
        (user.role === "teacher" || e.studentId === user.id),
    );
    const studentIds = new Set(enrollments.map((e) => e.studentId));
    const rows = db
      .prepare("SELECT * FROM users WHERE profile_complete=1")
      .all() as any[];
    const publicIdentity = (row: any) => {
      const {
        walletAddress,
        profileComplete,
        googleLinked,
        googleEmail,
        authMethod,
        ...rest
      } = toUser(row);
      return rest;
    };
    return {
      schemaVersion: 3,
      courses,
      students: rows
        .filter(
          (r) =>
            r.role === "student" && (r.id === user.id || studentIds.has(r.id)),
        )
        .map(publicIdentity),
      teachers: rows
        .filter(
          (r) =>
            r.role === "teacher" && courses.some((c) => c.teacherId === r.id),
        )
        .map(publicIdentity),
      enrollments,
      materials: all("materials")
        .filter((r) => canReadMaterial(user, r))
        .map(({ filePath, ...r }) => r),
      sessions: all("sessions").filter((r) => canReadSession(user, r)),
      notes: all("notes").filter((r) => canReadNote(user, r)),
      market: all("market")
        .filter((r) => courseIds.has(r.courseId))
        .map((r) => ({
          ...r,
          bookmarkedBy: (r.bookmarkedBy || []).filter(
            (id: string) => id === user.id,
          ),
          likedBy: (r.likedBy || []).filter((id: string) => id === user.id),
        })),
      threads: all("threads").filter((r) => canReadThread(user, r)),
      courseware: all("courseware").filter(
        (r) =>
          canTeach(user, r.courseId) ||
          (r.status === "published" && canReadCourse(user, r.courseId)),
      ),
    };
  };
  const core = {
    ...base,
    all,
    get,
    put,
    canTeach,
    canReadCourse,
    canReadMaterial,
    canReadSession,
    canReadNote,
    workspace,
    userById: (id: string) => {
      const row = db.prepare("SELECT * FROM users WHERE id=?").get(id);
      return row ? toUser(row) : null;
    },
    user: (r: any) => requestUser(app, r),
    requireUser: (r: any) => {
      const u = requestUser(app, r);
      if (!u) throw new HttpError(401, "Please sign in.");
      if (!u.profileComplete)
        throw new HttpError(403, "Complete your profile first.");
      return u;
    },
  };
  return { ...core, enrolled, canReadThread };
}
export function seedSamples(core: ReturnType<typeof createStore>) {
  if (core.get("courses", "sample-se")) return;
  const courses = [
    {
      id: "sample-se",
      name: "Software Engineering",
      code: "COMP 4342",
      description: "Sample materials for exploring software engineering.",
      joinCode: "FOLIO-SE",
      color: "#3156d3",
    },
    {
      id: "sample-web",
      name: "Web Application Development",
      code: "COMP 3421",
      description: "Sample browser and HTTP learning materials.",
      joinCode: "FOLIO-WEB",
      color: "#8b6ac0",
    },
  ];
  core.db.transaction(() => {
    for (const c of courses)
      core.put("courses", {
        ...c,
        teacherId: "sample-teacher",
        instructor: "Folio sample course",
        term: "2026",
        createdAt: new Date().toISOString(),
      });
    const docs = [
      {
        id: "sample-transactions",
        courseId: "sample-se",
        name: "Transactions and concurrency.md",
        text: "# Transactions and concurrency\n\nA transaction groups operations into one logical unit. Atomicity means all operations complete or roll back. Isolation controls how concurrent operations interact.\n\n## Lost updates\n\nTwo requests may both read stock = 1 before either updates it. Protect the invariant with a conditional atomic update or row lock, and check the affected row count.\n\n## Review exercise\n\nDraw two overlapping requests for one item. Locate the read-check-write gap and explain how to avoid accepting two orders.",
      },
      {
        id: "sample-browser",
        courseId: "sample-web",
        name: "The browser request cycle.md",
        text: "# The browser request cycle\n\nA browser resolves a hostname through DNS, establishes a connection and sends an HTTP request. The server responds with status, headers and a body. The browser parses HTML, fetches resources, and lays out and paints the page.\n\nUse the Network panel to inspect requests and responses.",
      },
    ];
    for (const d of docs)
      core.put("materials", {
        ...d,
        ownerId: null,
        type: "md",
        size: Buffer.byteLength(d.text),
        pages: [{ page: 1, text: d.text }],
        uploadedAt: new Date().toISOString(),
        archivedAt: null,
        hasOriginal: false,
      });
  })();
}
