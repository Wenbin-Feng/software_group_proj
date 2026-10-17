import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Inbox as InboxIcon,
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
import { Modal, Avatar } from "./components/ui";
import Courses from "./components/Courses";
import CourseWorkspace from "./components/CourseWorkspace";
import Wiki from "./components/Wiki";
import Market from "./components/Market";
import Teacher from "./components/Teacher";
import Inbox from "./components/Inbox";
import { getOriginal } from "./lib/originals";
import { buildRoute, parseRoute } from "./lib/navigation";
import { api, persistChanges, workspaceChanges, flushChanges } from "./lib/api";
import {
  canReadCourse,
  canReadMaterial,
  canReadSession,
  canReadPrivateNote,
  canTeach,
  inboxUnreadCount,
  visibleCourses,
  visibleThreads,
} from "./lib/access";
function savedCourse() {
  try {
    return localStorage.getItem("folio-course") || "se";
  } catch {
    return "se";
  }
}
function roleRoute(route, role, data) {
  if (role !== "teacher") return route;
  if (route.view === "courses")
    return { ...route, view: "teacher", teacherPage: "courses" };
  if (route.view === "course")
    return {
      ...route,
      view: "teacher",
      teacherPage: route.sessionId ? "review" : "overview",
      studentId: data.sessions.find((session) => session.id === route.sessionId)
        ?.studentId,
    };
  if (route.view === "market")
    return { ...route, view: "teacher", teacherPage: "market" };
  return route;
}
export default function App({
  authenticatedUser,
  initialData,
  onLogout,
  googleEnabled = false,
  onConnectGoogle,
  authFeedback,
}) {
  const [data, updateData] = useState(initialData);
  const dataRef = useRef(data);
  const revisionRef = useRef(0);
  const [syncing, setSyncing] = useState(0);
  const [syncError, setSyncError] = useState("");
  const patchLocal = useCallback((updater) => {
    const next =
      typeof updater === "function" ? updater(dataRef.current) : updater;
    revisionRef.current += 1;
    dataRef.current = next;
    updateData(next);
  }, []);
  const refreshWorkspace = useCallback(async () => {
    await flushChanges();
    const revision = revisionRef.current;
    const result = await api("/api/workspace");
    if (revision === revisionRef.current) patchLocal(result.data || result);
  }, [patchLocal]);
  const setData = useCallback(
    (updater) => {
      const before = dataRef.current;
      const next = typeof updater === "function" ? updater(before) : updater;
      const changes = workspaceChanges(before, next);
      patchLocal(next);
      if (!changes.length) return;
      setSyncing((count) => count + 1);
      setSyncError("");
      persistChanges(
        changes,
        async (error) => {
          setSyncError(error.message);
          const result = await api("/api/workspace").catch(() => null);
          if (result) patchLocal(result.data || result);
        },
        (change, record) => {
          const current = dataRef.current[change.collection]?.find(
            (item) => item.id === change.id,
          );
          if (JSON.stringify(current) === JSON.stringify(change.record))
            patchLocal((previous) => ({
              ...previous,
              [change.collection]: previous[change.collection].map((item) =>
                item.id === record.id ? record : item,
              ),
            }));
        },
      ).finally(() => setSyncing((count) => Math.max(0, count - 1)));
    },
    [patchLocal],
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (!syncing && document.visibilityState === "visible")
        refreshWorkspace().catch((error) => {
          if (error.status === 401) onLogout().catch(() => {});
        });
    }, 6000);
    return () => clearInterval(timer);
  }, [syncing, refreshWorkspace, onLogout]);
  const role = authenticatedUser.role;
  const userId = authenticatedUser.id,
    teacherId = authenticatedUser.id;
  const user =
    data.students.find((student) => student.id === userId) || authenticatedUser;
  const teacher =
    data.teachers.find((item) => item.id === teacherId) || authenticatedUser;
  const actor = useMemo(
    () => ({ id: role === "teacher" ? teacher.id : user.id, role }),
    [role, teacher.id, user.id],
  );
  const [rawRoute, setRoute] = useState(() =>
    parseRoute(location.hash, data, savedCourse()),
  );
  const route = roleRoute(rawRoute, role, data),
    view = route.view;
  const course = data.courses.find((item) => item.id === route.courseId) ||
    visibleCourses(data, actor)[0] ||
    data.courses[0] || {
      id: "",
      name: "Courses",
      code: "",
      instructor: "",
      term: "",
    };
  const [activeSessionId, setActiveSessionId] = useState(route.sessionId);
  const [activeNoteId, setActiveNoteId] = useState(route.noteId);
  const [dialog, setDialog] = useState(
      authFeedback?.error || authFeedback?.linked ? "identity" : null,
    ),
    [preview, setPreview] = useState(null),
    [workspaceRequest, setWorkspaceRequest] = useState(null),
    [composeRequest, setComposeRequest] = useState(null),
    [toastMessage, setToastMessage] = useState(
      authFeedback && !authFeedback.error && !authFeedback.linked
        ? authFeedback.message
        : "",
    ),
    [mobileOpen, setMobileOpen] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false),
    [googleError, setGoogleError] = useState("");
  async function connectGoogle() {
    setConnectingGoogle(true);
    setGoogleError("");
    try {
      await onConnectGoogle();
    } catch (error) {
      setGoogleError(error.message);
      setConnectingGoogle(false);
    }
  }
  const clearComposeRequest = useCallback(() => setComposeRequest(null), []);
  const isReview =
    role === "teacher" && view === "teacher" && route.teacherPage === "review";
  const inCourse = view === "course" || isReview;
  const inWiki = role === "student" && view === "wiki" && Boolean(activeNoteId);
  const focusedWorkspace = inCourse || inWiki;
  const courseExists = data.courses.some((item) => item.id === route.courseId);
  const scopedCourse =
    view === "course" ||
    view === "market" ||
    (view === "teacher" && route.teacherPage !== "courses");
  const courseAllowed =
    !scopedCourse ||
    (courseExists && canReadCourse(data, actor, route.courseId));
  const requestedSession = data.sessions.find(
    (session) => session.id === route.sessionId,
  );
  const reviewAllowed =
    !isReview ||
    Boolean(
      requestedSession &&
      requestedSession.courseId === route.courseId &&
      requestedSession.studentId === route.studentId &&
      canReadSession(data, actor, requestedSession),
    );
  const teacherOnly = view === "teacher" && role !== "teacher";
  const privateWikiDenied = view === "wiki" && role === "teacher";
  const wikiNote = data.notes.find(
    (note) => note.id === activeNoteId && canReadPrivateNote(data, actor, note),
  );
  const toast = useCallback((message) => setToastMessage(message), []);
  const unread = inboxUnreadCount(data, actor);
  const navItems =
    role === "teacher"
      ? [
          { id: "teacher-courses", name: "Courses", icon: BookOpen },
          { id: "inbox", name: "Inbox", icon: InboxIcon },
        ]
      : [
          { id: "courses", name: "Courses", icon: BookOpen },
          { id: "wiki", name: "My wiki", icon: Network },
          { id: "market", name: "Wiki market", icon: Store },
          { id: "inbox", name: "Inbox", icon: InboxIcon },
        ];
  const noteCount =
    role === "student"
      ? data.notes.filter((note) => canReadPrivateNote(data, actor, note))
          .length
      : 0;
  useEffect(() => {
    if (route.courseId && courseExists && canReadCourse(data, actor, course.id))
      try {
        localStorage.setItem("folio-course", course.id);
      } catch {}
  }, [course.id, route.courseId, courseExists, actor, data.courses]);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  useEffect(() => {
    const handler = () => {
      const next = parseRoute(location.hash, data, course.id);
      setRoute(next);
      setActiveSessionId(next.sessionId);
      setActiveNoteId(next.noteId);
      setMobileOpen(false);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [data, course.id]);
  useEffect(() => {
    setWorkspaceRequest(null);
  }, [actor.id, actor.role, course.id, view]);
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
      if (role === "teacher") {
        if (["courses", "overview"].includes(next)) next = "teacher-courses";
        else if (["course", "studio"].includes(next))
          next = params.sessionId ? "teacher-review" : "teacher-overview";
        else if (next === "materials") next = "teacher-materials";
        else if (next === "market") next = "teacher-market";
      }
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
    [data, course.id, role],
  );
  function askTeacher(params = {}) {
    if (role !== "student") return;
    const selected = params.courseId || course.id;
    if (!canReadCourse(data, actor, selected))
      return toast("This course is not available.");
    setComposeRequest({
      courseId: selected,
      sessionId: params.sessionId || activeSessionId || null,
      requestId: crypto.randomUUID(),
    });
    navigate("inbox", { courseId: selected });
  }
  function openMaterial(id, page = 1) {
    const material = data.materials.find((item) => item.id === id);
    if (!canReadMaterial(data, actor, material))
      return toast("This material is not available in your learning space.");
    const session = data.sessions.find(
      (item) => item.id === activeSessionId && item.courseId === course.id,
    );
    const owner = data.students.find((item) => item.id === session?.studentId);
    const inScope =
      !material.ownerId ||
      material.ownerId === owner?.id ||
      material.ownerId === owner?.studentId ||
      role === "student";
    if (inCourse && material.courseId === course.id && inScope)
      setWorkspaceRequest({
        kind: "material",
        id,
        page,
        requestId: crypto.randomUUID(),
      });
    else setPreview({ id, page });
  }
  function backFromReview() {
    const target = route.returnTo;
    if (
      target &&
      (target.startsWith("#/teacher/") || target.startsWith("#/inbox"))
    ) {
      const parsed = parseRoute(target, data, course.id);
      if (
        parsed.view === "inbox" ||
        (parsed.view === "teacher" &&
          (!parsed.courseId || canTeach(data, teacher.id, parsed.courseId)))
      ) {
        setRoute(parsed);
        setActiveSessionId(parsed.sessionId);
        setActiveNoteId(parsed.noteId);
        location.hash = target;
        return;
      }
    }
    navigate("teacher-student", {
      courseId: course.id,
      studentId: route.studentId,
    });
  }
  const context = {
    data,
    setData,
    patchLocal,
    refreshWorkspace,
    refresh: refreshWorkspace,
    courseId: course.id,
    course,
    user,
    teacher,
    teacherId,
    actor,
    role,
    view,
    route,
    activeSessionId,
    setActiveSessionId,
    activeNoteId,
    setActiveNoteId,
    navigate,
    toast,
    openMaterial,
    workspaceRequest,
    workspacePanel: route.panel,
    composeRequest,
    clearComposeRequest,
    askTeacher,
  };
  const label =
    view === "teacher"
      ? route.teacherPage === "courses"
        ? "Courses"
        : course.name
      : view === "inbox"
        ? "Inbox"
        : navItems.find((item) => item.id === view)?.name || course.name;
  const currentActor = role === "teacher" ? teacher : user;
  const profile = (
    <button
      className="profile"
      onClick={() => setDialog("identity")}
      aria-label="Account settings"
    >
      <Avatar {...currentActor} />
      <span>
        <strong>{currentActor.name}</strong>
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
            <div className="nav-label">
              {role === "teacher" ? "TEACHING WORKSPACE" : "YOUR WORKSPACE"}
            </div>
            <nav aria-label="Workspace">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id || (item.id === "teacher-courses" && view === "teacher") ? "active" : ""}`}
                  aria-current={
                    view === item.id ||
                    (item.id === "teacher-courses" && view === "teacher")
                      ? "page"
                      : undefined
                  }
                  onClick={() => {
                    setComposeRequest(null);
                    navigate(item.id);
                  }}
                >
                  <item.icon size={19} strokeWidth={1.7} />
                  <span>{item.name}</span>
                  {item.id === "wiki" && (
                    <span className="nav-count">{noteCount}</span>
                  )}
                  {item.id === "inbox" && unread > 0 && (
                    <span
                      className="nav-count inbox-unread-count"
                      aria-label={`${unread} unread conversations`}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button className="help-link" onClick={() => setDialog("about")}>
                <CircleHelp size={17} />
                Help & about
                <span className="demo-dot" />
                Learning workspace
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
                  {wikiNote?.title || "Wiki note unavailable"}
                </strong>
              </>
            ) : inCourse ? (
              <>
                <button
                  className="course-back"
                  onClick={
                    isReview ? backFromReview : () => navigate("courses")
                  }
                >
                  <ArrowLeft size={17} />
                  <span>{isReview ? "Back to review list" : "Courses"}</span>
                </button>
                <span className="course-topbar-separator" />
                <span className="course-topbar-code">
                  {courseAllowed ? course.code : ""}
                </span>
                <strong className="course-topbar-title">
                  {courseAllowed ? course.name : "Course unavailable"}
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
                {view === "teacher" && route.teacherPage !== "courses" && (
                  <>
                    <button
                      className="text-link"
                      onClick={() => navigate("teacher-courses")}
                    >
                      Courses
                    </button>
                    <ChevronRight size={14} />
                  </>
                )}
                <strong>{label}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {view === "market" && role === "student" && (
              <label className="global-course-filter">
                <BookOpen size={15} />
                <select
                  aria-label="Choose wiki course"
                  value={course.id}
                  onChange={(event) =>
                    navigate("market", { courseId: event.target.value })
                  }
                >
                  {visibleCourses(data, actor).map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {inCourse && (
              <div className="course-global-links">
                {isReview ? (
                  <>
                    <button
                      aria-label="Course overview"
                      onClick={() =>
                        navigate("teacher-overview", { courseId: course.id })
                      }
                    >
                      <Users size={16} />
                      <span>Course overview</span>
                    </button>
                    <button
                      aria-label="Inbox"
                      onClick={() => navigate("inbox", { courseId: course.id })}
                    >
                      <InboxIcon size={16} />
                      <span>Inbox</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      aria-label="My wiki"
                      onClick={() => navigate("wiki")}
                    >
                      <Network size={16} />
                      <span>My wiki</span>
                    </button>
                    <button
                      aria-label="Wiki market"
                      onClick={() =>
                        navigate("market", { courseId: course.id })
                      }
                    >
                      <Store size={16} />
                      <span>Wiki market</span>
                    </button>
                    <button
                      onClick={() =>
                        askTeacher({
                          courseId: course.id,
                          sessionId: activeSessionId,
                        })
                      }
                      aria-label="Ask teacher"
                    >
                      <MessageSquare size={16} />
                      <span>Ask teacher</span>
                    </button>
                  </>
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
              aria-label="Account settings"
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
          className={`page-container page-${inCourse ? "course" : view} ${inWiki ? "page-wiki-vault" : ""}`}
          key={`${view}-${view === "wiki" || view === "inbox" ? "all" : course.id}-${actor.id}-${role}`}
        >
          {teacherOnly ||
          privateWikiDenied ||
          !courseAllowed ||
          !reviewAllowed ? (
            <div className="empty-state course-not-found">
              <ShieldCheck size={32} />
              <h1>
                {privateWikiDenied
                  ? "Personal wikis belong to students"
                  : "This space is unavailable"}
              </h1>
              <p>
                {privateWikiDenied
                  ? "Browse published knowledge in your course’s wiki market."
                  : "Choose a course or conversation available to your current identity."}
              </p>
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
              {view === "teacher" &&
                (isReview ? <CourseWorkspace /> : <Teacher />)}
              {view === "course" && <CourseWorkspace />}
              {view === "wiki" && <Wiki />}
              {view === "market" && <Market />}
              {view === "inbox" && <Inbox />}
            </>
          )}
        </main>
        {!focusedWorkspace && (
          <footer className="app-footer">
            <span>Folio · A clearer way to learn.</span>
            <span>
              <span className="status-dot" />
              {syncError
                ? `Save failed: ${syncError}`
                : syncing
                  ? "Saving changes…"
                  : "Saved to your workspace"}
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
          subtitle="Folio · Software Engineering Group Project"
          onClose={() => setDialog(null)}
        >
          <div className="about-content">
            <div className="about-symbol">
              <Layers3 size={36} />
            </div>
            <p>
              Students learn through materials, conversations and a personal
              wiki. Teachers manage courses and answer private messages in
              Inbox.
            </p>
            <div className="notice-box">
              <Lightbulb size={20} />
              <div>
                <strong>Your learning, connected.</strong>
                <p>
                  Materials, conversations and replies are saved to the server.
                  Qwen helps explain your materials and generate visual learning
                  aids.
                </p>
              </div>
            </div>
            <p className="muted">
              Sign in with Google or your wallet. Your personal Wiki stays
              private, including from teachers.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "identity" && (
        <Modal
          title="Your account"
          subtitle={
            authenticatedUser.authMethod === "google"
              ? "Signed in with Google"
              : "Signed in with MetaMask"
          }
          onClose={() => setDialog(null)}
        >
          <div className="about-content">
            <Avatar {...currentActor} />
            <h3>{currentActor.name}</h3>
            <p>
              {role === "teacher" ? "Teacher" : `Student · ${user.studentId}`}
            </p>
            <div className="account-methods">
              {authenticatedUser.googleLinked && (
                <div className="account-method">
                  <strong>Google connected</strong>
                  <span>
                    {authenticatedUser.googleEmail ||
                      "Connected Google account"}
                  </span>
                </div>
              )}
              {authenticatedUser.walletAddress && (
                <div className="account-method">
                  <strong>Wallet</strong>
                  <span>{authenticatedUser.walletAddress}</span>
                </div>
              )}
            </div>
            {authFeedback &&
              (authFeedback.error || authFeedback.linked) &&
              !googleError && (
                <div
                  className={authFeedback.error ? "auth-error" : "auth-success"}
                  role={authFeedback.error ? "alert" : "status"}
                >
                  {authFeedback.message}
                </div>
              )}
            {googleError && (
              <div className="auth-error" role="alert">
                {googleError}
              </div>
            )}
            {googleEnabled &&
              !authenticatedUser.googleLinked &&
              onConnectGoogle && (
                <>
                  <p className="muted">
                    Connect Google to sign in to this same account without your
                    wallet. Your courses and learning stay together.
                  </p>
                  <button
                    className="btn auth-google"
                    onClick={connectGoogle}
                    disabled={connectingGoogle}
                    aria-busy={connectingGoogle}
                  >
                    <img
                      className="google-mark"
                      src="/google-g.png"
                      width="20"
                      height="20"
                      alt=""
                      aria-hidden="true"
                    />
                    {connectingGoogle ? "Opening Google…" : "Connect Google"}
                  </button>
                </>
              )}
            <button className="btn btn-outline" onClick={onLogout}>
              Sign out
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
  const { data, actor } = useApp();
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
    if (material?.hasOriginal && canReadMaterial(data, actor, material))
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
  }, [material?.id, actor.id, actor.role]);
  if (!canReadMaterial(data, actor, material)) return null;
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
  const {
    data,
    user,
    role,
    actor,
    courseId,
    route,
    view,
    navigate,
    openMaterial,
  } = useApp();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const matches = (text) =>
      String(text || "")
        .toLowerCase()
        .includes(query.toLowerCase());
    const withinCourse = (item) =>
      view === "inbox" ||
      view === "courses" ||
      view === "wiki" ||
      (view === "teacher" && route.teacherPage === "courses") ||
      item.courseId === courseId;
    return [
      ...data.sessions
        .filter(
          (item) =>
            canReadSession(data, actor, item) &&
            withinCourse(item) &&
            matches(item.title),
        )
        .map((item) => ({
          title: item.title,
          subtitle: `Learning session · ${data.students.find((student) => student.id === item.studentId)?.name || "Student"}`,
          icon: MessageSquare,
          action: () =>
            navigate(role === "teacher" ? "teacher-review" : "studio", {
              courseId: item.courseId,
              studentId: item.studentId,
              sessionId: item.id,
              returnTo: role === "teacher" ? location.hash : undefined,
            }),
        })),
      ...data.notes
        .filter(
          (item) =>
            canReadPrivateNote(data, actor, item) &&
            withinCourse(item) &&
            matches(item.title),
        )
        .map((item) => ({
          title: item.title,
          subtitle: `Private wiki · ${data.courses.find((course) => course.id === item.courseId)?.code}`,
          icon: Network,
          action: () => navigate("wiki", { noteId: item.id }),
        })),
      ...data.materials
        .filter(
          (item) =>
            canReadMaterial(data, actor, item) &&
            withinCourse(item) &&
            !item.archivedAt &&
            matches(item.name),
        )
        .map((item) => ({
          title: item.name,
          subtitle: item.ownerId ? "Student material" : "Course material",
          icon: FileText,
          action: () => openMaterial(item.id),
        })),
      ...(role === "teacher"
        ? data.market
            .filter(
              (item) =>
                canTeach(data, actor.id, item.courseId) &&
                withinCourse(item) &&
                matches(item.title),
            )
            .map((item) => ({
              title: item.title,
              subtitle: "Published wiki snapshot",
              icon: Store,
              action: () =>
                navigate("teacher-market", { courseId: item.courseId }),
            }))
        : []),
      ...visibleThreads(data, actor)
        .filter((item) => matches(item.subject))
        .map((item) => ({
          title: item.subject,
          subtitle: "Private Inbox conversation",
          icon: InboxIcon,
          action: () =>
            navigate("inbox", { threadId: item.id, courseId: item.courseId }),
        })),
    ].slice(0, 15);
  }, [
    query,
    data,
    actor,
    courseId,
    view,
    route.teacherPage,
    role,
    navigate,
    openMaterial,
  ]);
  return (
    <Modal
      title="Find your next thought"
      subtitle={
        role === "teacher"
          ? "Search your courses, student sessions, published wikis and Inbox."
          : "Search your learning spaces and private Inbox."
      }
      onClose={onClose}
    >
      <div className="command-search">
        <Search size={20} />
        <input
          aria-label="Search workspace"
          placeholder="Search by topic, document or conversation…"
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
            <p>No results. Try another topic.</p>
          </div>
        )}
      </div>
      <div className="search-footer">
        <kbd>esc</kbd> to close
        <span>Only content available to your identity is shown.</span>
      </div>
    </Modal>
  );
}
