import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  GraduationCap,
  Layers3,
  Lightbulb,
  Menu,
  MessageSquare,
  Network,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  X,
} from "lucide-react";
import { AppContext, useApp } from "./context";
import { initialData } from "./data";
import { Modal, Avatar } from "./components/ui";
import Courses from "./components/Courses";
import CourseWorkspace from "./components/CourseWorkspace";
import Wiki from "./components/Wiki";
import Market from "./components/Market";
import Teacher from "./components/Teacher";
import { getOriginal } from "./lib/originals";
import { buildRoute, parseRoute } from "./lib/navigation";

const STORAGE = "folio-workspace-v1";
const navItems = [
  { id: "courses", name: "Courses", icon: BookOpen },
  { id: "wiki", name: "My wiki", icon: Network },
  { id: "market", name: "Wiki market", icon: Store },
];
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (
      saved?.courses?.length &&
      ["sessions", "notes", "market", "students", "materials"].every((key) =>
        Array.isArray(saved[key]),
      )
    )
      return saved;
  } catch {
    /* Fall back to sample data when storage is unavailable. */
  }
  return structuredClone(initialData);
}
function savedCourse() {
  try {
    return localStorage.getItem("folio-course") || "se";
  } catch {
    return "se";
  }
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [route, setRoute] = useState(() =>
    parseRoute(location.hash, data, savedCourse()),
  );
  const [role, setRole] = useState("student");
  const [userId, setUserId] = useState("wenbin");
  const [activeSessionId, setActiveSessionId] = useState(route.sessionId);
  const [activeNoteId, setActiveNoteId] = useState(route.noteId);
  const [dialog, setDialog] = useState(null);
  const [preview, setPreview] = useState(null);
  const [workspaceRequest, setWorkspaceRequest] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const user =
    data.students.find((item) => item.id === userId) || data.students[0];
  const course =
    data.courses.find((item) => item.id === route.courseId) || data.courses[0];
  const view = route.view;
  const inCourse = view === "course";
  const inWiki = view === "wiki" && Boolean(activeNoteId);
  const focusedWorkspace = inCourse || inWiki;
  const wikiNote = data.notes.find(
    (note) =>
      note.id === activeNoteId &&
      (role === "teacher" ||
        note.studentId === user.id ||
        note.studentId === user.studentId),
  );
  const courseExists = data.courses.some((item) => item.id === route.courseId);
  const toast = useCallback((message) => setToastMessage(message), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
    } catch {
      toast(
        "Browser storage is full. Your latest changes will not survive a refresh.",
      );
    }
  }, [data, toast]);
  useEffect(() => {
    if (view !== "courses" && courseExists)
      try {
        localStorage.setItem("folio-course", course.id);
      } catch {
        /* Optional preference. */
      }
  }, [course.id, view, courseExists]);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  useEffect(() => {
    function handler() {
      const next = parseRoute(location.hash, data, course.id);
      setRoute(next);
      setActiveSessionId(next.sessionId);
      setActiveNoteId(next.noteId);
      setMobileOpen(false);
    }
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [data, course.id]);
  useEffect(() => {
    setWorkspaceRequest(null);
  }, [user.id, role, course.id, view]);
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog("search");
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navigate = useCallback(
    (next, params = {}) => {
      const hash = buildRoute(next, params, data, course.id);
      const resolved = parseRoute(hash, data, course.id);
      setRoute(resolved);
      setActiveSessionId(resolved.sessionId);
      setActiveNoteId(resolved.noteId);
      if (params.courseId && params.courseId !== course.id)
        setWorkspaceRequest(null);
      location.hash = hash;
      setMobileOpen(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [data, course.id],
  );

  function openMaterial(id, page = 1) {
    const material = data.materials.find((item) => item.id === id);
    if (
      !material ||
      material.courseId !== course.id ||
      (role !== "teacher" && material.ownerId && material.ownerId !== user.id)
    )
      return toast("This material is not available in your learning space.");
    const session =
      data.sessions.find(
        (item) => item.id === activeSessionId && item.courseId === course.id,
      ) || data.sessions.find((item) => item.courseId === course.id);
    const sessionStudent = data.students.find(
      (item) => item.id === session?.studentId,
    );
    const outsideStudentScope =
      role === "teacher" &&
      material.ownerId &&
      material.ownerId !== sessionStudent?.id &&
      material.ownerId !== sessionStudent?.studentId;
    if (inCourse && !outsideStudentScope)
      setWorkspaceRequest({
        kind: "material",
        id,
        page,
        requestId: crypto.randomUUID(),
      });
    else setPreview({ id, page });
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
    workspaceRequest,
    workspacePanel: route.panel,
  };
  const currentLabel =
    navItems.find((item) => item.id === view)?.name ||
    (view === "teacher" ? "Student activity" : course.name);
  const noteCount = data.notes.filter(
    (note) =>
      role === "teacher" ||
      note.studentId === user.id ||
      note.studentId === user.studentId,
  ).length;
  const profile = (
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
          {role === "teacher" ? "Instructor" : `Student · ${user.studentId}`}
        </small>
      </span>
      <Settings2 size={16} />
    </button>
  );
  return (
    <AppContext.Provider value={context}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {!focusedWorkspace && (
        <>
          {mobileOpen && (
            <button
              className="sidebar-scrim"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <aside
            className={`sidebar sidebar-simple ${mobileOpen ? "sidebar-open" : ""}`}
          >
            <button
              className="brand"
              onClick={() => navigate("courses")}
              aria-label="Folio home"
            >
              <span className="brand-mark">
                <Layers3 size={23} strokeWidth={1.7} />
              </span>
              <span>
                folio<span className="brand-dot">.</span>
              </span>
            </button>
            <div className="nav-label">YOUR WORKSPACE</div>
            <nav aria-label="Workspace">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id || (item.id === "courses" && view === "teacher") ? "active" : ""}`}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={19} strokeWidth={1.7} />
                  <span>{item.name}</span>
                  {item.id === "wiki" && (
                    <span className="nav-count">{noteCount}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button className="help-link" onClick={() => setDialog("about")}>
                <CircleHelp size={17} />
                Help & about
                <span className="demo-dot" />
                Local demo
              </button>
              {profile}
            </div>
          </aside>
        </>
      )}
      <div
        className={`app-main ${inCourse ? "course-main" : ""} ${inWiki ? "vault-main" : ""}`}
      >
        <header
          className={`topbar ${inCourse ? "course-topbar" : ""} ${inWiki ? "vault-topbar" : ""} ${view === "market" ? "has-course-filter" : ""}`}
        >
          <div className="breadcrumb">
            {inWiki ? (
              <>
                <button
                  className="course-back"
                  onClick={() => navigate("wiki")}
                >
                  <ArrowLeft size={17} />
                  <span>My wiki</span>
                </button>
                <span className="course-topbar-separator" />
                <Network size={16} className="course-topbar-code" />
                <strong className="course-topbar-title">
                  {wikiNote ? wikiNote.title : "Wiki note unavailable"}
                </strong>
              </>
            ) : inCourse ? (
              <>
                <button
                  className="course-back"
                  onClick={() => navigate("courses")}
                >
                  <ArrowLeft size={17} />
                  <span>Courses</span>
                </button>
                <span className="course-topbar-separator" />
                <span className="course-topbar-code">
                  {courseExists ? course.code : ""}
                </span>
                <strong className="course-topbar-title">
                  {courseExists ? course.name : "Course unavailable"}
                </strong>
              </>
            ) : (
              <>
                <button
                  className="icon-btn mobile-menu"
                  aria-label="Open navigation"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu size={21} />
                </button>
                {view === "teacher" && (
                  <>
                    <button
                      className="text-link"
                      onClick={() =>
                        navigate("course", { courseId: course.id })
                      }
                    >
                      {course.name}
                    </button>
                    <ChevronRight size={14} />
                  </>
                )}
                <strong>{currentLabel}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {courseExists && view === "market" && (
              <label className="global-course-filter">
                <BookOpen size={15} />
                <select
                  aria-label="Choose wiki course"
                  value={course.id}
                  onChange={(event) =>
                    navigate(view, { courseId: event.target.value })
                  }
                >
                  {data.courses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {inCourse && (
              <div className="course-global-links">
                <button onClick={() => navigate("wiki")}>
                  <Network size={16} />
                  <span>My wiki</span>
                </button>
                <button
                  onClick={() => navigate("market", { courseId: course.id })}
                >
                  <Store size={16} />
                  <span>Wiki market</span>
                </button>
                {role === "teacher" && (
                  <button
                    onClick={() => navigate("teacher", { courseId: course.id })}
                  >
                    <Users size={16} />
                    <span>Students</span>
                  </button>
                )}
              </div>
            )}
            <button
              className="icon-btn"
              onClick={() => setDialog("search")}
              aria-label="Search your workspace"
            >
              <Search size={18} />
            </button>
            <button
              className={`role-toggle ${role === "teacher" ? "is-teacher" : ""}`}
              onClick={() => setDialog("identity")}
              aria-label="Switch demo role or student"
            >
              <GraduationCap size={16} />
              <span>{role === "teacher" ? "Instructor" : "Student"}</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`page-container page-${view} ${inWiki ? "page-wiki-vault" : ""}`}
          key={`${view}-${view === "wiki" ? "all" : course.id}-${user.id}-${role}`}
        >
          {view !== "courses" && view !== "wiki" && !courseExists ? (
            <div className="empty-state course-not-found">
              <BookOpen size={32} />
              <h1>Course not found</h1>
              <p>Choose a course from your learning space.</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("courses")}
              >
                Back to Courses
              </button>
            </div>
          ) : (
            <>
              {view === "courses" && <Courses />}
              {view === "course" && <CourseWorkspace />}
              {view === "wiki" && <Wiki />}
              {view === "market" && <Market />}
              {view === "teacher" && <Teacher />}
            </>
          )}
        </main>
        {!focusedWorkspace && (
          <footer className="app-footer">
            <span>Folio · A clearer way to learn.</span>
            <span>
              <span className="status-dot" />
              Workspace stored in this browser
            </span>
          </footer>
        )}
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
          title="A clearer way to learn."
          subtitle="Folio · Wenbin’s independent prototype"
          onClose={() => setDialog(null)}
        >
          <div className="about-content">
            <div className="about-symbol">
              <Layers3 size={36} />
            </div>
            <p>
              Choose a course, explore its files, and keep the conversation
              going. Documents and interactive explanations open beside your
              conversation.
            </p>
            <div className="notice-box">
              <Lightbulb size={20} />
              <div>
                <strong>You’re exploring a local prototype.</strong>
                <p>
                  PDF parsing, original files, notes and wiki publications work
                  in this browser. Tutor responses use source excerpts and
                  prepared explanations. Animation scenes are authored demos; no
                  live language model is connected.
                </p>
              </div>
            </div>
            <p className="muted">
              The role switcher demonstrates different views. It is not a secure
              login system.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "identity" && (
        <Modal
          title="Explore another perspective"
          subtitle="Choose a demo learner or instructor."
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
                  setDialog(null);
                  setPreview(null);
                  setWorkspaceRequest(null);
                  navigate("courses");
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
                setPreview(null);
                setWorkspaceRequest(null);
                navigate("courses");
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
  const { data, user, role, view, courseId, navigate, openMaterial } = useApp();
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
            (view === "wiki" || item.courseId === courseId) &&
            (role === "teacher" ||
              item.studentId === user.id ||
              item.studentId === user.studentId) &&
            matches(item.title),
        )
        .map((item) => ({
          title: item.title,
          subtitle: `Wiki page · ${data.courses.find((course) => course.id === item.courseId)?.code || "Personal"}`,
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
  }, [query, data, courseId, role, user.id, user.studentId, view]);
  return (
    <Modal
      title="Find your next thought"
      subtitle={
        view === "wiki"
          ? "Find wiki notes across your courses, plus this course’s sessions and materials."
          : "Search this course’s sessions, materials, and wiki pages."
      }
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
