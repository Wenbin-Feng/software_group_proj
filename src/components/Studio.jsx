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

function findEvidence(question, materials) {
  const stop = new Set([
    "this",
    "that",
    "with",
    "what",
    "when",
    "have",
    "does",
    "from",
    "your",
    "about",
    "could",
    "would",
    "please",
    "explain",
    "they",
    "there",
    "their",
    "into",
    "will",
    "then",
    "them",
  ]);
  const tokens =
    question
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter((x) => !stop.has(x)) || [];
  const translations = [
    [
      /并发|超卖|库存|锁|事务|隔离/,
      ["transaction", "stock", "concurrency", "isolation"],
    ],
    [/原子/, ["atomicity", "atomic"]],
    [/浏览器|网页|请求|域名/, ["browser", "request", "hostname"]],
    [/需求|验收/, ["requirement", "acceptance"]],
    [/代理|智能体|委派/, ["agent", "delegation"]],
  ];
  translations.forEach(([pattern, terms]) => {
    if (pattern.test(question)) tokens.push(...terms);
  });
  let results = [];
  materials.forEach((material) => {
    const pages = material.pages?.length
      ? material.pages
      : [{ page: 1, text: material.text || "" }];
    pages.forEach((page) => {
      const body = page.text || "";
      const score = tokens.reduce(
        (sum, token) => sum + (body.toLowerCase().includes(token) ? 1 : 0),
        0,
      );
      if (score > 0)
        results.push({
          materialId: material.id,
          name: material.name,
          page: page.page || 1,
          text: body,
          score,
        });
    });
  });
  return results.sort((a, b) => b.score - a.score).slice(0, 2);
}

function demoResponse(question, evidence) {
  const q = question.toLowerCase();
  const concurrency =
    /concurr|race|stock|lock|transaction|isolation|last item|two requests|oversell|并发|库存|事务|锁|超卖/.test(
      q,
    );
  const webRequest =
    /browser|http|url|dns|render|cssom|web request|网页|浏览器/.test(q);
  if (!evidence.length)
    return {
      content:
        "I couldn’t find a matching passage in the selected materials. Try selecting a relevant document or asking about a specific term from your course.\n\nThis prototype searches the text of your selected documents. It has no live language model connected.",
      animation: null,
    };
  const excerpt = evidence[0].text.replace(/\s+/g, " ").trim().slice(0, 320);
  let content;
  if (/atomicity|原子性/.test(q))
    content =
      "Atomicity means a transaction completes as one unit: either all of its operations take effect, or none of them do.\n\nFor example, creating an order and decrementing stock should succeed together. If one step fails, the transaction rolls back its earlier changes.\n\nAtomicity and isolation answer different questions. Atomicity handles partial completion; isolation controls how concurrent transactions interact. Read the cited ACID definitions for this distinction.";
  else if (/isolat|隔离/.test(q))
    content =
      "Think of isolation as the rules for what one transaction can see while another is still working.\n\nFor example, if two requests read the same stock value before either finishes, both may believe an item is available. Stronger isolation or an appropriate lock can prevent the read-and-update operations from interfering.\n\nThe exact behavior depends on the database and isolation level. The animation models one explicit row lock: request B waits, then reads the updated stock.";
  else if (/lock|锁/.test(q))
    content =
      "A lock gives one transaction exclusive access to the shared stock row while it checks and updates that row.\n\n1. Request A acquires the lock and reads stock = 1.\n2. Request B waits while A confirms its order and writes stock = 0.\n3. After A commits, B reads the current value: 0. Its order is rejected.\n\nTry switching “Protect with a lock” on in the visual explainer. Watch how the order of events changes.";
  else if (concurrency)
    content =
      "The problem is the gap between checking the stock and updating it.\n\nBoth requests can read stock = 1 before either one writes a change. Each request passes its own check and confirms an order. They both write stock = 0, leaving two successful orders for just one item.\n\nA lock can protect the check and update as one transaction. The second request then waits and reads the updated value. Explore both versions in the animation.";
  else if (webRequest)
    content =
      "A browser turns a URL into a visible page through a sequence of connected steps.\n\n1. DNS resolves the hostname to an IP address.\n2. The browser establishes a connection and sends an HTTP request.\n3. The server returns a response containing HTML.\n4. The browser parses the HTML and loads styles, scripts and images.\n5. It builds the DOM and CSSOM, then lays out and paints the page.\n\nStep through the browser animation to follow the request. This is an illustrative HTTP teaching demo; real browsers can cache resources and reuse connections.";
  else
    content = `Here is the closest passage in your selected materials:\n\n“${excerpt}${evidence[0].text.length > 320 ? "…" : ""}”\n\nOpen the reference below to read it in context. You can ask a more focused question, or save this passage to your Wiki.\n\nThis is a source-retrieval demo; a connected language model would turn this evidence into a tailored explanation.`;
  return {
    content,
    animation: concurrency ? "race" : webRequest ? "request" : null,
  };
}

export default function Studio({
  embedded = false,
  onOpenAnimation,
  onManageMaterials,
}) {
  const {
    data,
    setData,
    courseId,
    course,
    user,
    role,
    activeSessionId,
    setActiveSessionId,
    navigate,
    toast,
    openMaterial,
  } = useApp();
  const isTeacher = role === "teacher";
  const allSessions = (data.sessions || []).filter(
    (s) => s.courseId === courseId && (isTeacher || s.studentId === user.id),
  );
  const [teacherStudentId, setTeacherStudentId] = useState("all");
  const sessions = allSessions.filter(
    (s) =>
      teacherStudentId === "all" ||
      !isTeacher ||
      s.studentId === teacherStudentId,
  );
  const requestedSession = allSessions.find((s) => s.id === activeSessionId);
  const session = requestedSession || sessions[0];
  const sessionStudent =
    (data.students || []).find((s) => s.id === session?.studentId) || user;
  const allowedMaterials = (data.materials || []).filter(
    (m) =>
      m.courseId === courseId &&
      (!m.ownerId || m.ownerId === (isTeacher ? session?.studentId : user.id)),
  );
  const [selectedIds, setSelectedIds] = useState(null);
  const [input, setInput] = useState("");
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
    if (
      isTeacher &&
      requestedSession &&
      teacherStudentId !== "all" &&
      requestedSession.studentId !== teacherStudentId
    )
      setTeacherStudentId(requestedSession.studentId);
  }, [
    isTeacher,
    requestedSession?.id,
    requestedSession?.studentId,
    teacherStudentId,
  ]);
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
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);

  function createSession() {
    if (isTeacher) return;
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

  function ask(value) {
    const question = (typeof value === "string" ? value : input).trim();
    if (!question || isTeacher) return;
    const targetId = session?.id || uid("session");
    const now = new Date().toISOString();
    const entry = { id: uid("msg"), role: "user", content: question };
    const evidence = findEvidence(question, selected);
    const result = demoResponse(question, evidence);
    const answer = {
      id: uid("msg"),
      role: "assistant",
      content: result.content,
      animation: result.animation,
      sources: evidence.map(({ materialId, name, page }) => ({
        materialId,
        name,
        page,
      })),
    };
    // Retrieval is synchronous. Save the complete exchange together so navigation
    // or a refresh can never leave a persisted question without its demo response.
    setData((d) => {
      const existing = d.sessions.find((s) => s.id === targetId);
      return {
        ...d,
        sessions: existing
          ? d.sessions.map((s) =>
              s.id === targetId
                ? {
                    ...s,
                    title:
                      s.messages.length === 0 ? cleanTitle(question) : s.title,
                    messages: [...s.messages, entry, answer],
                    animation: result.animation,
                    updatedAt: now,
                  }
                : s,
            )
          : [
              {
                id: targetId,
                courseId,
                studentId: user.id,
                title: cleanTitle(question),
                messages: [entry, answer],
                animation: result.animation,
                updatedAt: now,
              },
              ...d.sessions,
            ],
      };
    });
    setActiveSessionId(targetId);
    setInput("");
    setSelectedVisual(null);
    if (result.animation) {
      if (onOpenAnimation)
        setPendingAnimation({
          type: result.animation,
          messageId: answer.id,
          sessionId: targetId,
          title:
            result.animation === "race"
              ? "Race conditions & row locks"
              : "From URL to rendered page",
        });
      if (!embedded) setShowExplainer(true);
    }
  }

  function saveNote(message = lastAnswer) {
    if (!message || isTeacher) return;
    if (isMessageSaved(message.id)) {
      toast("This explanation is already in your Wiki.");
      return;
    }
    const id = uid("note");
    const isConcurrency =
      /concurr|stock|lock|transaction|并发|库存|事务|锁/.test(
        message.content.toLowerCase(),
      );
    const topic = isConcurrency
      ? "Concurrency & database locks"
      : session?.title || "Learning note";
    const sources = (message.sources || [])
      .map((s) => `- ${s.name}, page ${s.page}`)
      .join("\n");
    const sourceIds = (message.sources || []).map((s) => s.materialId);
    const relatedNotes = data.notes
      .filter(
        (n) =>
          n.courseId === courseId &&
          n.studentId === user.id &&
          (sourceIds.includes(n.source?.materialId) ||
            (isConcurrency &&
              /race|isolation|atomic|transaction|concurr/i.test(n.title))),
      )
      .slice(0, 3);
    const note = {
      id,
      courseId,
      studentId: user.id,
      title: topic,
      category: isConcurrency ? "Database systems" : "Concepts",
      content: `# ${topic}\n\n${message.content}${relatedNotes.length ? `\n\n## Connections\n\n${relatedNotes.map((n) => `[[${n.title}]]`).join(" · ")}` : ""}\n\n## Sources\n\n${sources || "Saved from a learning session."}`,
      tags: ["learning", "session"],
      links: relatedNotes.map((n) => n.id),
      hasAnimation: !!messageAnimation(message),
      animation: messageAnimation(message),
      source: message.sources?.[0],
      sourceSessionId: session?.id,
      sourceMessageId: message.id,
      updatedAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, notes: [note, ...d.notes] }));
    setSavedMessageIds((ids) => [...ids, message.id]);
    toast("Explanation saved to your personal Wiki.");
  }

  function isMessageSaved(messageId) {
    return (
      savedMessageIds.includes(messageId) ||
      data.notes.some(
        (n) => n.studentId === user.id && n.sourceMessageId === messageId,
      )
    );
  }

  function selectSession(id) {
    setActiveSessionId(id);
    navigate("studio", { sessionId: id });
    setSessionPicker(false);
  }
  function filterTeacherSessions(studentId) {
    setTeacherStudentId(studentId);
    const matches = (item) =>
      studentId === "all" || item.studentId === studentId;
    const next =
      allSessions.find(
        (item) => item.id === activeSessionId && matches(item),
      ) || allSessions.find(matches);
    navigate("studio", { courseId, sessionId: next?.id });
  }
  function visualize(message) {
    const type = messageAnimation(message);
    if (!type) return;
    if (onOpenAnimation)
      onOpenAnimation({
        type,
        sessionId: session?.id,
        messageId: message.id,
        title:
          type === "race"
            ? "Race conditions & row locks"
            : "From URL to rendered page",
      });
    if (!embedded) {
      setSelectedVisual({
        sessionId: session?.id,
        messageId: message.id,
        type,
      });
      setShowExplainer(true);
    }
  }
  const starterEvidence =
    allowedMaterials.find((m) => m.id === "m-transactions") ||
    allowedMaterials[0];

  function renderSources() {
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
              <span /> Demo responses
            </span>
            <button
              className="btn btn-outline"
              onClick={() => navigate("wiki")}
            >
              <BookOpen size={16} /> My Wiki <ArrowUpRight size={14} />
            </button>
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
              <select
                aria-label="Filter sessions by student"
                value={teacherStudentId}
                onChange={(e) => filterTeacherSessions(e.target.value)}
              >
                <option value="all">All students</option>
                {(data.students || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
      {isTeacher && !embedded && (
        <div className="studio-teacher-notice">
          <LockKeyhole size={14} />
          <span>
            You are viewing {sessionStudent.name}’s learning session. Messages,
            files and Wiki notes stay attributed to this student.
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
                    ? "What would you like to understand?"
                    : "What’s on your mind?"}
                </h2>
                <p>
                  {embedded
                    ? "Ask about your course files, explore an idea, or create a visual explanation."
                    : "Your course materials are here. Let’s turn a tricky concept into something that clicks."}
                </p>
                <div className="studio-starters">
                  {suggestedQuestions.map((s, i) => (
                    <button key={s} onClick={() => ask(s)} disabled={isTeacher}>
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
                    {message.content.split("\n\n").map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
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
                      {messageAnimation(message) && (
                        <button onClick={() => visualize(message)}>
                          <SquarePlay size={13} /> Visualize
                        </button>
                      )}
                      {!isTeacher && (
                        <button onClick={() => saveNote(message)}>
                          {isMessageSaved(message.id) ? (
                            <Check size={13} />
                          ) : (
                            <BookOpen size={13} />
                          )}{" "}
                          {isMessageSaved(message.id)
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
          {!isTeacher ? (
            <div className="studio-composer-area">
              <form
                className="studio-composer"
                onSubmit={(e) => {
                  e.preventDefault();
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
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    embedded
                      ? "Ask about this course…"
                      : "Ask anything about your course…"
                  }
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask();
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
                    disabled={!input.trim()}
                  >
                    <ArrowUp size={19} />
                  </button>
                </div>
              </form>
              <div className="studio-composer-note">
                <LockKeyhole size={11} /> Your teacher can view this session
                <span>·</span> Demo responses
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
                  This prototype includes two authored interactive demos.
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
                  disabled={isTeacher || !lastAnswer}
                  onClick={() => saveNote()}
                >
                  {isTeacher
                    ? "Student Wiki is read-only"
                    : "Add this insight to my Wiki"}
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
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
