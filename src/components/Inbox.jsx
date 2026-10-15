import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  CircleCheck,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "../context";
import {
  canReadThread,
  isThreadUnread,
  threadStatus,
  visibleCourses,
  visibleThreads,
} from "../lib/access";
import {
  createInboxThread,
  inboxDate,
  markInboxThreadRead,
  replyToInboxThread,
  setInboxThreadResolved,
} from "../lib/inbox";
import { Avatar, Modal } from "./ui";
import "./inbox.css";

const labels = {
  "needs-reply": "Needs reply",
  replied: "Replied",
  resolved: "Resolved",
};
function Status({ thread }) {
  const status = threadStatus(thread);
  return (
    <span className={`inbox-status inbox-status-${status}`}>
      {status === "resolved" ? (
        <CircleCheck size={12} />
      ) : status === "replied" ? (
        <CheckCheck size={12} />
      ) : null}
      {labels[status]}
    </span>
  );
}

export default function Inbox() {
  const {
    data,
    setData,
    role,
    user,
    teacher,
    actor: contextActor,
    navigate,
    toast,
    route = {},
    composeRequest,
    clearComposeRequest,
  } = useApp();
  const actor = contextActor || {
    id: role === "teacher" ? teacher?.id : user.id,
    role,
  };
  const latestData = useRef(data);
  latestData.current = data;
  const courses = visibleCourses(data, actor);
  const threads = visibleThreads(data, actor);
  const courseFilter = route.courseId || "";
  const statusFilter = route.status || "all";
  const query = route.query || "";
  const [compose, setCompose] = useState(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const messageEnd = useRef(null);
  const requestHandled = useRef(null);
  const selected = route.threadId
    ? threads.find((item) => item.id === route.threadId)
    : null;
  const selectedLastMessage = selected?.messages.at(-1)?.id;
  const invalidCourse =
    !!courseFilter && !courses.some((item) => item.id === courseFilter);
  const unavailable = !!route.threadId && !selected;
  const activeCourse =
    selected && data.courses.find((item) => item.id === selected.courseId);
  const student =
    selected && data.students.find((item) => item.id === selected.studentId);
  const recipient =
    selected &&
    (data.teachers || []).find((item) => item.id === selected.teacherId);
  const relatedSession =
    selected?.relatedSessionId &&
    data.sessions.find(
      (item) =>
        item.id === selected.relatedSessionId &&
        item.courseId === selected.courseId &&
        item.studentId === selected.studentId,
    );
  const results = useMemo(
    () =>
      threads
        .filter((item) => {
          const owner = data.students.find(
            (person) => person.id === item.studentId,
          );
          const matchesQuery =
            `${item.subject} ${owner?.name || ""} ${owner?.studentId || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase());
          return (
            (!courseFilter || item.courseId === courseFilter) &&
            (statusFilter === "all" || threadStatus(item) === statusFilter) &&
            matchesQuery
          );
        })
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [threads, data.students, courseFilter, statusFilter, query],
  );

  function goInbox(changes = {}) {
    navigate("inbox", {
      courseId: courseFilter || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      query: query || undefined,
      threadId: route.threadId,
      ...changes,
    });
  }
  function startCompose(request) {
    const allowed = visibleCourses(latestData.current, actor);
    const suggested =
      request?.courseId ||
      (allowed.some((item) => item.id === courseFilter)
        ? courseFilter
        : allowed[0]?.id) ||
      "";
    const relatedSession = latestData.current.sessions.find(
      (item) =>
        item.id === request?.sessionId &&
        item.courseId === suggested &&
        item.studentId === actor.id,
    );
    setCompose({
      courseId: suggested,
      lockedCourse: !!request?.courseId,
      relatedSessionId: relatedSession?.id || "",
      subject: "",
      body: "",
      error: "",
    });
  }

  useEffect(() => {
    if (
      !composeRequest ||
      role !== "student" ||
      requestHandled.current === composeRequest.requestId
    )
      return;
    requestHandled.current = composeRequest.requestId;
    startCompose(composeRequest);
    clearComposeRequest?.();
  }, [composeRequest?.requestId]);

  useEffect(() => {
    setReply("");
    setError("");
  }, [route.threadId]);

  useEffect(() => {
    if (!selected?.id) return;
    const now = new Date().toISOString();
    setData((previous) =>
      markInboxThreadRead(previous, actor, selected.id, now),
    );
  }, [selected?.id, selectedLastMessage, actor.id, actor.role]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: "nearest" });
  }, [selected?.id, selectedLastMessage]);

  function createThread(event) {
    event.preventDefault();
    const id = `thread-${crypto.randomUUID()}`;
    const messageId = `message-${crypto.randomUUID()}`;
    const input = { ...compose, id, messageId };
    const now = new Date().toISOString();
    const result = createInboxThread(latestData.current, actor, input, now);
    if (result.error) {
      setCompose((previous) => ({ ...previous, error: result.error }));
      return;
    }
    setData((previous) => createInboxThread(previous, actor, input, now).data);
    setCompose(null);
    navigate("inbox", { courseId: input.courseId, threadId: id });
    toast("Message sent to your teacher.");
  }

  function sendReply(event) {
    event.preventDefault();
    const options = {
      id: `message-${crypto.randomUUID()}`,
      now: new Date().toISOString(),
    };
    const result = replyToInboxThread(
      latestData.current,
      actor,
      selected?.id,
      reply,
      options,
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    setData(
      (previous) =>
        replyToInboxThread(previous, actor, selected.id, reply, options).data,
    );
    setReply("");
    setError("");
    toast(
      role === "teacher"
        ? "Reply sent to student."
        : "Reply sent to your teacher.",
    );
  }

  function toggleResolved() {
    const resolved = selected.status !== "resolved";
    const now = new Date().toISOString();
    const result = setInboxThreadResolved(
      latestData.current,
      actor,
      selected.id,
      resolved,
      now,
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    setData(
      (previous) =>
        setInboxThreadResolved(previous, actor, selected.id, resolved, now)
          .data,
    );
    toast(
      resolved ? "Conversation marked as resolved." : "Conversation reopened.",
    );
  }

  function openSession() {
    if (!relatedSession || !canReadThread(latestData.current, actor, selected))
      return;
    if (role === "teacher")
      navigate("teacher-review", {
        courseId: selected.courseId,
        studentId: selected.studentId,
        sessionId: relatedSession.id,
        returnTo: location.hash,
      });
    else
      navigate("studio", {
        courseId: selected.courseId,
        sessionId: relatedSession.id,
      });
  }

  return (
    <div className="inbox-page">
      <header className="inbox-heading">
        <div>
          <div className="inbox-eyebrow">A LITTLE HUMAN GUIDANCE</div>
          <h1>
            Inbox<span>.</span>
          </h1>
          <p>
            {role === "teacher"
              ? "Conversations with the students in your courses."
              : "A direct line to the people teaching your courses."}
          </p>
        </div>
        {role === "student" && (
          <button
            className="btn btn-primary"
            onClick={() => startCompose()}
            disabled={!courses.length}
          >
            <Plus size={17} />
            New message
          </button>
        )}
      </header>
      <section
        className={`inbox-shell ${route.threadId ? "inbox-has-thread" : ""}`}
        aria-label="Course messages"
      >
        <aside className="inbox-list-panel" aria-label="Message threads">
          <div className="inbox-list-tools">
            <div className="inbox-list-title">
              <h2>Messages</h2>
              <span>{results.length}</span>
            </div>
            <label className="inbox-search">
              <Search size={16} />
              <input
                aria-label="Search messages"
                value={query}
                placeholder={
                  role === "teacher"
                    ? "Search student or subject"
                    : "Search subject"
                }
                onChange={(event) =>
                  goInbox({ query: event.target.value || undefined })
                }
              />
              {query && (
                <button
                  aria-label="Clear message search"
                  onClick={() => goInbox({ query: undefined })}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="inbox-filters">
              <select
                aria-label="Filter messages by course"
                value={courseFilter}
                onChange={(event) =>
                  goInbox({
                    courseId: event.target.value || undefined,
                    threadId: undefined,
                  })
                }
              >
                <option value="">All courses</option>
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter message status"
                value={statusFilter}
                onChange={(event) =>
                  goInbox({
                    status:
                      event.target.value === "all"
                        ? undefined
                        : event.target.value,
                    threadId: undefined,
                  })
                }
              >
                <option value="all">All statuses</option>
                <option value="needs-reply">Needs reply</option>
                <option value="replied">Replied</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
          <div className="inbox-thread-list">
            {invalidCourse ? (
              <div className="inbox-list-empty">
                <ShieldCheck size={25} />
                <h3>Course unavailable</h3>
                <p>You do not have access to this course.</p>
                <button
                  className="btn btn-outline"
                  onClick={() =>
                    goInbox({ courseId: undefined, threadId: undefined })
                  }
                >
                  All my messages
                </button>
              </div>
            ) : results.length ? (
              results.map((thread) => {
                const owner = data.students.find(
                  (person) => person.id === thread.studentId,
                );
                const course = data.courses.find(
                  (item) => item.id === thread.courseId,
                );
                const teacher = (data.teachers || []).find(
                  (person) => person.id === thread.teacherId,
                );
                const person = role === "teacher" ? owner : teacher;
                const unread = isThreadUnread(thread, actor);
                return (
                  <button
                    className={`inbox-thread-row ${thread.id === selected?.id ? "is-selected" : ""} ${unread ? "is-unread" : ""}`}
                    key={thread.id}
                    onClick={() => goInbox({ threadId: thread.id })}
                    aria-current={
                      thread.id === selected?.id ? "true" : undefined
                    }
                  >
                    <div className="inbox-row-meta">
                      <span>{course?.code}</span>
                      <time dateTime={thread.updatedAt}>
                        {inboxDate(thread.updatedAt, true)}
                      </time>
                    </div>
                    <div className="inbox-row-subject">
                      <strong>{thread.subject}</strong>
                      {unread && (
                        <span
                          className="inbox-unread"
                          aria-label="Unread messages"
                        />
                      )}
                    </div>
                    <div className="inbox-row-person">
                      {person?.name ||
                        (role === "teacher"
                          ? "Student"
                          : course?.instructor || "Teacher")}
                    </div>
                    <p>{thread.messages.at(-1)?.body}</p>
                    <Status thread={thread} />
                  </button>
                );
              })
            ) : (
              <div className="inbox-list-empty">
                <Mail size={28} />
                <h3>
                  {query || courseFilter || statusFilter !== "all"
                    ? "No matching messages"
                    : "A fresh inbox"}
                </h3>
                <p>
                  {query || courseFilter || statusFilter !== "all"
                    ? "Try another course, status or search."
                    : role === "teacher"
                      ? "Student questions will appear here."
                      : "Send a question when you need a little guidance."}
                </p>
              </div>
            )}
          </div>
          <div className="inbox-private">
            <ShieldCheck size={14} />
            <span>
              Only you and your {role === "teacher" ? "student" : "teacher"} can
              read these messages.
            </span>
          </div>
        </aside>
        <section className="inbox-detail" aria-label="Conversation">
          {unavailable || invalidCourse ? (
            <div className="inbox-detail-empty">
              <ShieldCheck size={36} />
              <h2>Conversation unavailable</h2>
              <p>
                It may have been removed, or you may not have access with this
                account.
              </p>
              <button
                className="btn btn-outline"
                onClick={() =>
                  goInbox({
                    threadId: undefined,
                    ...(invalidCourse ? { courseId: undefined } : {}),
                  })
                }
              >
                <ArrowLeft size={16} />
                Back to inbox
              </button>
            </div>
          ) : selected ? (
            <>
              <header className="inbox-conversation-heading">
                <button
                  className="inbox-mobile-back icon-btn"
                  aria-label="Back to messages"
                  onClick={() => goInbox({ threadId: undefined })}
                >
                  <ArrowLeft size={19} />
                </button>
                <div className="inbox-conversation-title">
                  <div className="inbox-conversation-course">
                    <BookOpen size={13} />
                    {activeCourse?.code}
                    <span>·</span>
                    {activeCourse?.name}
                  </div>
                  <h2>{selected.subject}</h2>
                  <div className="inbox-conversation-person">
                    <Avatar
                      name={
                        role === "teacher"
                          ? student?.name
                          : recipient?.name || activeCourse?.instructor
                      }
                      color={role === "teacher" ? student?.color : "#e6ebfc"}
                      size={25}
                    />
                    <span>
                      {role === "teacher"
                        ? student?.name
                        : recipient?.name || activeCourse?.instructor}
                      {role === "teacher" && student?.studentId
                        ? ` · ${student.studentId}`
                        : ""}
                    </span>
                    <Status thread={selected} />
                  </div>
                </div>
                {role === "teacher" && (
                  <button
                    className={`btn btn-outline inbox-resolve ${selected.status === "resolved" ? "is-resolved" : ""}`}
                    onClick={toggleResolved}
                  >
                    <CircleCheck size={16} />
                    {selected.status === "resolved"
                      ? "Reopen"
                      : "Mark resolved"}
                  </button>
                )}
              </header>
              {relatedSession && (
                <button className="inbox-related-session" onClick={openSession}>
                  <span className="inbox-related-icon">
                    <MessageSquare size={16} />
                  </span>
                  <span>
                    <small>LINKED LEARNING SESSION</small>
                    <strong>
                      {relatedSession.title || "Learning session"}
                    </strong>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              )}
              <div
                className="inbox-messages"
                role="log"
                aria-label="Message history"
                aria-live="polite"
              >
                <div className="inbox-conversation-start">
                  Started {inboxDate(selected.createdAt)} · Hong Kong time
                </div>
                {selected.messages.map((message) => {
                  const mine =
                    message.senderId === actor.id &&
                    message.senderRole === actor.role;
                  const author =
                    message.senderRole === "teacher" ? recipient : student;
                  return (
                    <article
                      className={`inbox-message ${mine ? "inbox-message-mine" : ""}`}
                      key={message.id}
                    >
                      <Avatar
                        name={
                          author?.name ||
                          (message.senderRole === "teacher"
                            ? activeCourse?.instructor
                            : "Student")
                        }
                        color={author?.color || "#e9edfc"}
                        size={31}
                      />
                      <div className="inbox-message-main">
                        <div className="inbox-message-meta">
                          <strong>
                            {mine
                              ? "You"
                              : author?.name || activeCourse?.instructor}
                          </strong>
                          <span>
                            {message.senderRole === "teacher"
                              ? "Teacher"
                              : "Student"}
                          </span>
                          <time dateTime={message.createdAt}>
                            {inboxDate(message.createdAt)}
                          </time>
                        </div>
                        <div className="inbox-message-bubble">
                          {message.body}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {selected.status === "resolved" && (
                  <div className="inbox-resolved-note">
                    <CircleCheck size={15} />
                    Marked as resolved.{" "}
                    {role === "student"
                      ? "Reply to reopen the conversation."
                      : "You can reopen it or send another reply."}
                  </div>
                )}
                <div ref={messageEnd} />
              </div>
              <form className="inbox-reply" onSubmit={sendReply}>
                <label htmlFor="inbox-reply-input">
                  Reply to{" "}
                  {role === "teacher"
                    ? student?.name || "student"
                    : recipient?.name || activeCourse?.instructor || "teacher"}
                </label>
                <textarea
                  id="inbox-reply-input"
                  aria-label="Write a reply"
                  placeholder="Write a thoughtful reply…"
                  value={reply}
                  onChange={(event) => {
                    setReply(event.target.value);
                    if (error) setError("");
                  }}
                  rows={3}
                  maxLength={8000}
                />
                {error && (
                  <p className="inbox-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="inbox-reply-footer">
                  <span>Private to this conversation</span>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!reply.trim()}
                  >
                    <Send size={15} />
                    Send reply
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="inbox-detail-empty">
              <span className="inbox-empty-icon">
                <MessageSquare size={31} />
              </span>
              <h2>A conversation can make things clearer.</h2>
              <p>
                Select a message to continue the conversation.
                {role === "student"
                  ? " Or send your teacher a new question."
                  : " Your students’ questions live here, separate from their learning sessions."}
              </p>
              {role === "student" && (
                <button
                  className="btn btn-outline"
                  onClick={() => startCompose()}
                  disabled={!courses.length}
                >
                  <Plus size={16} />
                  New message
                </button>
              )}
              <span className="inbox-empty-flourish" aria-hidden="true">
                A little guidance, a new perspective.
              </span>
            </div>
          )}
        </section>
      </section>
      {compose && (
        <Modal
          title="Ask your teacher"
          subtitle="A private conversation, connected to your course."
          onClose={() => setCompose(null)}
        >
          <form className="inbox-compose" onSubmit={createThread}>
            <label>
              Course
              <select
                aria-label="Message course"
                value={compose.courseId}
                disabled={compose.lockedCourse}
                onChange={(event) =>
                  setCompose((previous) => ({
                    ...previous,
                    courseId: event.target.value,
                    relatedSessionId: "",
                    error: "",
                  }))
                }
              >
                <option value="" disabled>
                  Choose a course
                </option>
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            {compose.lockedCourse && (
              <p className="inbox-compose-hint">
                Sent to the teacher of this course.
              </p>
            )}
            <label>
              Subject
              <input
                aria-label="Message subject"
                value={compose.subject}
                onChange={(event) =>
                  setCompose((previous) => ({
                    ...previous,
                    subject: event.target.value,
                    error: "",
                  }))
                }
                maxLength={120}
                placeholder="What would you like to ask?"
                required
              />
            </label>
            <label>
              Message
              <textarea
                aria-label="Message body"
                value={compose.body}
                onChange={(event) =>
                  setCompose((previous) => ({
                    ...previous,
                    body: event.target.value,
                    error: "",
                  }))
                }
                maxLength={8000}
                rows={5}
                placeholder="Share your question and what you have tried so far…"
                required
              />
            </label>
            <label>
              Link a learning session{" "}
              <span className="inbox-optional">Optional</span>
              <select
                aria-label="Link a learning session"
                value={compose.relatedSessionId}
                onChange={(event) =>
                  setCompose((previous) => ({
                    ...previous,
                    relatedSessionId: event.target.value,
                    error: "",
                  }))
                }
              >
                <option value="">No linked session</option>
                {data.sessions
                  .filter(
                    (item) =>
                      item.courseId === compose.courseId &&
                      item.studentId === actor.id,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title || "Learning session"}
                    </option>
                  ))}
              </select>
            </label>
            {compose.error && (
              <p className="inbox-error" role="alert">
                {compose.error}
              </p>
            )}
            <div className="inbox-compose-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCompose(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  !compose.courseId ||
                  !compose.subject.trim() ||
                  !compose.body.trim()
                }
              >
                <Send size={15} />
                Send message
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
