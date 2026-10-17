import { canReadThread, isEnrolled } from "./access.js";

const failure = (data, error) => ({ data, error });
const clean = (value) => (typeof value === "string" ? value.trim() : "");

export function createInboxThread(
  data,
  actor,
  input,
  now = new Date().toISOString(),
) {
  const course = data.courses.find((item) => item.id === input.courseId);
  if (
    actor.role !== "student" ||
    !course?.teacherId ||
    !isEnrolled(data, course.id, actor.id)
  )
    return failure(
      data,
      "You can only message teachers of your enrolled courses.",
    );
  const subject = clean(input.subject);
  const body = clean(input.body);
  if (!subject || !body)
    return failure(data, "Add a subject and a message before sending.");
  if (subject.length > 120 || body.length > 8000)
    return failure(
      data,
      "Use up to 120 characters for the subject and 8,000 for the message.",
    );
  const session =
    input.relatedSessionId &&
    data.sessions.find((item) => item.id === input.relatedSessionId);
  if (
    input.relatedSessionId &&
    (!session ||
      session.courseId !== course.id ||
      session.studentId !== actor.id)
  ) {
    return failure(
      data,
      "Only your own session from this course can be attached.",
    );
  }
  const thread = {
    id: input.id || `thread-${crypto.randomUUID()}`,
    courseId: course.id,
    teacherId: course.teacherId,
    studentId: actor.id,
    subject,
    status: "open",
    relatedSessionId: session?.id || null,
    createdAt: now,
    updatedAt: now,
    lastReadAt: { student: now, teacher: null },
    messages: [
      {
        id: input.messageId || `message-${crypto.randomUUID()}`,
        senderRole: actor.role,
        senderId: actor.id,
        body,
        createdAt: now,
      },
    ],
  };
  return {
    data: { ...data, threads: [...(data.threads || []), thread] },
    thread,
  };
}

export function replyToInboxThread(data, actor, threadId, body, options = {}) {
  const thread = (data.threads || []).find((item) => item.id === threadId);
  if (!thread || !canReadThread(data, actor, thread))
    return failure(
      data,
      "This conversation is no longer available to this account.",
    );
  const text = clean(body);
  if (!text || text.length > 8000)
    return failure(data, "Write a reply of up to 8,000 characters.");
  const now = options.now || new Date().toISOString();
  const updated = {
    ...thread,
    status: "open",
    updatedAt: now,
    lastReadAt: { ...thread.lastReadAt, [actor.role]: now },
    messages: [
      ...thread.messages,
      {
        id: options.id || `message-${crypto.randomUUID()}`,
        senderRole: actor.role,
        senderId: actor.id,
        body: text,
        createdAt: now,
      },
    ],
  };
  return {
    data: {
      ...data,
      threads: data.threads.map((item) =>
        item.id === threadId ? updated : item,
      ),
    },
    thread: updated,
  };
}

export function setInboxThreadResolved(
  data,
  actor,
  threadId,
  resolved,
  now = new Date().toISOString(),
) {
  const thread = (data.threads || []).find((item) => item.id === threadId);
  if (
    actor.role !== "teacher" ||
    !thread ||
    !canReadThread(data, actor, thread)
  )
    return failure(
      data,
      "Only the assigned teacher can change this conversation’s status.",
    );
  const updated = {
    ...thread,
    status: resolved ? "resolved" : "open",
    updatedAt: now,
  };
  return {
    data: {
      ...data,
      threads: data.threads.map((item) =>
        item.id === threadId ? updated : item,
      ),
    },
    thread: updated,
  };
}

export function markInboxThreadRead(
  data,
  actor,
  threadId,
  now = new Date().toISOString(),
) {
  const thread = (data.threads || []).find((item) => item.id === threadId);
  if (!thread || !canReadThread(data, actor, thread)) return data;
  const latest = thread.messages.at(-1)?.createdAt;
  if (
    !latest ||
    (thread.lastReadAt?.[actor.role] &&
      Date.parse(thread.lastReadAt[actor.role]) >= Date.parse(latest))
  )
    return data;
  return {
    ...data,
    threads: data.threads.map((item) =>
      item.id === threadId
        ? { ...item, lastReadAt: { ...item.lastReadAt, [actor.role]: now } }
        : item,
    ),
  };
}

export function inboxDate(value, compact = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    ...(compact ? {} : { hour: "2-digit", minute: "2-digit" }),
  }).format(date);
}
