import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";
import { hash } from "../src/core/auth.js";

const origin = "https://folio.example";
async function fixture(t: any) {
  const dir = mkdtempSync(join(tmpdir(), "folio-settings-"));
  const options = {
    dataDir: dir,
    publicUrl: origin,
    secureCookies: true,
    registerAi: false,
    seed: false,
    googleProvider: null,
  };
  let app = await buildApp(options);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    app,
    async restart() {
      await app.close();
      app = await buildApp(options);
      return app;
    },
  };
}
function account(
  app: FastifyInstance,
  id: string,
  role: "student" | "teacher",
  studentId = role === "student" ? `number-${id}` : "",
  complete = true,
) {
  app.folio.db
    .prepare(
      "INSERT INTO users(id,google_sub,google_email,name,student_id,role,profile_complete,created_at) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      `google-subject-${id}`,
      `${id}@example.test`,
      `Name ${id}`,
      studentId,
      role,
      complete ? 1 : 0,
      new Date().toISOString(),
    );
  return session(app, id, "google");
}
function session(
  app: FastifyInstance,
  userId: string,
  method: "google" | "wallet",
) {
  const token = `synthetic-${method}-session-${userId}`;
  const timestamp = Date.now();
  app.folio.db
    .prepare(
      "INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
    )
    .run(hash(token), userId, timestamp + 86_400_000, timestamp);
  app.folio.db
    .prepare("INSERT INTO auth_session_methods(token_hash,method) VALUES(?,?)")
    .run(hash(token), method);
  return { origin, cookie: `folio_session=${token}` };
}
const settings = (app: FastifyInstance, headers: any, payload: any) =>
  app.inject({
    method: "PATCH",
    url: "/api/auth/settings",
    headers,
    payload,
  });
async function createCourse(app: FastifyInstance, headers: any, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/courses",
    headers,
    payload: { name, code: name, description: "Role switching regression" },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json().course;
}

test("settings require a signed-in completed profile, exact origin and valid fields", async (t) => {
  const { app } = await fixture(t);
  const incomplete = account(app, "incomplete", "student", "", false);
  const auth = account(app, "student", "student");
  assert.equal(
    (await settings(app, { origin }, { role: "teacher" })).statusCode,
    401,
  );
  assert.equal(
    (await settings(app, incomplete, { role: "teacher" })).statusCode,
    403,
  );
  assert.equal(
    (
      await settings(
        app,
        { ...auth, origin: "https://other.example" },
        { role: "teacher" },
      )
    ).statusCode,
    403,
  );
  const original = app.folio.userById("student");
  for (const input of [
    {},
    { role: "admin" },
    { role: "teacher", id: "another-account" },
    { name: "   " },
    { name: "x".repeat(81) },
    { studentId: "x".repeat(41) },
    { studentId: "   " },
    { role: null },
    { name: 123 },
    { studentId: 123 },
    { googleEmail: "overwrite@example.test" },
  ]) {
    const response = await settings(app, auth, input);
    assert.equal(response.statusCode, 400, response.body);
    assert.deepEqual(app.folio.userById("student"), original);
  }
});

test("switching roles keeps the same identity, sessions and student number across restart", async (t) => {
  const state = await fixture(t);
  let app = state.app;
  const google = account(app, "both-sessions", "student", "20260001");
  app.folio.db
    .prepare("UPDATE users SET wallet_address=? WHERE id=?")
    .run(`0x${"11".repeat(20)}`, "both-sessions");
  const wallet = session(app, "both-sessions", "wallet");
  const originalSessions = app.folio.db
    .prepare("SELECT * FROM auth_sessions ORDER BY token_hash")
    .all();
  const original = app.folio.userById("both-sessions")!;
  const teacher = await settings(app, google, {
    name: "  Updated Name  ",
    role: "teacher",
    studentId: "",
  });
  assert.equal(teacher.statusCode, 200, teacher.body);
  assert.equal(teacher.headers["set-cookie"], undefined);
  assert.equal(teacher.json().user.id, original.id);
  assert.equal(teacher.json().user.name, "Updated Name");
  assert.equal(teacher.json().user.role, "teacher");
  assert.equal(teacher.json().user.studentId, "20260001");
  assert.equal(teacher.json().user.authMethod, "google");
  assert.equal(teacher.json().user.googleEmail, original.googleEmail);
  assert.equal(teacher.json().user.walletAddress, original.walletAddress);
  assert.deepEqual(
    teacher.json().data,
    app.folio.workspace(teacher.json().user),
  );
  const otherSession = await app.inject({
    url: "/api/auth/me",
    headers: wallet,
  });
  assert.equal(otherSession.json().user.role, "teacher");
  assert.equal(otherSession.json().user.authMethod, "wallet");
  assert.deepEqual(
    app.folio.db
      .prepare("SELECT * FROM auth_sessions ORDER BY token_hash")
      .all(),
    originalSessions,
  );

  app = await state.restart();
  const persisted = await app.inject({ url: "/api/auth/me", headers: google });
  assert.equal(persisted.json().user.role, "teacher");
  assert.equal(persisted.json().user.name, "Updated Name");
  const student = await settings(app, google, { role: "student" });
  assert.equal(student.statusCode, 200, student.body);
  assert.equal(student.json().user.id, original.id);
  assert.equal(student.json().user.studentId, "20260001");
  assert.equal(student.json().user.authMethod, "google");
  assert.deepEqual(
    app.folio.db
      .prepare("SELECT * FROM auth_sessions ORDER BY token_hash")
      .all(),
    originalSessions,
  );
});

test("a teacher must supply a student number before switching, and failed changes are atomic", async (t) => {
  const { app } = await fixture(t);
  const auth = account(app, "teacher", "teacher");
  const before = app.folio.userById("teacher");
  for (const input of [
    { role: "student" },
    { role: "student", name: "Should not persist", studentId: "   " },
  ]) {
    const response = await settings(app, auth, input);
    assert.equal(response.statusCode, 400, response.body);
    assert.deepEqual(app.folio.userById("teacher"), before);
  }
  const response = await settings(app, auth, {
    role: "student",
    studentId: "  20260002  ",
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().user.studentId, "20260002");
  assert.equal(response.json().user.role, "student");
  const renamed = await settings(app, auth, { name: "Only my name changes" });
  assert.equal(renamed.statusCode, 200, renamed.body);
  assert.equal(renamed.json().user.role, "student");
  assert.equal(renamed.json().user.studentId, "20260002");
});

test("role changes expose only the current workspace and retain courses and private Wiki for switching back", async (t) => {
  const { app } = await fixture(t);
  const auth = account(app, "switcher", "student");
  const originalTeacher = account(app, "original-teacher", "teacher");
  const peer = account(app, "peer", "student");
  const joinedCourse = await createCourse(
    app,
    originalTeacher,
    "Joined course",
  );
  for (const headers of [auth, peer]) {
    const joined = await app.inject({
      method: "POST",
      url: "/api/courses/join",
      headers,
      payload: { code: joinedCourse.joinCode },
    });
    assert.equal(joined.statusCode, 200, joined.body);
  }
  const privateNote = {
    id: "switcher-private-note",
    courseId: joinedCourse.id,
    studentId: "switcher",
    title: "Private reasoning",
    content: "# Keep this private",
    tags: [],
    links: [],
  };
  const saved = await app.inject({
    method: "PUT",
    url: `/api/notes/${privateNote.id}`,
    headers: auth,
    payload: { record: privateNote },
  });
  assert.equal(saved.statusCode, 200, saved.body);
  const savedNote = saved.json().record;
  const privateSession = {
    id: "switcher-learning",
    courseId: joinedCourse.id,
    studentId: "switcher",
    title: "Learning",
    messages: [],
  };
  const savedSession = await app.inject({
    method: "PUT",
    url: `/api/sessions/${privateSession.id}`,
    headers: auth,
    payload: { record: privateSession },
  });
  assert.equal(savedSession.statusCode, 200, savedSession.body);
  const originalRecords = app.folio.db
    .prepare("SELECT * FROM records ORDER BY collection,id")
    .all();

  const teacher = await settings(app, auth, { role: "teacher" });
  assert.equal(teacher.statusCode, 200, teacher.body);
  assert.deepEqual(teacher.json().data.courses, []);
  assert.deepEqual(teacher.json().data.notes, []);
  assert.deepEqual(teacher.json().data.sessions, []);
  assert.deepEqual(
    app.folio.db.prepare("SELECT * FROM records ORDER BY collection,id").all(),
    originalRecords,
  );
  const originalTeacherWorkspace = (
    await app.inject({ url: "/api/workspace", headers: originalTeacher })
  ).json();
  const switchedClassMember = originalTeacherWorkspace.students.find(
    (user: any) => user.id === "switcher",
  );
  assert.ok(
    switchedClassMember,
    "The enrolled account remains in the class roster while teaching elsewhere.",
  );
  for (const key of [
    "walletAddress",
    "googleLinked",
    "googleEmail",
    "authMethod",
    "profileComplete",
  ])
    assert.equal(key in switchedClassMember, false);
  assert.deepEqual(originalTeacherWorkspace.notes, []);
  const unrelated = await app.inject({
    method: "POST",
    url: `/api/courses/${joinedCourse.id}/join-code/reset`,
    headers: auth,
  });
  assert.equal(unrelated.statusCode, 403);
  const owned = await createCourse(app, auth, "Owned teaching course");
  const peerJoin = await app.inject({
    method: "POST",
    url: "/api/courses/join",
    headers: peer,
    payload: { code: owned.joinCode },
  });
  assert.equal(peerJoin.statusCode, 200, peerJoin.body);
  const peerNote = {
    ...privateNote,
    id: "peer-private-note",
    courseId: owned.id,
    studentId: "peer",
    title: "Peer private title",
  };
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/notes/${peerNote.id}`,
        headers: peer,
        payload: { record: peerNote },
      })
    ).statusCode,
    200,
  );
  const ownedWorkspace = (
    await app.inject({ url: "/api/workspace", headers: auth })
  ).json();
  assert.deepEqual(
    ownedWorkspace.courses.map((c: any) => c.id),
    [owned.id],
  );
  assert.deepEqual(ownedWorkspace.notes, []);
  const attempt = await app.inject({
    method: "PUT",
    url: `/api/notes/${peerNote.id}`,
    headers: auth,
    payload: { record: peerNote },
  });
  assert.equal(attempt.statusCode, 403);

  const student = await settings(app, auth, { role: "student" });
  assert.equal(student.statusCode, 200, student.body);
  assert.deepEqual(
    student.json().data.courses.map((c: any) => c.id),
    [joinedCourse.id],
  );
  assert.deepEqual(student.json().data.notes, [savedNote]);
  assert.deepEqual(student.json().data.sessions, [savedSession.json().record]);
  const forbiddenCreate = await app.inject({
    method: "POST",
    url: "/api/courses",
    headers: auth,
    payload: { name: "No permission", code: "NO" },
  });
  assert.equal(forbiddenCreate.statusCode, 403);
  const forbiddenReset = await app.inject({
    method: "POST",
    url: `/api/courses/${owned.id}/join-code/reset`,
    headers: auth,
  });
  assert.equal(forbiddenReset.statusCode, 403);
  const peerWorkspace = (
    await app.inject({ url: "/api/workspace", headers: peer })
  ).json();
  const courseOwner = peerWorkspace.teachers.find(
    (user: any) => user.id === "switcher",
  );
  assert.ok(
    courseOwner,
    "The course owner's basic identity remains visible while the owner studies elsewhere.",
  );
  for (const key of [
    "walletAddress",
    "googleLinked",
    "googleEmail",
    "authMethod",
    "profileComplete",
  ])
    assert.equal(key in courseOwner, false);
  assert.equal(
    peerWorkspace.notes.some((note: any) => note.id === privateNote.id),
    false,
  );

  const backToTeacher = await settings(app, auth, { role: "teacher" });
  assert.equal(backToTeacher.statusCode, 200, backToTeacher.body);
  assert.deepEqual(
    backToTeacher.json().data.courses.map((c: any) => c.id),
    [owned.id],
  );
  assert.deepEqual(backToTeacher.json().data.notes, []);
  assert.deepEqual(app.folio.get("notes", privateNote.id), savedNote);
  assert.equal(app.folio.get("courses", owned.id)?.teacherId, "switcher");
  const allowedReset = await app.inject({
    method: "POST",
    url: `/api/courses/${owned.id}/join-code/reset`,
    headers: auth,
  });
  assert.equal(allowedReset.statusCode, 200, allowedReset.body);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/courses/${joinedCourse.id}/join-code/reset`,
        headers: auth,
      })
    ).statusCode,
    403,
  );
});

test("settings roll back the saved role if the replacement workspace cannot be produced", async (t) => {
  const { app } = await fixture(t);
  const auth = account(app, "atomic", "student");
  const before = app.folio.userById("atomic");
  const workspace = app.folio.workspace;
  app.folio.workspace = () => {
    throw new Error("Synthetic workspace failure");
  };
  try {
    const response = await settings(app, auth, {
      role: "teacher",
      name: "Should roll back",
    });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(app.folio.userById("atomic"), before);
  } finally {
    app.folio.workspace = workspace;
  }
});
