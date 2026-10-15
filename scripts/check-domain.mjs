import assert from "node:assert/strict";
import { initialData } from "../src/data.js";
import { migrateWorkspace, loadIdentity } from "../src/lib/workspaceData.js";
import {
  canReadCourse,
  canReadMaterial,
  canReadPrivateNote,
  canReadSession,
  canReadThread,
  canTeach,
  enrolledStudents,
  inboxUnreadCount,
  isThreadUnread,
  threadStatus,
  visibleCourses,
  visibleThreads,
} from "../src/lib/access.js";
import {
  createInboxThread,
  markInboxThreadRead,
  replyToInboxThread,
  setInboxThreadResolved,
} from "../src/lib/inbox.js";
import { buildRoute, parseRoute } from "../src/lib/navigation.js";

const actors = {
  wenbin: { role: "student", id: "wenbin" },
  sarah: { role: "student", id: "sarah" },
  richard: { role: "teacher", id: "richard" },
  emily: { role: "teacher", id: "emily" },
};
const source = structuredClone(initialData);
source.materials.push({
  id: "uploaded-pdf-kept",
  courseId: "se",
  ownerId: "wenbin",
  name: "My PDF.pdf",
  hasOriginal: true,
  pages: [{ page: 1, text: "Retain my extraction and original-file key." }],
});
const oldIds = Object.fromEntries(
  ["sessions", "notes", "market", "materials"].map((key) => [
    key,
    source[key].map((item) => item.id),
  ]),
);
let data = migrateWorkspace(source);
for (const key of Object.keys(oldIds)) {
  assert.deepEqual(
    data[key].map((item) => item.id),
    oldIds[key],
    `Migration must preserve ${key} IDs`,
  );
}
const uploaded = data.materials.find((item) => item.id === "uploaded-pdf-kept");
assert.equal(uploaded.hasOriginal, true);
assert.equal(uploaded.ownerId, "wenbin");
assert.equal(
  uploaded.pages[0].text,
  "Retain my extraction and original-file key.",
);
assert.deepEqual(
  migrateWorkspace(data),
  data,
  "Migration must be idempotent and retain existing threads",
);
assert.equal(data.schemaVersion, 2);
assert.equal(
  data.courses.find((item) => item.id === "se").teacherId,
  "richard",
);
assert.equal(data.courses.find((item) => item.id === "web").teacherId, "emily");
assert.equal(data.enrollments.length, 8);
assert.equal(
  enrolledStudents(data, "web").length,
  4,
  "Roster must include students without a session",
);

assert.deepEqual(
  visibleCourses(data, actors.richard).map((item) => item.id),
  ["se"],
);
assert.deepEqual(
  visibleCourses(data, actors.emily).map((item) => item.id),
  ["web"],
);
assert.equal(canTeach(data, "richard", "web"), false);
assert.equal(canReadCourse(data, actors.richard, "web"), false);
assert.equal(
  canReadSession(
    data,
    actors.richard,
    data.sessions.find((item) => item.id === "s-wenbin-web"),
  ),
  false,
);
assert.equal(
  canReadSession(
    data,
    actors.sarah,
    data.sessions.find((item) => item.id === "s-wenbin-1"),
  ),
  false,
);
assert.equal(canReadMaterial(data, actors.sarah, uploaded), false);
assert.equal(canReadMaterial(data, actors.richard, uploaded), true);
assert.equal(canReadMaterial(data, actors.emily, uploaded), false);
assert.equal(
  canReadMaterial(data, actors.wenbin, {
    ...uploaded,
    archivedAt: "2026-10-15T09:00:00Z",
  }),
  true,
  "Historical source reading remains possible after archival",
);
for (const note of data.notes) {
  assert.equal(
    canReadPrivateNote(data, actors.richard, note),
    false,
    "Teachers cannot read any private note",
  );
  assert.equal(canReadPrivateNote(data, actors.emily, note), false);
  if (note.studentId !== "wenbin")
    assert.equal(canReadPrivateNote(data, actors.wenbin, note), false);
}
assert.equal(canReadSession(data, actors.wenbin, null), false);
assert.equal(canReadMaterial(data, actors.wenbin, null), false);
assert.equal(canReadThread(data, actors.wenbin, null), false);

data = { ...data, threads: [] };
const input = {
  id: "qa-thread",
  messageId: "qa-message-1",
  courseId: "se",
  subject: "  A question about concurrency  ",
  body: "  Which invariant should I check?  ",
  relatedSessionId: "s-wenbin-1",
};
const created = createInboxThread(
  data,
  actors.wenbin,
  input,
  "2026-10-15T10:00:00Z",
);
assert.equal(created.error, undefined);
assert.equal(created.thread.teacherId, "richard");
assert.equal(created.thread.studentId, "wenbin");
assert.equal(created.thread.messages[0].senderId, "wenbin");
assert.equal(created.thread.subject, "A question about concurrency");
assert.equal(
  created.thread.messages[0].body,
  "Which invariant should I check?",
);
data = created.data;
assert.equal(threadStatus(created.thread), "needs-reply");
assert.equal(isThreadUnread(created.thread, actors.richard), true);
assert.equal(isThreadUnread(created.thread, actors.wenbin), false);
assert.equal(inboxUnreadCount(data, actors.richard), 1);
assert.equal(inboxUnreadCount(data, actors.emily), 0);
assert.equal(visibleThreads(data, actors.sarah).length, 0);
assert.ok(
  createInboxThread(data, actors.richard, input).error,
  "Teachers cannot originate student conversations",
);
assert.ok(
  createInboxThread(data, actors.wenbin, { ...input, courseId: "missing" })
    .error,
);
assert.ok(
  createInboxThread(data, actors.wenbin, {
    ...input,
    relatedSessionId: "s-sarah-1",
  }).error,
  "Cannot attach another student's session",
);
assert.ok(
  createInboxThread(data, actors.wenbin, {
    ...input,
    relatedSessionId: "s-wenbin-web",
  }).error,
  "Cannot attach another course's session",
);
assert.ok(
  createInboxThread(data, actors.wenbin, { ...input, subject: " " }).error,
);
assert.ok(
  createInboxThread(data, actors.wenbin, { ...input, body: "x".repeat(8001) })
    .error,
);
assert.equal(canReadThread(data, actors.sarah, created.thread), false);
assert.equal(canReadThread(data, actors.emily, created.thread), false);
assert.ok(replyToInboxThread(data, actors.sarah, input.id, "Eavesdrop").error);
assert.ok(
  replyToInboxThread(data, actors.emily, input.id, "Wrong teacher").error,
);
assert.equal(markInboxThreadRead(data, actors.sarah, input.id), data);
assert.ok(setInboxThreadResolved(data, actors.wenbin, input.id, true).error);
data = markInboxThreadRead(
  data,
  actors.richard,
  input.id,
  "2026-10-15T10:01:00Z",
);
assert.equal(isThreadUnread(data.threads[0], actors.richard), false);
assert.equal(
  markInboxThreadRead(data, actors.richard, input.id, "2026-10-15T10:02:00Z"),
  data,
  "Reading an already-read thread must not trigger a render loop",
);

data = replyToInboxThread(
  data,
  actors.richard,
  input.id,
  "Check bookings against available seats.",
  { id: "qa-message-2", now: "2026-10-15T10:03:00Z" },
).data;
assert.equal(
  data.threads[0].messages.at(-1).senderId,
  "richard",
  "Teacher writes must use the teacher identity",
);
assert.equal(threadStatus(data.threads[0]), "replied");
assert.equal(isThreadUnread(data.threads[0], actors.wenbin), true);
data = setInboxThreadResolved(
  data,
  actors.richard,
  input.id,
  true,
  "2026-10-15T10:04:00Z",
).data;
assert.equal(threadStatus(data.threads[0]), "resolved");
data = setInboxThreadResolved(
  data,
  actors.richard,
  input.id,
  false,
  "2026-10-15T10:05:00Z",
).data;
assert.equal(threadStatus(data.threads[0]), "replied");
data = setInboxThreadResolved(
  data,
  actors.richard,
  input.id,
  true,
  "2026-10-15T10:06:00Z",
).data;
data = replyToInboxThread(
  data,
  actors.wenbin,
  input.id,
  "How should I handle a failed update?",
  { id: "qa-message-3", now: "2026-10-15T10:07:00Z" },
).data;
assert.equal(data.threads[0].status, "open");
assert.equal(
  threadStatus(data.threads[0]),
  "needs-reply",
  "Student follow-ups reopen resolved conversations",
);
assert.equal(isThreadUnread(data.threads[0], actors.richard), true);
assert.equal(
  replyToInboxThread(data, actors.wenbin, "deleted", "Hello").data,
  data,
);
assert.equal(markInboxThreadRead(data, actors.wenbin, "deleted"), data);
const removedEnrollment = {
  ...data,
  enrollments: data.enrollments.filter(
    (item) => !(item.courseId === "se" && item.studentId === "wenbin"),
  ),
};
assert.ok(
  replyToInboxThread(removedEnrollment, actors.wenbin, input.id, "Hello").error,
);
assert.ok(
  setInboxThreadResolved(removedEnrollment, actors.richard, input.id, true)
    .error,
);
assert.equal(visibleThreads(removedEnrollment, actors.richard).length, 0);
const reassigned = {
  ...data,
  courses: data.courses.map((item) =>
    item.id === "se" ? { ...item, teacherId: "emily" } : item,
  ),
};
assert.equal(canReadThread(reassigned, actors.richard, data.threads[0]), false);
assert.equal(
  canReadThread(reassigned, actors.emily, data.threads[0]),
  false,
  "Old private threads are not silently transferred to another teacher",
);

assert.equal(
  buildRoute("inbox", {}, data, "se"),
  "#/inbox",
  "Unified Inbox must not inherit a selected course",
);
assert.equal(parseRoute("#/inbox", data, "se").courseId, null);
const inboxHash = buildRoute(
  "inbox",
  {
    courseId: "se",
    threadId: input.id,
    status: "needs-reply",
    query: "Wenbin Feng",
  },
  data,
  "web",
);
const inboxRoute = parseRoute(inboxHash, data, "web");
assert.equal(inboxRoute.threadId, input.id);
assert.equal(inboxRoute.courseId, "se");
assert.equal(inboxRoute.status, "needs-reply");
assert.equal(inboxRoute.query, "Wenbin Feng");
const reviewHash = buildRoute(
  "teacher-review",
  {
    courseId: "se",
    studentId: "wenbin",
    sessionId: "s-wenbin-1",
    returnTo: inboxHash,
  },
  data,
  "web",
);
const reviewRoute = parseRoute(reviewHash, data, "web");
assert.equal(reviewRoute.teacherPage, "review");
assert.equal(reviewRoute.studentId, "wenbin");
assert.equal(reviewRoute.returnTo, inboxHash);
assert.equal(
  parseRoute("#/teacher?course=se", data, "web").teacherPage,
  "overview",
);
assert.equal(
  parseRoute("#/teacher/courses/se/students/wenbin?q=Wenbin", data, "web")
    .query,
  "Wenbin",
);
assert.doesNotThrow(() =>
  parseRoute("#/teacher/courses/%E0%A4%A/students/missing", data),
);
assert.equal(
  canReadPrivateNote(
    data,
    actors.richard,
    data.notes.find(
      (item) =>
        item.id === parseRoute("#/wiki?note=n-transactions", data).noteId,
    ),
  ),
  false,
  "A parsed private note link must still fail the permission guard",
);

globalThis.localStorage = {
  getItem: () =>
    JSON.stringify({
      role: "teacher",
      teacherId: "emily",
      studentId: "wenbin",
    }),
};
assert.equal(loadIdentity(data).teacherId, "emily");
globalThis.localStorage = {
  getItem: () =>
    JSON.stringify({
      role: "teacher",
      teacherId: "missing",
      studentId: "wenbin",
    }),
};
assert.equal(
  loadIdentity(data).role,
  "student",
  "Invalid persisted identities fall back to a valid demo identity",
);
delete globalThis.localStorage;

console.log(
  "Domain checks passed: migration, course/identity permissions, private wiki exclusion, Inbox lifecycle/unread state, historic material access, and route round-trips.",
);
