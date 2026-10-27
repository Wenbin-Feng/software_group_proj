import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  Library,
  Link2,
  LockKeyhole,
  MessageSquare,
  PanelRight,
  Plus,
  Sparkles,
  SquarePlay,
  WandSparkles,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { api, streamChat, flushChanges } from "../lib/api";
import { canReadMaterial, canReadSession, isEnrolled } from "../lib/access";
import LearningAnimation from "./Animation";
import "./studio.css";

const starters = [
  "Why can two requests sell the same last item?",
  "Explain transaction isolation in simple terms.",
  "How does a database lock prevent a race condition?",
];
const browserStarters = [
  "What happens after I enter a URL?",
  "How do DNS and HTTP work together?",
  "How does HTML become a visible web page?",
];
const uid = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const cleanTitle = (text) =>
  text.length > 48 ? `${text.slice(0, 45)}…` : text;

function chatInline(text, key) {
  return String(text)
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={`${key}-${index}`}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={`${key}-${index}`}>{part.slice(1, -1)}</code>;
      return part;
    });
}
function ChatMarkdown({ text = "" }) {
  const blocks = [];
  let list = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    const items = list;
    blocks.push(
      ordered ? (
        <ol key={`list-${blocks.length}`}>
          {items.map((item, index) => (
            <li key={index}>{chatInline(item, `ol-${blocks.length}-${index}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`list-${blocks.length}`}>
          {items.map((item, index) => (
            <li key={index}>{chatInline(item, `ul-${blocks.length}-${index}`)}</li>
          ))}
        </ul>
      ),
    );
    list = [];
  };
  text.split("\n").forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const number = line.match(/^\s*\d+\.\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push(
        <h4 key={`h-${blocks.length}`}>{chatInline(heading[2], `h-${blocks.length}`)}</h4>,
      );
    } else if (bullet || number) {
      if (!list.length) ordered = Boolean(number);
      list.push((bullet || number)[1]);
    } else if (!line.trim()) flush();
    else {
      flush();
      blocks.push(<p key={`p-${blocks.length}`}>{chatInline(line, `p-${blocks.length}`)}</p>);
    }
  });
  flush();
  return blocks;
}

function messageAnimation(message) {
  if (!message || message.role !== "assistant") return null;
  if (Object.prototype.hasOwnProperty.call(message, "animation"))
    return message.animation;
  const text = message.content.toLowerCase();
  if (/concurr|race condition|stock|row lock|transaction|isolation/.test(text))
    return "race";
  if (/browser|hostname|http request|cssom|web request/.test(text))
    return "request";
  return null;
}

export default function Studio({
  embedded = false,
  onOpenAnimation,
  onManageMaterials,
}) {
  const {
    data,
    setData,
    patchLocal,
    refreshWorkspace,
    courseId,
    course,
    user,
    role,
    actor,
    route,
    activeSessionId,
    setActiveSessionId,
    navigate,
    toast,
    openMaterial,
  } = useApp();
  const isTeacher = role === "teacher";
  const allSessions = (data.sessions || []).filter(
    (s) => s.courseId === courseId && canReadSession(data, actor, s),
  );
  const sessions = allSessions;
  const requestedSession = allSessions.find(
    (s) =>
      s.id === activeSessionId &&
      (!isTeacher || !route?.studentId || route.studentId === s.studentId),
  );
  const session = isTeacher
    ? requestedSession
    : requestedSession || sessions[0];
  const sessionStudent =
    (data.students || []).find((s) => s.id === session?.studentId) || user;
  const allowedMaterials = (data.materials || []).filter(
    (m) =>
      m.courseId === courseId &&
      !m.archivedAt &&
      canReadMaterial(data, actor, m) &&
      (!isTeacher || Boolean(session)) &&
      (!m.ownerId ||
        m.ownerId === sessionStudent.id ||
        m.ownerId === sessionStudent.studentId),
  );
  const [selectedIds, setSelectedIds] = useState(null);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false),
    [streaming, setStreaming] = useState("");
  const [generating, setGenerating] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const pendingWiki = useRef(null);
  const requestAbort = useRef(null);
  useEffect(() => () => requestAbort.current?.abort(), []);
  const [sourcePicker, setSourcePicker] = useState(false);
  const [sessionPicker, setSessionPicker] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState([]);
  const [showExplainer, setShowExplainer] = useState(true);
  const [selectedVisual, setSelectedVisual] = useState(null);
  const [pendingAnimation, setPendingAnimation] = useState(null);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const selected = allowedMaterials.filter(
    (m) => selectedIds === null || selectedIds.includes(m.id),
  );
  const messages = session?.messages || [];
  const animationType =
    selectedVisual && selectedVisual.sessionId === session?.id
      ? selectedVisual.type
      : messages.length
        ? session?.animation || null
        : null;
  const suggestedQuestions = /web|browser/i.test(course?.name || "")
    ? browserStarters
    : starters;
  const lastAnswer = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  useEffect(() => {
    if (session && session.id !== activeSessionId)
      setActiveSessionId(session.id);
  }, [session?.id]);
  useEffect(() => {
    setSelectedIds(null);
    setSourcePicker(false);
    setInput("");
  }, [user.id, courseId, session?.id]);
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length]);
  useEffect(() => {
    if (!pendingAnimation || !onOpenAnimation) return;
    const savedSession = data.sessions.find(
      (item) => item.id === pendingAnimation.sessionId,
    );
    if (
      !savedSession?.messages.some(
        (message) => message.id === pendingAnimation.messageId,
      )
    )
      return;
    // The workspace validates the session before opening a tab. Wait until its
    // render can see the new session and saved answer, including the first ask.
    onOpenAnimation(pendingAnimation);
    setPendingAnimation(null);
  }, [pendingAnimation, data.sessions, onOpenAnimation]);
  useEffect(() => {
    const dismiss = (event) => {
      if (event.key === "Escape") {
        setSourcePicker(false);
        setSessionPicker(false);
        setSlashOpen(false);
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);

  function createSession() {
    if (isTeacher || !isEnrolled(data, courseId, user.id)) return;
    const next = {
      id: uid("session"),
      courseId,
      studentId: user.id,
      title: "New learning session",
      updatedAt: new Date().toISOString(),
      messages: [],
      animation: null,
    };
    setData((d) => ({ ...d, sessions: [next, ...d.sessions] }));
    setActiveSessionId(next.id);
    navigate("studio", { sessionId: next.id, courseId });
    setSessionPicker(false);
    setInput("");
    toast("A fresh space to explore.");
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  async function ask(value) {
    const question = (typeof value === "string" ? value : input).trim();
    if (
      !question ||
      asking ||
      isTeacher ||
      !isEnrolled(data, courseId, user.id)
    )
      return;
    setAsking(true);
    setStreaming("");
    setInput("");
    const targetId = session?.id || uid("session");
    if (!session)
      setData((previous) => ({
        ...previous,
        sessions: [
          {
            id: targetId,
            courseId,
            studentId: user.id,
            title: cleanTitle(question),
            messages: [],
            animation: null,
            updatedAt: new Date().toISOString(),
          },
          ...previous.sessions,
        ],
      }));
    const controller = new AbortController();
    requestAbort.current = controller;
    let finished = null;
    try {
      let failed = null;
      await streamChat(
        {
          sessionId: targetId,
          courseId,
          message: question,
          materialIds: selected.map((m) => m.id),
        },
        (type, event) => {
          if (type === "delta")
            setStreaming((text) => text + (event.text || ""));
          if (type === "error")
            failed = new Error(
              event.message ||
                event.error ||
                "The tutor response was interrupted.",
            );
          if (type === "done" && event.session) {
            finished = event.session;
            patchLocal((previous) => ({
              ...previous,
              sessions: [
                event.session,
                ...previous.sessions.filter(
                  (item) => item.id !== event.session.id,
                ),
              ],
            }));
          }
        },
        controller.signal,
      );
      if (failed) throw failed;
      setActiveSessionId(targetId);
      await refreshWorkspace();
      const wikiId = pendingWiki.current;
      pendingWiki.current = null;
      const answer = [...(finished?.messages || [])]
        .reverse()
        .find((message) => message.role === "assistant");
      if (wikiId && answer) await saveNote(answer, wikiId);
    } catch (error) {
      if (error.name !== "AbortError") {
        toast(error.message);
        setInput(question);
        await refreshWorkspace().catch(() => {});
      }
    } finally {
      setAsking(false);
      setStreaming("");
      requestAbort.current = null;
    }
  }

  function captureKey(messageId) {
    return session ? `agent:folio/${session.id}/${messageId}` : "";
  }
  async function saveNote(message = lastAnswer, wikiId = "") {
    if (!message || isTeacher || compiling || !session) return;
    if (!isEnrolled(data, courseId, user.id)) return;
    if (isMessageSaved(message.id, wikiId)) {
      const key = captureKey(message.id);
      const manifest = data.notes.find((note) => note.ledger === "manifest");
      const path = manifest?.manifest?.sources?.[key]?.pages_produced?.[0];
      const existing = data.notes.find(
        (note) => note.path === path || note.sourceMessageId === message.id,
      );
      toast(
        existing
          ? `Already in your Wiki: ${existing.path || existing.title}`
          : "This explanation is already in your Wiki.",
      );
      if (existing) navigate("wiki", { noteId: existing.id, courseId });
      return;
    }
    setCompiling(true);
    try {
      await flushChanges();
      const queued = await api("/api/wiki/capture", {
        method: "POST",
        body: {
          sessionId: session.id,
          messageId: message.id,
          courseId,
          ...(wikiId ? { wikiId } : {}),
        },
      });
      if (queued.already) {
        await refreshWorkspace();
        toast(`Already in your Wiki: ${queued.path || queued.title}`);
        if (queued.noteId)
          navigate("wiki", { noteId: queued.noteId, courseId });
        return;
      }
      let result = null;
      for (let attempt = 0; attempt < 180; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { job } = await api(`/api/jobs/${queued.jobId}`);
        if (job.status === "failed")
          throw new Error(job.error || "The wiki could not be compiled.");
        if (job.status === "succeeded") {
          result = job.result;
          break;
        }
      }
      if (!result) {
        toast("The wiki is still being compiled. Open My wiki again shortly.");
        return;
      }
      await refreshWorkspace();
      if (!result.saved) {
        toast(result.reason || "Nothing in this explanation was worth keeping.");
        return;
      }
      const verb = result.updated && !result.created ? "Updated" : "Saved to";
      toast(`${verb}: ${result.path} · ${result.title}`);
      setSavedMessageIds((ids) => [...ids, message.id]);
      if (result.noteId) navigate("wiki", { noteId: result.noteId, courseId });
    } catch (error) {
      toast(error.message);
    } finally {
      setCompiling(false);
    }
  }

  function isMessageSaved(messageId, wikiId = "") {
    const key = captureKey(messageId);
    return (
      (!wikiId && savedMessageIds.includes(messageId)) ||
      data.notes.some(
        (note) =>
          note.ledger === "manifest" &&
          (!wikiId || note.wikiId === wikiId) &&
          note.manifest?.sources?.[key],
      ) ||
      (!wikiId &&
        data.notes.some(
          (note) =>
            note.studentId === user.id && note.sourceMessageId === messageId,
        ))
    );
  }

  function selectSession(id) {
    const next = sessions.find((item) => item.id === id);
    if (!next || !canReadSession(data, actor, next)) return;
    setActiveSessionId(id);
    if (isTeacher)
      navigate("teacher-review", {
        courseId,
        studentId: next.studentId,
        sessionId: id,
        returnTo: route?.returnTo,
      });
    else navigate("studio", { sessionId: id, courseId });
    setSessionPicker(false);
  }
  async function visualize(message) {
    if (isTeacher || generating || !session) return;
    if (message.visualizationHtml) {
      onOpenAnimation?.({
        type: "html",
        html: message.visualizationHtml,
        sessionId: session.id,
        messageId: message.id,
        title: "Visual explanation",
      });
      return;
    }
    setGenerating(true);
    try {
      await flushChanges();
      const result = await api("/api/visualizations", {
        method: "POST",
        body: {
          sessionId: session.id,
          messageId: message.id,
          courseId,
          prompt: message.content.slice(0, 2000),
          materialIds: selected.map((m) => m.id),
        },
      });
      let completed = false;
      for (let attempt = 0; attempt < 180; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { job } = await api(`/api/jobs/${result.jobId}`);
        if (job.status === "failed")
          throw new Error(
            job.error || "The visual explanation could not be generated.",
          );
        if (job.status === "succeeded") {
          await refreshWorkspace();
          onOpenAnimation?.({
            type: "html",
            html: job.result.html,
            sessionId: session.id,
            messageId: message.id,
            title: "Visual explanation",
          });
          completed = true;
          break;
        }
      }
      if (!completed)
        toast(
          "The explanation is still being generated. Try opening it again shortly.",
        );
    } catch (error) {
      toast(error.message);
    } finally {
      setGenerating(false);
    }
  }
  const starterEvidence =
    allowedMaterials.find((m) => m.id === "m-transactions") ||
    allowedMaterials[0];

  function renderSources() {
    if (isTeacher)
      return (
        <span className="studio-review-source-count">
          <Library size={14} /> {allowedMaterials.length} available sources
        </span>
      );
    return (
      <div className="studio-material-control">
        <button
          className="studio-sources-toggle"
          onClick={() => setSourcePicker((p) => !p)}
          aria-expanded={sourcePicker}
        >
          <Library size={14} />
          {selected.length} {selected.length === 1 ? "source" : "sources"}
          <ChevronDown size={12} />
        </button>
        {sourcePicker && (
          <div className="studio-source-popover">
            <div className="studio-popover-title">
              Choose your sources
              <button
                className="icon-btn"
                aria-label="Close sources"
                onClick={() => setSourcePicker(false)}
              >
                <X size={14} />
              </button>
            </div>
            <p>
              Public course files + {isTeacher ? "this student’s" : "your"}{" "}
              personal files.
            </p>
            {allowedMaterials.length ? (
              allowedMaterials.map((m) => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={selected.some((s) => s.id === m.id)}
                    onChange={() =>
                      setSelectedIds((ids) => {
                        const current =
                          ids === null
                            ? allowedMaterials.map((a) => a.id)
                            : ids;
                        return current.includes(m.id)
                          ? current.filter((id) => id !== m.id)
                          : [...current, m.id];
                      })
                    }
                  />
                  <FileText size={16} />
                  <span>
                    {m.name}
                    <small>
                      {m.ownerId ? "Personal file" : "Course material"}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <div className="studio-source-empty">
                Upload course materials to add a source.
              </div>
            )}
            <button
              className="studio-source-manage"
              onClick={() => {
                setSourcePicker(false);
                if (onManageMaterials) onManageMaterials();
                else navigate("materials");
              }}
            >
              Manage materials
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`studio-page ${embedded ? "studio-embedded" : ""}`}>
      {!embedded && (
        <div className="studio-page-heading">
          <div>
            <div className="eyebrow">YOUR THINKING SPACE</div>
            <h1>
              Learning Studio<span className="studio-heading-dot">.</span>
            </h1>
            <p>Ask a little deeper. See it a little clearer.</p>
          </div>
          <div className="studio-heading-actions">
            <span className="studio-demo-label">
              <span /> Qwen · Check important answers
            </span>
            {!isTeacher && (
              <button
                className="btn btn-outline"
                onClick={() => navigate("wiki")}
              >
                <BookOpen size={16} /> My Wiki <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="studio-session-bar">
        <div className="studio-session-switch-wrap">
          <button
            className="studio-session-switch"
            onClick={() => setSessionPicker((p) => !p)}
            aria-expanded={sessionPicker}
          >
            <span className="studio-session-icon">
              <MessageSquare size={16} />
            </span>
            <span>
              {!embedded && (
                <small>
                  {isTeacher
                    ? `${sessionStudent.name}’s session`
                    : "CURRENT SESSION"}
                </small>
              )}
              <strong>{session?.title || "New learning session"}</strong>
            </span>
            <ChevronDown size={15} />
          </button>
          {sessionPicker && (
            <div className="studio-session-popover">
              <div className="studio-popover-title">
                Learning sessions <span>{sessions.length}</span>
              </div>
              {sessions.length ? (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    className={s.id === session?.id ? "active" : ""}
                    onClick={() => selectSession(s.id)}
                  >
                    <MessageSquare size={14} />
                    <span>
                      {s.title}
                      <small>
                        {
                          (data.students || []).find(
                            (st) => st.id === s.studentId,
                          )?.name
                        }{" "}
                        · {s.messages.length} messages
                      </small>
                    </span>
                    {s.id === session?.id && <Check size={14} />}
                  </button>
                ))
              ) : (
                <p>No sessions yet.</p>
              )}
              {!isTeacher && (
                <button className="studio-new-in-menu" onClick={createSession}>
                  <Plus size={15} /> Start a new session
                </button>
              )}
            </div>
          )}
        </div>
        <div className="studio-session-options">
          {embedded && renderSources()}
          {isTeacher ? (
            <>
              <span className="studio-readonly">
                <LockKeyhole size={13} /> Read-only
              </span>
            </>
          ) : (
            <>
              <span className="studio-private">
                <LockKeyhole size={12} /> Yours, with teacher visibility
              </span>
              <button
                className="icon-btn"
                title="New session"
                aria-label="Start a new learning session"
                onClick={createSession}
              >
                <Plus size={18} />
              </button>
            </>
          )}
          {!embedded && (
            <button
              className={`icon-btn ${showExplainer ? "studio-toggle-active" : ""}`}
              title="Toggle visual explainer"
              aria-label="Toggle visual explainer"
              aria-pressed={showExplainer}
              onClick={() => setShowExplainer((x) => !x)}
            >
              <PanelRight size={17} />
            </button>
          )}
        </div>
      </div>
      {isTeacher && (
        <div className="studio-teacher-notice">
          <LockKeyhole size={14} />
          <span>
            <strong>
              {session ? sessionStudent.name : "Session unavailable"}
              {session && ` · ${sessionStudent.studentId || "Student"}`}
            </strong>
            {session
              ? " · Session review. Messages and uploaded files are read-only."
              : " · Select an accessible student session to review."}
          </span>
        </div>
      )}
      <div
        className={`studio-workspace ${embedded || !showExplainer ? "explainer-hidden" : ""}`}
      >
        <section
          className="studio-chat-panel"
          aria-label="Course assistant conversation"
        >
          {!embedded && (
            <div className="studio-chat-top">
              <div className="studio-assistant-title">
                <span className="studio-ai-symbol">
                  <Sparkles size={17} />
                </span>
                <div>
                  <strong>Course companion</strong>
                  <span>Grounded in your selected materials</span>
                </div>
              </div>
              {renderSources()}
            </div>
          )}
          <div className="studio-chat-feed" ref={feedRef}>
            {!embedded && (
              <div className="studio-chat-date">
                <span />
                {messages.length
                  ? "A LITTLE CURIOSITY GOES A LONG WAY"
                  : "START WITH A QUESTION"}
                <span />
              </div>
            )}
            {!messages.length && (
              <div className="studio-welcome">
                <span className="studio-welcome-mark">
                  <Sparkles size={25} />
                </span>
                <h2>
                  {embedded
                    ? isTeacher
                      ? "No messages to review"
                      : "What would you like to understand?"
                    : "What’s on your mind?"}
                </h2>
                <p>
                  {embedded
                    ? isTeacher
                      ? "This session has no recorded conversation yet."
                      : "Ask about your course files, explore an idea, or create a visual explanation."
                    : "Your course materials are here. Let’s turn a tricky concept into something that clicks."}
                </p>
                {!isTeacher && (
                  <div className="studio-starters">
                    {suggestedQuestions.map((s, i) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        disabled={isTeacher || asking}
                      >
                        <span>
                          {
                            [
                              "Understand a concept",
                              "See the bigger picture",
                              "Explore an example",
                            ][i]
                          }
                        </span>
                        {s}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`studio-message ${message.role === "user" ? "from-user" : "from-assistant"}`}
              >
                {message.role === "assistant" && (
                  <span className="studio-message-avatar">
                    <Sparkles size={16} />
                  </span>
                )}
                <div className="studio-message-body">
                  {message.role === "assistant" && (
                    <div className="studio-message-author">
                      Folio <span>COURSE COMPANION</span>
                    </div>
                  )}
                  <div className="studio-message-content">
                    {message.role === "assistant" ? (
                      <ChatMarkdown text={message.content} />
                    ) : (
                      message.content.split("\n\n").map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))
                    )}
                  </div>
                  {!!message.sources?.length && (
                    <div className="studio-message-sources">
                      {message.sources.map((source, i) => (
                        <button
                          key={`${source.materialId}-${source.page}-${i}`}
                          onClick={() =>
                            openMaterial(source.materialId, source.page)
                          }
                        >
                          <FileText size={12} />
                          <span>{source.name}</span>
                          <b>p. {source.page}</b>
                          <ArrowUpRight size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                  {message.role === "assistant" && (
                    <div className="studio-message-actions">
                      {!isTeacher && (
                        <button
                          onClick={() => visualize(message)}
                          disabled={generating}
                        >
                          <SquarePlay size={13} />{" "}
                          {generating ? "Generating…" : "Visualize"}
                        </button>
                      )}
                      {!isTeacher && (
                        <button
                          onClick={() => saveNote(message)}
                          disabled={compiling}
                        >
                          {isMessageSaved(message.id) ? (
                            <Check size={13} />
                          ) : (
                            <BookOpen size={13} />
                          )}{" "}
                          {compiling
                            ? "Compiling…"
                            : isMessageSaved(message.id)
                              ? "Saved to Wiki"
                              : "Save to Wiki"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <span className="studio-user-avatar">
                    {sessionStudent.initials || sessionStudent.name?.[0]}
                  </span>
                )}
              </div>
            ))}
          </div>
          {asking && (
            <div className="chat-streaming" role="status" aria-live="polite">
              {streaming || "Reading your sources…"}
            </div>
          )}
          {!isTeacher ? (
            <div className="studio-composer-area">
              {slashOpen && (
                <div className="studio-slash" role="listbox" aria-label="Choose a wiki to update">
                  <p>Update a wiki with {input.replace(/^\/\w*\s*/, "").trim() ? "this question" : "the latest answer"}</p>
                  {(data.notes || [])
                    .filter((note) => note.wikiRoot && note.studentId === user.id)
                    .map((wiki) => (
                      <button
                        type="button"
                        key={wiki.id}
                        onClick={() => {
                          const question = input.replace(/^\/capture\s*/i, "").replace(/^\//, "").trim();
                          setSlashOpen(false);
                          setInput("");
                          if (question) {
                            pendingWiki.current = wiki.id;
                            ask(question);
                          } else if (lastAnswer) saveNote(lastAnswer, wiki.id);
                          else toast("Ask something after /capture, or get an answer first.");
                        }}
                      >
                        <BookOpen size={14} />
                        <span>
                          {wiki.title}
                          <small>
                            {data.courses.find((course) => course.id === wiki.courseId)?.code || "Wiki"}
                          </small>
                        </span>
                      </button>
                    ))}
                  {!(data.notes || []).some((note) => note.wikiRoot && note.studentId === user.id) && (
                    <p>Create a wiki from My wiki first.</p>
                  )}
                </div>
              )}
              <form
                className="studio-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (input.trim().startsWith("/")) return;
                  ask();
                }}
              >
                <label className="sr-only" htmlFor="studio-question">
                  Ask about your course materials
                </label>
                <textarea
                  id="studio-question"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => {
                    const next = event.target.value;
                    setInput(next);
                    setSlashOpen(next.startsWith("/"));
                  }}
                  placeholder={
                    embedded
                      ? "Ask about this course, or /capture"
                      : "Ask anything about your course, or /capture"
                  }
                  rows={2}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!input.trim().startsWith("/")) ask();
                    }
                  }}
                />
                <div className="studio-composer-bottom">
                  <button
                    type="button"
                    onClick={() => setSourcePicker((p) => !p)}
                  >
                    <Plus size={16} />
                    <span>Sources</span>
                  </button>
                  <span>Shift + Enter for a new line</span>
                  <button
                    type="submit"
                    className="studio-send"
                    aria-label="Send question"
                    disabled={asking || !input.trim()}
                  >
                    <ArrowUp size={19} />
                  </button>
                </div>
              </form>
              <div className="studio-composer-note">
                <LockKeyhole size={11} /> Your teacher can view this session
                <span>·</span> Qwen · Check important answers
              </div>
            </div>
          ) : (
            <div className="studio-view-only">
              <LockKeyhole size={14} /> Teacher view · Explore the session
              without editing it.
            </div>
          )}
        </section>
        {!embedded && showExplainer && (
          <aside className="studio-insight-panel">
            <div className="studio-insight-heading">
              <span>
                <WandSparkles size={15} /> Make it visual
              </span>
              <span className="studio-live-chip">Learning by doing</span>
            </div>
            {animationType ? (
              <LearningAnimation
                key={`${session?.id}-${animationType}`}
                type={animationType}
              />
            ) : (
              <div className="studio-animation-empty">
                <span className="studio-empty-orbit">
                  <SquarePlay size={30} />
                </span>
                <span className="studio-empty-kicker">
                  YOUR ANIMATION CANVAS
                </span>
                <h3>See the idea unfold.</h3>
                <p>
                  Ask about a concept to explore a related visual explanation.
                  Use Visualize on an answer to generate an interactive
                  explanation.
                </p>
                <div className="studio-demo-choices">
                  <button
                    onClick={() => {
                      setSelectedVisual({
                        sessionId: session?.id,
                        type: "race",
                      });
                      setShowExplainer(true);
                    }}
                  >
                    <SquarePlay size={15} />
                    <span>
                      Preview inventory demo
                      <small>Race conditions & row locks</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedVisual({
                        sessionId: session?.id,
                        type: "request",
                      });
                      setShowExplainer(true);
                    }}
                  >
                    <SquarePlay size={15} />
                    <span>
                      Preview browser demo
                      <small>URL → request → rendered page</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            )}
            {!isTeacher && (
              <div className="studio-takeaway">
                <span className="studio-takeaway-icon">
                  <BookOpen size={17} />
                </span>
                <div>
                  <div className="studio-takeaway-heading">
                    From a moment to a mental model
                  </div>
                  <p>
                    Keep the explanation. Connect it to what you already know.
                  </p>
                  <button
                    disabled={isTeacher || !lastAnswer || compiling}
                    onClick={() => saveNote()}
                  >
                    {isTeacher
                      ? "Student Wiki is read-only"
                      : compiling
                        ? "Compiling…"
                        : "Add this insight to my Wiki"}
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            )}
            <div className="studio-source-card">
              <span className="studio-source-card-label">
                <Link2 size={12} /> CONNECTED TO YOUR COURSE
              </span>
              <button
                disabled={!starterEvidence}
                onClick={() =>
                  starterEvidence && openMaterial(starterEvidence.id, 1)
                }
              >
                <span className="studio-pdf-icon">
                  <FileText size={18} />
                </span>
                <div>
                  <strong>
                    {starterEvidence?.name || "Add your first course material"}
                  </strong>
                  <span>
                    {starterEvidence
                      ? `${starterEvidence.pages?.length || 1} pages · Course resource`
                      : "Your source of understanding"}
                  </span>
                </div>
                <ArrowUpRight size={14} />
              </button>
            </div>
            <p className="studio-demo-explainer">
              An authored, interactive HTML teaching demo. Generated
              explanations use local document retrieval; no live AI is
              connected.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
