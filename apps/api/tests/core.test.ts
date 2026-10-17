import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { openDatabase } from "../src/core/db.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";
const origin = "https://folio.example";
const a = privateKeyToAccount(`0x${"11".repeat(32)}`),
  b = privateKeyToAccount(`0x${"22".repeat(32)}`),
  c = privateKeyToAccount(`0x${"33".repeat(32)}`);
const cookie = (response: any, name: string) => {
  const values = response.headers["set-cookie"];
  return (
    (Array.isArray(values) ? values : [values])
      .filter(Boolean)
      .map((v: string) => v.split(";")[0])
      .find((v: string) => v.startsWith(`${name}=`)) || ""
  );
};
async function fixture(t: any, options: any = {}) {
  const dir = mkdtempSync(join(tmpdir(), "folio-api-"));
  const app = await buildApp({
    dataDir: dir,
    publicUrl: origin,
    secureCookies: true,
    registerAi: false,
    seed: false,
    ...options,
  });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return app;
}
async function signIn(
  app: FastifyInstance,
  account = a,
  role: "student" | "teacher" = "student",
) {
  const challenge = await app.inject({
    method: "POST",
    url: "/api/auth/challenge",
    headers: { origin },
    payload: { address: account.address, chainId: 8453 },
  });
  assert.equal(challenge.statusCode, 200, challenge.body);
  const { message } = challenge.json();
  const signature = await account.signMessage({ message });
  const verify = await app.inject({
    method: "POST",
    url: "/api/auth/verify",
    headers: { origin, cookie: cookie(challenge, "folio_login") },
    payload: { message, signature },
  });
  assert.equal(verify.statusCode, 200, verify.body);
  const session = cookie(verify, "folio_session");
  const profile = await app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: {
      name: `${role} ${account.address.slice(2, 6)}`,
      studentId: role === "student" ? account.address.slice(2, 10) : "",
      role,
    },
  });
  assert.equal(profile.statusCode, 200, profile.body);
  return { user: profile.json().user, headers: { origin, cookie: session } };
}
async function course(app: FastifyInstance, teacher: any) {
  const res = await app.inject({
    method: "POST",
    url: "/api/courses",
    headers: teacher.headers,
    payload: {
      name: "Database systems",
      code: "COMP100",
      description: "Concurrency",
    },
  });
  assert.equal(res.statusCode, 200, res.body);
  return res.json().course;
}
async function joinCourse(app: FastifyInstance, student: any, code: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/courses/join",
    headers: student.headers,
    payload: { code },
  });
  assert.equal(res.statusCode, 200, res.body);
}
async function save(
  app: FastifyInstance,
  auth: any,
  collection: string,
  record: any,
  status = 200,
) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/${collection}/${record.id}`,
    headers: auth.headers,
    payload: { record },
  });
  assert.equal(res.statusCode, status, res.body);
  return res.json().record;
}
async function parsed(app: FastifyInstance, auth: any, id: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await app.inject({
      url: `/api/materials/${id}/processing`,
      headers: auth.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    const job = response.json().job;
    if (job.status === "succeeded") return job.metadata;
    if (job.status === "failed") assert.fail(job.error);
    await new Promise((r) => setTimeout(r, 40));
  }
  assert.fail("Document parsing timed out");
}
test("SIWE exact messages are browser-bound, one-time and verified; onboarding role cannot change", async (t) => {
  const app = await fixture(t);
  const challenge = await app.inject({
    method: "POST",
    url: "/api/auth/challenge",
    headers: { origin },
    payload: { address: a.address, chainId: 1 },
  });
  const { message } = challenge.json();
  const signature = await a.signMessage({ message });
  const verify = (headers: any, msg = message, sig = signature) =>
    app.inject({
      method: "POST",
      url: "/api/auth/verify",
      headers: { origin, ...headers },
      payload: { message: msg, signature: sig },
    });
  assert.equal((await verify({})).statusCode, 401);
  const headers = { cookie: cookie(challenge, "folio_login") };
  assert.equal(
    (await verify(headers, message.replace("Folio", "Other site"))).statusCode,
    401,
  );
  assert.equal(
    (await verify(headers, message, await b.signMessage({ message })))
      .statusCode,
    401,
  );
  const responses = await Promise.all([verify(headers), verify(headers)]);
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 401]);
  const success = responses.find((r) => r.statusCode === 200)!;
  assert.match(String(success.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(success.headers["set-cookie"]), /Secure/);
  const session = cookie(success, "folio_session");
  const profile = await app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: { name: "Teacher", studentId: "", role: "teacher" },
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().user.role, "teacher");
  const flip = await app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: { name: "Student", studentId: "999", role: "student" },
  });
  assert.equal(flip.statusCode, 409);
  const dbSession = app.folio.db
    .prepare("SELECT * FROM auth_sessions")
    .get() as any;
  assert.notEqual(dbSession.token_hash, session.split("=")[1]);
  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { origin, cookie: session },
  });
  assert.equal(logout.statusCode, 200);
  assert.equal(
    (
      await app.inject({ url: "/api/auth/me", headers: { cookie: session } })
    ).json().user,
    null,
  );
});
test("expired nonce, wrong origin and direct origin bypass are rejected", async (t) => {
  let timestamp = Date.now();
  const app = await fixture(t, { now: () => timestamp });
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/challenge",
    headers: { origin: "https://evil.example" },
    payload: { address: a.address, chainId: 1 },
  });
  assert.equal(res.statusCode, 403);
  const challenge = await app.inject({
    method: "POST",
    url: "/api/auth/challenge",
    headers: { origin },
    payload: { address: a.address, chainId: 1 },
  });
  const { message } = challenge.json();
  timestamp += 300_001;
  const verify = await app.inject({
    method: "POST",
    url: "/api/auth/verify",
    headers: { origin, cookie: cookie(challenge, "folio_login") },
    payload: { message, signature: await a.signMessage({ message }) },
  });
  assert.equal(verify.statusCode, 401);
  const guarded = await fixture(t, { originSecret: "test-origin-secret" });
  assert.equal((await guarded.inject({ url: "/api/auth/me" })).statusCode, 403);
  assert.equal((await guarded.inject({ url: "/api/health" })).statusCode, 200);
  assert.equal(
    (
      await guarded.inject({
        url: "/api/auth/me",
        headers: { "x-origin-secret": "test-origin-secret" },
      })
    ).statusCode,
    200,
  );
});
test("course authorization, private Wiki isolation and immutable market snapshots", async (t) => {
  const app = await fixture(t);
  const teacher = await signIn(app, a, "teacher"),
    student = await signIn(app, b),
    peer = await signIn(app, c);
  const room = await course(app, teacher);
  await joinCourse(app, student, room.joinCode);
  await joinCourse(app, peer, room.joinCode);
  const note = {
    id: "private-note",
    courseId: room.id,
    studentId: student.user.id,
    title: "Private title",
    content: "# My private reasoning",
    tags: ["study"],
    links: [],
  };
  await save(app, student, "notes", note);
  await save(app, peer, "notes", { ...note, title: "Hijacked" }, 403);
  await save(app, teacher, "notes", note, 403);
  const session = {
    id: "learning-session",
    courseId: room.id,
    studentId: student.user.id,
    title: "Session",
    messages: [],
  };
  await save(app, student, "sessions", session);
  const teacherWs = (
    await app.inject({ url: "/api/workspace", headers: teacher.headers })
  ).json();
  assert.deepEqual(teacherWs.notes, []);
  assert.equal(teacherWs.sessions.length, 1);
  assert.equal(JSON.stringify(teacherWs).includes("Private title"), false);
  const peerWs = (
    await app.inject({ url: "/api/workspace", headers: peer.headers })
  ).json();
  assert.deepEqual(peerWs.notes, []);
  assert.deepEqual(peerWs.sessions, []);
  assert.equal(peerWs.courses[0].joinCode, undefined);
  const publication = await save(app, student, "market", {
    id: "published-note",
    courseId: room.id,
    authorId: student.user.id,
    noteId: note.id,
    noteIds: [note.id],
    title: "Shared snapshot",
    description: "Public selection",
  });
  assert.equal(publication.content, note.content);
  await save(app, student, "notes", {
    ...note,
    content: "Changed private source",
  });
  const bookmarked = await save(app, peer, "market", {
    ...publication,
    content: "Forged published text",
    bookmarkedBy: [peer.user.id, "third-party"],
    likedBy: [peer.user.id, "third-party"],
  });
  assert.equal(bookmarked.content, note.content);
  assert.deepEqual(bookmarked.bookmarkedBy, [peer.user.id]);
  assert.equal(bookmarked.likes, 1);
  const featured = await save(app, teacher, "market", {
    ...bookmarked,
    featured: true,
  });
  assert.equal(featured.featuredBy, teacher.user.id);
  await save(app, student, "market", { ...featured, featured: false }, 403);
  const reset = await app.inject({
    method: "POST",
    url: `/api/courses/${room.id}/join-code/reset`,
    headers: teacher.headers,
  });
  assert.equal(reset.statusCode, 200);
  const oldCode = await app.inject({
    method: "POST",
    url: "/api/courses/join",
    headers: student.headers,
    payload: { code: room.joinCode },
  });
  assert.equal(oldCode.statusCode, 404);
});
test("Inbox is append-only and rejects forged senders, participants and other read markers", async (t) => {
  const app = await fixture(t);
  const teacher = await signIn(app, a, "teacher"),
    student = await signIn(app, b),
    peer = await signIn(app, c);
  const room = await course(app, teacher);
  await joinCourse(app, student, room.joinCode);
  await joinCourse(app, peer, room.joinCode);
  const first = {
    id: "inbox-one",
    courseId: room.id,
    studentId: student.user.id,
    teacherId: teacher.user.id,
    subject: "Please help",
    relatedSessionId: null,
    status: "open",
    lastReadAt: {
      student: new Date().toISOString(),
      teacher: "2099-01-01T00:00:00Z",
    },
    messages: [
      {
        id: "message-one",
        senderId: student.user.id,
        senderRole: "student",
        body: "My question",
      },
    ],
  };
  const thread = await save(app, student, "threads", first);
  assert.equal(thread.lastReadAt.teacher, null);
  await save(
    app,
    peer,
    "threads",
    {
      ...thread,
      messages: [
        ...thread.messages,
        {
          id: "forged",
          senderId: peer.user.id,
          senderRole: "student",
          body: "Eavesdrop",
        },
      ],
    },
    403,
  );
  await save(
    app,
    student,
    "threads",
    {
      ...thread,
      messages: [
        ...thread.messages,
        {
          id: "forged",
          senderId: teacher.user.id,
          senderRole: "teacher",
          body: "Fake teacher",
        },
      ],
    },
    403,
  );
  const reply = await save(app, teacher, "threads", {
    ...thread,
    messages: [
      ...thread.messages,
      {
        id: "teacher-answer",
        senderId: teacher.user.id,
        senderRole: "teacher",
        body: "Here is help",
      },
    ],
  });
  assert.equal(reply.messages.length, 2);
  const resolved = await save(app, teacher, "threads", {
    ...reply,
    status: "resolved",
  });
  assert.equal(resolved.status, "resolved");
  const reopened = await save(app, student, "threads", {
    ...resolved,
    status: "open",
    messages: [
      ...resolved.messages,
      {
        id: "student-followup",
        senderId: student.user.id,
        senderRole: "student",
        body: "One follow-up",
      },
    ],
  });
  assert.equal(reopened.status, "open");
  await save(
    app,
    student,
    "threads",
    {
      ...reopened,
      messages: [
        { ...reopened.messages[0], body: "Rewrite history" },
        ...reopened.messages.slice(1),
      ],
    },
    409,
  );
});
test("original uploads are server parsed and owner scoped; browser cannot forge extracted evidence", async (t) => {
  const app = await fixture(t);
  const teacher = await signIn(app, a, "teacher"),
    student = await signIn(app, b),
    peer = await signIn(app, c);
  const room = await course(app, teacher);
  await joinCourse(app, student, room.joinCode);
  await joinCourse(app, peer, room.joinCode);
  const original = "# Actual text\n\nThe database must enforce access rules.";
  const upload = await app.inject({
    method: "PUT",
    url: `/api/materials/upload-one/original?courseId=${room.id}`,
    headers: {
      ...student.headers,
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent("Study notes.md"),
    },
    payload: Buffer.from(original),
  });
  assert.equal(upload.statusCode, 202, upload.body);
  const beforeReady = await app.inject({
    method: "PUT",
    url: "/api/materials/upload-one",
    headers: student.headers,
    payload: {
      record: { id: "upload-one", courseId: room.id, ownerId: student.user.id },
    },
  });
  assert.equal(beforeReady.statusCode, 409);
  assert.equal(
    (
      await app.inject({
        url: "/api/materials/upload-one/processing",
        headers: peer.headers,
      })
    ).statusCode,
    404,
  );
  await parsed(app, student, "upload-one");
  const material = await save(app, student, "materials", {
    id: "upload-one",
    courseId: room.id,
    ownerId: student.user.id,
    name: "Forged name.md",
    text: "Forged content",
    pages: [{ page: 1, text: "Forged content" }],
  });
  assert.equal(material.text, original);
  assert.equal(material.name, "Study notes.md");
  assert.equal(
    (
      await app.inject({
        url: "/api/materials/upload-one/original",
        headers: peer.headers,
      })
    ).statusCode,
    404,
  );
  const download = await app.inject({
    url: "/api/materials/upload-one/original",
    headers: teacher.headers,
  });
  assert.equal(download.statusCode, 200);
  assert.equal(download.body, original);
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/materials/upload-one/original?courseId=${room.id}`,
        headers: {
          ...student.headers,
          "content-type": "application/octet-stream",
          "x-file-name": "Study.md",
        },
        payload: Buffer.from("Replacement evidence"),
      })
    ).statusCode,
    409,
  );
});
test("database records survive app restart and applied migrations are tracked", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "folio-persist-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const app = await buildApp({
    dataDir: dir,
    publicUrl: origin,
    registerAi: false,
    seed: false,
  });
  const teacher = await signIn(app, a, "teacher");
  const room = await course(app, teacher);
  await app.close();
  const next = await buildApp({
    dataDir: dir,
    publicUrl: origin,
    registerAi: false,
    seed: false,
  });
  t.after(() => next.close());
  const ws = (
    await next.inject({ url: "/api/workspace", headers: teacher.headers })
  ).json();
  assert.equal(ws.courses[0].id, room.id);
  assert.equal(
    (
      next.folio.db
        .prepare("SELECT count(*) as total FROM __folio_migrations")
        .get() as any
    ).total,
    4,
  );
});
test("notes cannot forge private source pages, foreign sessions or cross-course publication attribution", async (t) => {
  const app = await fixture(t);
  const teacher = await signIn(app, a, "teacher"),
    student = await signIn(app, b),
    peer = await signIn(app, c);
  const room = await course(app, teacher),
    other = await course(app, teacher);
  await joinCourse(app, student, room.joinCode);
  await joinCourse(app, student, other.joinCode);
  await joinCourse(app, peer, room.joinCode);
  app.folio.put("materials", {
    id: "peer-material",
    courseId: room.id,
    ownerId: peer.user.id,
    name: "Secret title.md",
    pages: [{ page: 1, text: "Private text" }],
  });
  app.folio.put("materials", {
    id: "public-material",
    courseId: room.id,
    ownerId: null,
    name: "Public title.md",
    pages: [{ page: 1, text: "Public text" }],
  });
  const note = {
    id: "source-note",
    courseId: room.id,
    studentId: student.user.id,
    title: "Note",
    content: "My words",
    links: [],
    tags: [],
  };
  await save(
    app,
    student,
    "notes",
    { ...note, source: { materialId: "peer-material", page: 1 } },
    403,
  );
  await save(
    app,
    student,
    "notes",
    { ...note, source: { materialId: "public-material", page: 99 } },
    403,
  );
  await save(
    app,
    student,
    "notes",
    {
      ...note,
      courseId: other.id,
      source: { materialId: "public-material", page: 1 },
    },
    403,
  );
  app.folio.put("sessions", {
    id: "peer-session",
    courseId: room.id,
    studentId: peer.user.id,
    title: "Private session",
    messages: [{ id: "private-answer", role: "assistant", content: "Secret" }],
  });
  await save(
    app,
    student,
    "notes",
    {
      ...note,
      sourceSessionId: "peer-session",
      sourceMessageId: "private-answer",
    },
    403,
  );
  await save(app, student, "notes", note);
  const publication = await save(app, student, "market", {
    id: "course-publication",
    courseId: room.id,
    authorId: student.user.id,
    noteId: note.id,
    noteIds: [note.id],
    title: "Snapshot",
  });
  await save(
    app,
    student,
    "notes",
    {
      ...note,
      id: "bad-import",
      courseId: other.id,
      importedFrom: publication.id,
      importedPageId: note.id,
    },
    403,
  );
  await save(
    app,
    student,
    "notes",
    {
      ...note,
      id: "bad-page-import",
      importedFrom: publication.id,
      importedPageId: "nonexistent-page",
    },
    403,
  );
  const imported = await save(app, peer, "notes", {
    ...note,
    id: "valid-import",
    studentId: peer.user.id,
    importedFrom: publication.id,
    importedPageId: note.id,
    attribution: { author: "Forged author" },
  });
  assert.equal(imported.attribution.author, student.user.name);
  assert.equal(imported.attribution.version, 1);
});
test("server extracts real PDF page references and enforces the upload limit", async (t) => {
  const app = await fixture(t);
  const teacher = await signIn(app, a, "teacher");
  const room = await course(app, teacher);
  const stream = (text: string) => {
    const body = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
    return `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`;
  };
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    stream("First page introduces database transactions."),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    stream("Second page explains atomic conditional updates."),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const upload = await app.inject({
    method: "PUT",
    url: `/api/materials/real-pdf/original?courseId=${room.id}`,
    headers: {
      ...teacher.headers,
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent("真实资料.pdf"),
    },
    payload: Buffer.from(pdf),
  });
  assert.equal(upload.statusCode, 202, upload.body);
  const metadata = await parsed(app, teacher, "real-pdf");
  assert.equal(metadata.pages.length, 2);
  assert.equal(metadata.pages[1].page, 2);
  assert.match(metadata.pages[1].text, /Second page/);
  await save(app, teacher, "materials", {
    ...metadata,
    id: "real-pdf",
    courseId: room.id,
    ownerId: null,
  });
  const original = await app.inject({
    url: "/api/materials/real-pdf/original",
    headers: teacher.headers,
  });
  assert.equal(
    decodeURIComponent(String(original.headers["x-file-name"])),
    "真实资料.pdf",
  );
  const oversized = await app.inject({
    method: "PUT",
    url: `/api/materials/oversized/original?courseId=${room.id}`,
    headers: {
      ...teacher.headers,
      "content-type": "application/octet-stream",
      "x-file-name": "large.txt",
    },
    payload: Buffer.alloc(10 * 1024 * 1024 + 1, "x"),
  });
  assert.equal(oversized.statusCode, 413);
});
test("generated visualization survives save, immutable publication and peer import without trusting client HTML", async (t) => {
  const app = await fixture(t);
  const teacher = await signIn(app, a, "teacher"),
    student = await signIn(app, b),
    peer = await signIn(app, c);
  const room = await course(app, teacher);
  await joinCourse(app, student, room.joinCode);
  await joinCourse(app, peer, room.joinCode);
  const generated =
    '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>Server generated diagram</body></html>';
  app.folio.put("materials", {
    id: "visual-private-source",
    courseId: room.id,
    ownerId: student.user.id,
    name: "Private source.md",
    pages: [{ page: 1, text: "Personal study material" }],
  });
  app.folio.put("sessions", {
    id: "visual-session",
    courseId: room.id,
    studentId: student.user.id,
    title: "Visual explanation",
    messages: [
      {
        id: "visual-answer",
        role: "assistant",
        content: "An explanation",
        visualizationHtml: generated,
      },
    ],
  });
  const base = {
    id: "visual-wiki",
    courseId: room.id,
    studentId: student.user.id,
    title: "Visual Wiki",
    content: "My understanding",
    links: [],
    tags: [],
    hasAnimation: true,
    animation: "html",
    sourceSessionId: "visual-session",
    sourceMessageId: "visual-answer",
    source: { materialId: "visual-private-source", page: 1 },
    visualizationHtml: "<script>client forgery</script>",
  };
  const note = await save(app, student, "notes", base);
  assert.equal(note.visualizationHtml, generated);
  assert.equal(note.animation, "html");
  assert.equal(note.hasAnimation, true);
  const edited = await save(app, student, "notes", {
    ...note,
    title: "Edited understanding",
    visualizationHtml: "<script>replacement forgery</script>",
  });
  assert.equal(edited.visualizationHtml, generated);
  const plain = await save(app, student, "notes", {
    id: "forged-html-note",
    courseId: room.id,
    studentId: student.user.id,
    title: "Plain note",
    content: "Normal text",
    visualizationHtml: "<script>untrusted</script>",
  });
  assert.equal(plain.visualizationHtml, undefined);
  const publication = await save(app, student, "market", {
    id: "visual-publication",
    courseId: room.id,
    authorId: student.user.id,
    noteId: note.id,
    noteIds: [note.id],
    title: "Shared visual",
    pages: [{ id: note.id, visualizationHtml: "forged snapshot" }],
  });
  assert.equal(publication.pages[0].visualizationHtml, generated);
  assert.equal(publication.pages[0].animation, "html");
  assert.equal(publication.pages[0].source, undefined);
  assert.equal(publication.pages[0].sourceSessionId, undefined);
  assert.equal(
    JSON.stringify(publication).includes("visual-private-source"),
    false,
  );
  const attempted = await save(app, peer, "market", {
    ...publication,
    pages: [
      {
        ...publication.pages[0],
        visualizationHtml: "<script>replace published visual</script>",
      },
    ],
    bookmarkedBy: [peer.user.id],
  });
  assert.equal(attempted.pages[0].visualizationHtml, generated);
  const imported = await save(app, peer, "notes", {
    id: "imported-visual",
    courseId: room.id,
    studentId: peer.user.id,
    title: "My copy",
    content: "My independent understanding",
    importedFrom: publication.id,
    importedPageId: note.id,
    visualizationHtml: "<script>forged import</script>",
  });
  assert.equal(imported.visualizationHtml, generated);
  assert.equal(imported.animation, "html");
  assert.equal(imported.sourceSessionId, undefined);
  assert.equal(imported.source, undefined);
  const peerWorkspace = (
    await app.inject({ url: "/api/workspace", headers: peer.headers })
  ).json();
  assert.equal(
    peerWorkspace.notes.find((n: any) => n.id === imported.id)
      .visualizationHtml,
    generated,
  );
  assert.equal(peerWorkspace.sessions.length, 0);
  const teacherWorkspace = (
    await app.inject({ url: "/api/workspace", headers: teacher.headers })
  ).json();
  assert.equal(teacherWorkspace.notes.length, 0);
  assert.equal(
    teacherWorkspace.market[0].pages[0].visualizationHtml,
    generated,
  );
});
test("durable file parsing resumes interrupted originals after restart and reports failed documents privately", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "folio-file-resume-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const first = await buildApp({
    dataDir: dir,
    publicUrl: origin,
    registerAi: false,
    seed: false,
  });
  const teacher = await signIn(first, a, "teacher");
  const room = await course(first, teacher);
  await first.close();
  // Reproduce the durable state left by a killed process: bytes exist, one job was running and another was queued.
  const { db } = openDatabase(dir);
  const folder = join(dir, "originals");
  mkdirSync(folder, { recursive: true });
  const original =
    "# Durable original\n\nExtract this exact text after the process restarts.";
  const filePath = join(folder, "resume-file");
  writeFileSync(filePath, original);
  db.prepare("INSERT INTO originals VALUES(?,?,?,?,?,?)").run(
    "resumed-material",
    teacher.user.id,
    room.id,
    filePath,
    JSON.stringify({
      name: "resumed.md",
      type: "md",
      size: Buffer.byteLength(original),
    }),
    Date.now(),
  );
  db.prepare(
    "INSERT INTO file_jobs(id,material_id,user_id,status,progress,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
  ).run(
    "resumed-job",
    "resumed-material",
    teacher.user.id,
    "running",
    45,
    Date.now(),
    Date.now(),
  );
  const badPath = join(folder, "bad-file");
  writeFileSync(badPath, "%PDF-1.7 invalid document");
  db.prepare("INSERT INTO originals VALUES(?,?,?,?,?,?)").run(
    "failed-material",
    teacher.user.id,
    room.id,
    badPath,
    JSON.stringify({ name: "broken.pdf", type: "pdf", size: 24 }),
    Date.now(),
  );
  db.prepare(
    "INSERT INTO file_jobs(id,material_id,user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  ).run(
    "failed-job",
    "failed-material",
    teacher.user.id,
    "queued",
    Date.now() + 1,
    Date.now(),
  );
  db.close();
  const next = await buildApp({
    dataDir: dir,
    publicUrl: origin,
    registerAi: false,
    seed: false,
  });
  t.after(() => next.close());
  const pending = await next.inject({
    url: "/api/materials/resumed-material/processing",
    headers: teacher.headers,
  });
  assert.equal(pending.statusCode, 200);
  assert.equal(pending.json().job.id, "resumed-job");
  assert.ok(
    ["queued", "running", "succeeded"].includes(pending.json().job.status),
  );
  const metadata = await parsed(next, teacher, "resumed-material");
  assert.equal(metadata.text, original);
  assert.equal(metadata.pages[0].page, 1);
  await save(next, teacher, "materials", {
    ...metadata,
    id: "resumed-material",
    courseId: room.id,
    ownerId: null,
  });
  let failed: any;
  for (let i = 0; i < 100; i++) {
    failed = (
      await next.inject({
        url: "/api/materials/failed-material/processing",
        headers: teacher.headers,
      })
    ).json().job;
    if (failed.status === "failed") break;
    await new Promise((r) => setTimeout(r, 40));
  }
  assert.equal(failed.status, "failed");
  assert.match(failed.error, /PDF could not be parsed/);
  assert.equal(failed.metadata, undefined);
  assert.equal(JSON.stringify(failed).includes(badPath), false);
  await save(
    next,
    teacher,
    "materials",
    { id: "failed-material", courseId: room.id, ownerId: null },
    409,
  );
});
