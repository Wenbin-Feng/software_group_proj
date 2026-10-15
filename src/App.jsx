import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MessageSquare,
  Network,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { AppContext, useApp } from "./context";
import { initialData } from "./data";
import { Modal, Avatar } from "./components/ui";
import Studio from "./components/Studio";
import Wiki from "./components/Wiki";
import Market from "./components/Market";
import Materials from "./components/Materials";
import Teacher from "./components/Teacher";
import { getOriginal } from "./lib/originals";

const STORAGE = "folio-workspace-v1";
const navItems = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "studio", name: "Learning studio", icon: Sparkles },
  { id: "materials", name: "Course materials", icon: FolderOpen },
  { id: "wiki", name: "My wiki", icon: Network },
  { id: "market", name: "Wiki market", icon: Store },
];

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (
      saved?.courses?.length &&
      Array.isArray(saved.sessions) &&
      Array.isArray(saved.notes) &&
      Array.isArray(saved.market) &&
      Array.isArray(saved.students)
    )
      return saved;
  } catch {
    /* A fresh workspace is safe when storage is unavailable. */
  }
  return structuredClone(initialData);
}

function readRoute() {
  const [path, query] = location.hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  return {
    view: [...navItems.map((x) => x.id), "teacher"].includes(path)
      ? path
      : "overview",
    sessionId: params.get("session"),
    noteId: params.get("note"),
  };
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem("folio-course") || "se",
  );
  const [role, setRole] = useState("student");
  const [userId, setUserId] = useState("wenbin");
  const [view, setView] = useState(() => readRoute().view);
  const [activeSessionId, setActiveSessionId] = useState(
    () => readRoute().sessionId,
  );
  const [activeNoteId, setActiveNoteId] = useState(() => readRoute().noteId);
  const [dialog, setDialog] = useState(null);
  const [preview, setPreview] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const user =
    data.students.find((student) => student.id === userId) || data.students[0];
  const course =
    data.courses.find((item) => item.id === courseId) || data.courses[0];
  const toast = useCallback((message) => setToastMessage(message), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
    } catch {
      setToastMessage(
        "Browser storage is full. Your latest changes will not survive a refresh.",
      );
    }
  }, [data]);
  useEffect(() => {
    try {
      localStorage.setItem("folio-course", course.id);
    } catch {
      /* Optional preference. */
    }
  }, [course.id]);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  useEffect(() => {
    const handler = () => {
      const route = readRoute();
      setView(route.view);
      if (route.sessionId) setActiveSessionId(route.sessionId);
      if (route.noteId) setActiveNoteId(route.noteId);
      setMobileOpen(false);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog("search");
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setCourseOpen(false);
        setNotifications(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navigate = useCallback((next, params = {}) => {
    setView(next);
    if (params.sessionId) setActiveSessionId(params.sessionId);
    if (params.noteId) setActiveNoteId(params.noteId);
    const search = new URLSearchParams();
    if (params.sessionId) search.set("session", params.sessionId);
    if (params.noteId) search.set("note", params.noteId);
    location.hash = `/${next}${search.size ? `?${search}` : ""}`;
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  function switchCourse(id) {
    setCourseId(id);
    setCourseOpen(false);
    setActiveSessionId(null);
    setActiveNoteId(null);
    navigate("overview");
  }
  function openMaterial(id, page = 1) {
    const material = data.materials.find((item) => item.id === id);
    if (
      !material ||
      material.courseId !== course.id ||
      (role !== "teacher" && material.ownerId && material.ownerId !== user.id)
    )
      return toast("This material is not available in your learning space.");
    setPreview({ id, page });
  }

  const context = {
    data,
    setData,
    courseId: course.id,
    course,
    user,
    role,
    view,
    activeSessionId,
    setActiveSessionId,
    activeNoteId,
    setActiveNoteId,
    navigate,
    toast,
    openMaterial,
  };
  const currentLabel =
    navItems.find((item) => item.id === view)?.name || "Teaching overview";
  const noteCount = data.notes.filter(
    (note) => note.courseId === course.id && note.studentId === user.id,
  ).length;

  return (
    <AppContext.Provider value={context}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="Folio home"
        >
          <span className="brand-mark">
            <Layers3 size={23} strokeWidth={1.7} />
          </span>
          <span>
            folio<span className="brand-dot">.</span>
          </span>
          <span className="brand-beta">BETA</span>
        </button>
        <div className="course-switch-wrap">
          <button
            className="course-switch"
            onClick={() => setCourseOpen(!courseOpen)}
            aria-expanded={courseOpen}
            aria-label="Choose course"
          >
            <span className="course-monogram">
              {course.name
                .split(" ")
                .slice(0, 2)
                .map((word) => word[0])
                .join("")}
            </span>
            <span>
              <small>YOUR COURSE</small>
              <strong>{course.name}</strong>
            </span>
            <ChevronDown size={15} />
          </button>
          {courseOpen && (
            <div className="course-menu">
              {data.courses.map((item) => (
                <button key={item.id} onClick={() => switchCourse(item.id)}>
                  <BookOpen size={17} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.code} · {item.term}
                    </small>
                  </span>
                  {course.id === item.id && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.name}</span>
              {item.id === "wiki" && (
                <span className="nav-count">{noteCount}</span>
              )}
              {item.id === "market" && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>
        {role === "teacher" && (
          <>
            <div className="nav-label teaching-label">TEACHING</div>
            <button
              className={`nav-item ${view === "teacher" ? "active" : ""}`}
              aria-current={view === "teacher" ? "page" : undefined}
              onClick={() => navigate("teacher")}
            >
              <Users size={19} />
              <span>Student activity</span>
            </button>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-spark">
              <Sparkles size={17} />
            </span>
            <strong>Small insights. Lasting knowledge.</strong>
            <p>Turn a good conversation into a page worth keeping.</p>
            <button onClick={() => navigate("wiki")}>
              Open your wiki <ArrowRight size={14} />
            </button>
          </div>
          <button className="help-link" onClick={() => setDialog("about")}>
            <CircleHelp size={17} />A little help
            <span className="demo-dot" />
            Local demo
          </button>
          <button
            className="profile"
            onClick={() => setDialog("identity")}
            aria-label="Switch demo role or student"
          >
            <Avatar
              initials={role === "teacher" ? "RL" : user.initials}
              color={role === "teacher" ? "#f6ddc4" : user.color}
            />
            <span>
              <strong>{role === "teacher" ? "Richard Lui" : user.name}</strong>
              <small>
                {role === "teacher"
                  ? "Instructor workspace"
                  : `Student · ${user.studentId}`}
              </small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>{course.code || "COURSE"}</span>
            <ChevronRight size={14} />
            <strong>{currentLabel}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => setDialog("search")}
              aria-label="Search your workspace"
            >
              <Search size={16} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="topbar-divider" />
            <button
              className={`role-toggle ${role === "teacher" ? "is-teacher" : ""}`}
              onClick={() => setDialog("identity")}
            >
              <GraduationCap size={16} />
              <span>
                {role === "teacher" ? "Instructor view" : "Student view"}
              </span>
              <ChevronDown size={13} />
            </button>
            <div className="notification-wrap">
              <button
                className="icon-btn notification-btn"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                <i />
              </button>
              {notifications && (
                <div className="notifications-popover">
                  <strong>You’re all caught up.</strong>
                  <p>Your course updates and wiki activity will appear here.</p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setNotifications(false);
                      navigate("market");
                    }}
                  >
                    Explore the course community <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className={`page-container page-${view}`}
          key={`${view}-${course.id}`}
        >
          {view === "overview" && <Overview />}
          {view === "studio" && <Studio />}
          {view === "materials" && <Materials />}
          {view === "wiki" && <Wiki />}
          {view === "market" && <Market />}
          {view === "teacher" && <Teacher />}
        </main>
        <footer className="app-footer">
          <span>A little more understanding, every day.</span>
          <span>
            <span className="status-dot" /> Workspace stored in this browser
          </span>
        </footer>
      </div>
      {toastMessage && (
        <div className="app-toast" role="status">
          <CheckCheck size={18} />
          <span>{toastMessage}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToastMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === "search" && <SearchDialog onClose={() => setDialog(null)} />}
      {dialog === "about" && (
        <Modal
          title="A space to make things click."
          subtitle="Folio · Wenbin’s independent prototype"
          onClose={() => setDialog(null)}
        >
          <div className="about-content">
            <div className="about-symbol">
              <Layers3 size={36} />
            </div>
            <p>
              Explore course materials, ask questions, learn through interactive
              explanations, and build a wiki that grows with you.
            </p>
            <div className="notice-box">
              <Lightbulb size={20} />
              <div>
                <strong>You’re exploring a local prototype.</strong>
                <p>
                  Course content and students are examples. PDF parsing, notes,
                  publishing, and bookmarks work in your browser. Tutor answers
                  use local source excerpts and prepared explanations; animation
                  scenes are interactive demos, without a connected language
                  model.
                </p>
              </div>
            </div>
            <p className="muted">
              The role switcher demonstrates different views. It is not a secure
              login system. Uploaded text and workspace changes stay in this
              browser.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "identity" && (
        <Modal
          title="Explore another perspective"
          subtitle="Choose a demo identity to try the learning and teaching flows."
          onClose={() => setDialog(null)}
        >
          <div className="identity-options">
            <div className="eyebrow">STUDENT WORKSPACES</div>
            {data.students.map((student) => (
              <button
                key={student.id}
                className={`identity-option ${role === "student" && user.id === student.id ? "selected" : ""}`}
                onClick={() => {
                  setUserId(student.id);
                  setRole("student");
                  setActiveSessionId(null);
                  setActiveNoteId(null);
                  setDialog(null);
                  navigate("overview");
                }}
              >
                <Avatar {...student} />
                <span>
                  <strong>{student.name}</strong>
                  <small>{student.studentId} · Own sessions and wiki</small>
                </span>
                {role === "student" && user.id === student.id && (
                  <Check size={19} />
                )}
              </button>
            ))}
            <div className="eyebrow identity-teacher-label">
              INSTRUCTOR WORKSPACE
            </div>
            <button
              className={`identity-option ${role === "teacher" ? "selected" : ""}`}
              onClick={() => {
                setRole("teacher");
                setDialog(null);
                navigate("teacher");
              }}
            >
              <Avatar initials="RL" color="#f6ddc4" />
              <span>
                <strong>Richard Lui</strong>
                <small>Course materials and all student sessions</small>
              </span>
              <ShieldCheck size={19} />
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <MaterialPreview
          preview={preview}
          setPreview={setPreview}
          onClose={() => setPreview(null)}
        />
      )}
    </AppContext.Provider>
  );
}

function Overview() {
  const {
    data,
    courseId,
    course,
    user,
    role,
    setData,
    navigate,
    openMaterial,
  } = useApp();
  const sessions = data.sessions.filter(
    (session) => session.courseId === courseId && session.studentId === user.id,
  );
  const notes = data.notes.filter(
    (note) => note.courseId === courseId && note.studentId === user.id,
  );
  const materials = data.materials.filter(
    (item) => item.courseId === courseId && !item.ownerId,
  );
  const featured = data.market
    .filter((item) => item.courseId === courseId)
    .slice(0, 2);
  const [tab, setTab] = useState("all");
  function newSession() {
    const id = `session-${crypto.randomUUID()}`;
    setData((previous) => ({
      ...previous,
      sessions: [
        {
          id,
          courseId,
          studentId: user.id,
          title: "A new curiosity",
          updatedAt: new Date().toISOString(),
          messages: [],
          animation: null,
        },
        ...previous.sessions,
      ],
    }));
    navigate("studio", { sessionId: id });
  }
  return (
    <div className="overview-page page-enter">
      <div className="overview-greeting">
        <span>YOUR COURSE COMPANION</span>
        <span className="semester-tag">
          <span className="status-dot" />
          {course.term || "Fall 2026"}
        </span>
      </div>
      <div className="overview-title-row">
        <div>
          <h1>
            Welcome back, {user.name.split(" ")[0]}
            <span className="blue-period">.</span>
          </h1>
          <p>Pick up a thought. Follow your curiosity.</p>
        </div>
        <button
          className="btn btn-outline course-info-btn"
          onClick={() => navigate("materials")}
        >
          <BookOpen size={17} />
          {course.code} <ChevronDown size={14} />
        </button>
      </div>
      <section className="learning-hero">
        <div className="hero-copy">
          <span className="hero-label">
            <span className="hero-label-dot" /> A CLEARER WAY TO LEARN
          </span>
          <h2>
            Make it
            <br />
            <em>make sense.</em>
          </h2>
          <p>
            Your course materials, a curious conversation, and that moment when
            it all clicks.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={newSession}>
              <Sparkles size={17} />
              Start a learning session
              <ArrowRight size={17} />
            </button>
            <button
              className="hero-secondary"
              onClick={() => navigate("market")}
            >
              Explore the wiki market <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <HeroArt />
        <div className="hero-caption">
          <span className="caption-line" />
          Ideas connect. Understanding grows.
        </div>
      </section>
      <div className="overview-metrics">
        <div>
          <span className="metric-icon metric-peach">
            <FolderOpen size={20} />
          </span>
          <span>
            <strong>{materials.length}</strong>
            <small>Course materials</small>
          </span>
          <span className="metric-note">Ready to explore</span>
        </div>
        <div>
          <span className="metric-icon metric-blue">
            <MessageSquare size={20} />
          </span>
          <span>
            <strong>{sessions.length}</strong>
            <small>Learning sessions</small>
          </span>
          <span className="metric-note">Your train of thought</span>
        </div>
        <div>
          <span className="metric-icon metric-green">
            <Network size={20} />
          </span>
          <span>
            <strong>{notes.length}</strong>
            <small>Connected wiki pages</small>
          </span>
          <span className="metric-note">Knowledge that stays</span>
        </div>
      </div>
      <div className="overview-middle">
        <section className="continue-section">
          <div className="section-head">
            <div>
              <h2>Keep the curiosity going</h2>
              <p>Your recent learning sessions</p>
            </div>
            <button className="text-link" onClick={() => navigate("studio")}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="sessions-stack">
            {sessions.slice(0, 2).map((session, index) => (
              <button
                className="session-card"
                key={session.id}
                onClick={() => navigate("studio", { sessionId: session.id })}
              >
                <span className={`session-art session-art-${index}`}>
                  <span />
                  <span />
                  <span />
                  {index === 0 ? (
                    <Layers3 size={28} />
                  ) : (
                    <Lightbulb size={27} />
                  )}
                </span>
                <span className="session-card-content">
                  <span className="session-meta">
                    {session.animation ? (
                      <>
                        <span className="small-dot" />
                        VISUAL EXPLANATION
                      </>
                    ) : (
                      <>
                        <MessageSquare size={12} />
                        LEARNING SESSION
                      </>
                    )}
                  </span>
                  <strong>{session.title}</strong>
                  <small>
                    {
                      session.messages.filter(
                        (message) => message.role === "user",
                      ).length
                    }{" "}
                    {session.messages.filter(
                      (message) => message.role === "user",
                    ).length === 1
                      ? "question"
                      : "questions"}{" "}
                    explored <span>·</span> Continue where you left off
                  </small>
                </span>
                <span className="session-arrow">
                  <ArrowRight size={19} />
                </span>
              </button>
            ))}
            {!sessions.length && (
              <div className="card empty-state">
                <Sparkles size={27} />
                <p>A fresh page for your next question.</p>
                <button className="text-link" onClick={newSession}>
                  Start your first session <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
        <section className="knowledge-card">
          <div className="knowledge-card-top">
            <span className="eyebrow">YOUR PERSONAL WIKI</span>
            <span className="knowledge-live">
              <span className="status-dot" />
              Growing with you
            </span>
          </div>
          <div className="knowledge-card-copy">
            <h2>
              Aha moments,
              <br />
              <em>all connected.</em>
            </h2>
            <p>A home for what you’re learning.</p>
          </div>
          <KnowledgeGraph />
          <button className="knowledge-cta" onClick={() => navigate("wiki")}>
            <span>Explore your knowledge</span>
            <span className="circle-arrow">
              <ArrowRight size={17} />
            </span>
          </button>
        </section>
      </div>
      <div className="overview-bottom">
        <section className="materials-overview">
          <div className="section-head">
            <div>
              <h2>A good place to start</h2>
              <p>Shared by your instructor</p>
            </div>
            <button className="text-link" onClick={() => navigate("materials")}>
              All materials <ArrowRight size={15} />
            </button>
          </div>
          <div className="mini-materials card">
            {materials.slice(0, 3).map((material, index) => (
              <button
                className="mini-material-row"
                onClick={() => openMaterial(material.id)}
                key={material.id}
              >
                <span className={`file-icon file-color-${index}`}>
                  <FileText size={20} />
                  <small>{material.type?.toUpperCase() || "PDF"}</small>
                </span>
                <span>
                  <strong>
                    {material.name.replace(/\.(pdf|md|txt)$/i, "")}
                  </strong>
                  <small>
                    {material.pages?.length || 1} pages <span>·</span> Course
                    material
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!materials.length && (
              <div className="empty-state">
                <FolderOpen size={24} />
                <p>No shared materials yet.</p>
              </div>
            )}
          </div>
        </section>
        <section className="community-section">
          <div className="section-head">
            <div>
              <h2>Better, together</h2>
              <p>A little wisdom from your course community</p>
            </div>
            <span className="tiny-outline-tag">WIKI MARKET</span>
          </div>
          <div className="community-list">
            {featured.map((item, index) => (
              <button
                key={item.id}
                className={`community-mini community-mini-${index}`}
                onClick={() => navigate("market")}
              >
                <span className="community-topic">
                  {item.category || "Study guide"} <ArrowRight size={15} />
                </span>
                <strong>{item.title}</strong>
                <span className="community-author">
                  <Avatar
                    initials={
                      item.initials ||
                      item.author
                        ?.split(" ")
                        .map((x) => x[0])
                        .join("")
                    }
                    color={item.color || "#dce8df"}
                    size={23}
                  />
                  {item.author}
                  <span className="community-page-count">
                    Read wiki <ChevronRight size={13} />
                  </span>
                </span>
              </button>
            ))}
            {!featured.length && (
              <div className="card empty-state">
                <Store size={24} />
                <p>Be the first to share an insight.</p>
                <button className="text-link" onClick={() => navigate("wiki")}>
                  Open your wiki <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="overview-bottom-note">
        <span className="quote-mark">“</span>
        <p>
          The beautiful thing about learning is that nobody can take it away
          from you.
        </p>
        <span>KEEP EXPLORING</span>
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 500 330" className="hero-illustration">
        <defs>
          <pattern
            id="heroGrid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".75" fill="#d8d3cc" />
          </pattern>
          <filter id="paperShadow" x="-40%" y="-40%" width="180%" height="190%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="12"
              floodColor="#372b1d"
              floodOpacity=".10"
            />
          </filter>
        </defs>
        <rect width="500" height="330" fill="url(#heroGrid)" opacity=".65" />
        <ellipse
          cx="274"
          cy="168"
          rx="172"
          ry="128"
          fill="none"
          stroke="#d6d2cb"
          strokeDasharray="4 7"
          transform="rotate(-18 274 168)"
        />
        <ellipse
          cx="274"
          cy="168"
          rx="122"
          ry="86"
          fill="none"
          stroke="#ded8cf"
          transform="rotate(-18 274 168)"
        />
        <path
          d="M83 214c53 33 133-6 183-62S391 67 433 104"
          fill="none"
          stroke="#7d91c5"
          strokeWidth="1.5"
        />
        <g
          transform="translate(188 67) rotate(-11 83 102)"
          filter="url(#paperShadow)"
        >
          <rect x="-9" y="13" width="165" height="214" rx="11" fill="#c8d5fa" />
          <rect x="-3" y="6" width="165" height="214" rx="11" fill="#e1e9ff" />
          <rect width="165" height="214" rx="11" fill="#fffefa" />
          <rect x="20" y="21" width="30" height="6" rx="3" fill="#bfcbee" />
          <rect x="20" y="42" width="97" height="7" rx="3.5" fill="#253e80" />
          <rect x="20" y="57" width="72" height="5" rx="2.5" fill="#d9dce5" />
          <path
            d="M37 105h41v40h48"
            fill="none"
            stroke="#b5c6f3"
            strokeWidth="1.5"
          />
          <path
            d="M78 105v-22h48m-48 62v24H43"
            fill="none"
            stroke="#b5c6f3"
            strokeWidth="1.5"
          />
          <rect x="19" y="91" width="38" height="29" rx="7" fill="#3156d3" />
          <rect x="102" y="70" width="38" height="29" rx="7" fill="#e8edfc" />
          <rect x="102" y="131" width="38" height="29" rx="7" fill="#e8edfc" />
          <circle cx="39" cy="169" r="14" fill="#f2d1a5" />
          <path
            d="m34 169 4 4 7-8"
            fill="none"
            stroke="#926536"
            strokeWidth="2"
          />
          <rect x="20" y="194" width="80" height="4" rx="2" fill="#d9dce5" />
        </g>
        <g transform="translate(92 156) rotate(-9)">
          <rect
            width="106"
            height="67"
            rx="10"
            fill="#fffefa"
            stroke="#ece8e1"
            filter="url(#paperShadow)"
          />
          <circle cx="22" cy="24" r="10" fill="#f7e7ce" />
          <path
            d="m18 24 3 3 5-6"
            fill="none"
            stroke="#aa753c"
            strokeWidth="1.5"
          />
          <rect x="40" y="20" width="48" height="5" rx="2.5" fill="#3c455d" />
          <rect x="16" y="46" width="74" height="4" rx="2" fill="#d9dce5" />
        </g>
        <g transform="translate(336 180) rotate(8)">
          <rect
            width="119"
            height="80"
            rx="11"
            fill="#fffefa"
            stroke="#ece8e1"
            filter="url(#paperShadow)"
          />
          <circle cx="29" cy="29" r="14" fill="#e4ecdf" />
          <path d="m25 23 10 6-10 6z" fill="#4b7553" />
          <rect x="52" y="23" width="47" height="5" rx="2.5" fill="#3c455d" />
          <rect x="52" y="35" width="30" height="4" rx="2" fill="#d9dce5" />
          <path
            d="M18 61h82"
            stroke="#e5e7e9"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M18 61h36"
            stroke="#7d9e76"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <circle cx="140" cy="94" r="19" fill="#3156d3" />
        <path
          d="m140 83 2.8 8.2 8.2 2.8-8.2 2.8-2.8 8.2-2.8-8.2-8.2-2.8 8.2-2.8z"
          fill="white"
        />
        <circle cx="407" cy="113" r="6" fill="#d5a66c" />
        <path
          d="M350 54v14m-7-7h14M113 265v12m-6-6h12"
          stroke="#8497c3"
          strokeWidth="1.7"
        />
        <circle cx="192" cy="278" r="4" fill="#9eb5a3" />
      </svg>
      <div className="hero-float-label">
        <span className="status-dot" />
        From “what?” to “got it.”
      </div>
    </div>
  );
}

function KnowledgeGraph() {
  return (
    <svg
      className="knowledge-graph"
      viewBox="0 0 340 150"
      role="img"
      aria-label="Connected concepts: transactions, isolation, concurrency and requirements"
    >
      <g stroke="#c3cbdc" strokeWidth="1">
        <path d="M165 79 73 38M165 79 268 30M165 79 279 111M165 79 65 121M73 38 268 30M65 121 73 38M268 30 279 111" />
      </g>
      <circle cx="165" cy="79" r="24" fill="#e3eaff" />
      <circle cx="165" cy="79" r="12" fill="#3156d3" />
      <circle cx="73" cy="38" r="7" fill="#d5a46c" />
      <circle cx="268" cy="30" r="7" fill="#86a48d" />
      <circle cx="279" cy="111" r="7" fill="#b99acc" />
      <circle cx="65" cy="121" r="7" fill="#93a9db" />
      <text x="165" y="118" textAnchor="middle">
        Transactions
      </text>
      <text x="73" y="20" textAnchor="middle">
        Concurrency
      </text>
      <text x="269" y="14" textAnchor="middle">
        Isolation
      </text>
      <text x="278" y="135" textAnchor="middle">
        Requirements
      </text>
      <text x="65" y="144" textAnchor="middle">
        AI fluency
      </text>
    </svg>
  );
}

function MaterialPreview({ preview, setPreview, onClose }) {
  const { data } = useApp();
  const material = data.materials.find((item) => item.id === preview.id);
  const [original, setOriginal] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [mode, setMode] = useState("text");
  useEffect(() => {
    let disposed = false;
    let url;
    setOriginal(null);
    setOriginalUrl(null);
    setMode("text");
    if (material?.hasOriginal)
      getOriginal(material.id)
        .then((file) => {
          if (!file || disposed) return;
          url = URL.createObjectURL(file);
          setOriginal(file);
          setOriginalUrl(url);
          if (material.type === "pdf") setMode("original");
        })
        .catch(() => {
          /* Extracted text remains accessible if original storage is unavailable. */
        });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [material?.id]);
  if (!material) return null;
  const pages = material.pages?.length
    ? material.pages
    : [{ page: 1, text: material.text || "No extracted text available." }];
  const page = pages.find((item) => item.page === preview.page) || pages[0];
  function download() {
    const blob = new Blob(
      [
        pages
          .map((item) => `Page ${item.page}\n\n${item.text}`)
          .join("\n\n---\n\n"),
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = material.name.replace(/\.[^.]+$/, "") + "-extracted.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      title={material.name}
      subtitle={`${material.ownerId ? "Student material" : "Course material"} · ${material.hasOriginal ? "Original file + extracted text" : "Sample teaching material"}`}
      onClose={onClose}
      wide
    >
      <div className="document-toolbar">
        <span>
          <FileText size={16} />
          Page {page.page} of {pages.length}
        </span>
        <div>
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={page.page <= 1}
            onClick={() => setPreview({ ...preview, page: page.page - 1 })}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={page.page >= pages.length}
            onClick={() => setPreview({ ...preview, page: page.page + 1 })}
          >
            <ChevronRight size={18} />
          </button>
          <button className="btn btn-outline btn-sm" onClick={download}>
            <ArrowDownToLine size={15} />
            Export text
          </button>
        </div>
      </div>
      {original && (
        <div className="document-original-bar">
          <div>
            {material.type === "pdf" && (
              <>
                <button
                  className={`btn btn-sm ${mode === "original" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMode("original")}
                >
                  Original PDF
                </button>
                <button
                  className={`btn btn-sm ${mode === "text" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMode("text")}
                >
                  Extracted text
                </button>
              </>
            )}
          </div>
          <a
            className="btn btn-outline btn-sm"
            href={originalUrl}
            download={original.name}
          >
            <ArrowDownToLine size={14} />
            Download original
          </a>
        </div>
      )}
      {mode === "original" && originalUrl ? (
        <iframe
          className="original-pdf-frame"
          title={`Original PDF: ${material.name}`}
          src={`${originalUrl}#page=${page.page}`}
        />
      ) : (
        <article className="document-paper">
          <span className="eyebrow">
            {material.name.replace(/\.[^.]+$/, "")}
          </span>
          <pre>{page.text}</pre>
          <footer>{page.page}</footer>
        </article>
      )}
    </Modal>
  );
}

function SearchDialog({ onClose }) {
  const { data, user, role, courseId, navigate, openMaterial } = useApp();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const matches = (text) => text.toLowerCase().includes(query.toLowerCase());
    return [
      ...data.sessions
        .filter(
          (item) =>
            item.courseId === courseId &&
            (role === "teacher" || item.studentId === user.id) &&
            matches(item.title),
        )
        .map((item) => ({
          title: item.title,
          subtitle: "Learning session",
          icon: MessageSquare,
          action: () => navigate("studio", { sessionId: item.id }),
        })),
      ...data.notes
        .filter(
          (item) =>
            item.courseId === courseId &&
            (role === "teacher" || item.studentId === user.id) &&
            matches(item.title),
        )
        .map((item) => ({
          title: item.title,
          subtitle: "Wiki page",
          icon: Network,
          action: () => navigate("wiki", { noteId: item.id }),
        })),
      ...data.materials
        .filter(
          (item) =>
            item.courseId === courseId &&
            (role === "teacher" || !item.ownerId || item.ownerId === user.id) &&
            matches(item.name),
        )
        .map((item) => ({
          title: item.name,
          subtitle: "Course material",
          icon: FileText,
          action: () => openMaterial(item.id),
        })),
    ].slice(0, 9);
  }, [query, data, courseId, role, user.id]);
  return (
    <Modal
      title="Find your next thought"
      subtitle="Search this course’s sessions, materials, and wiki pages."
      onClose={onClose}
    >
      <div className="command-search">
        <Search size={20} />
        <input
          aria-label="Search workspace"
          placeholder="Try “transactions” or “requirements”…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="search-results">
        {results.map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            onClick={() => {
              onClose();
              item.action();
            }}
          >
            <span className="search-result-icon">
              <item.icon size={18} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
        {!results.length && (
          <div className="empty-state">
            <Search size={25} />
            <p>No results. Try another concept.</p>
          </div>
        )}
      </div>
      <div className="search-footer">
        <kbd>esc</kbd> to close{" "}
        <span>Only content you can access is shown.</span>
      </div>
    </Modal>
  );
}
