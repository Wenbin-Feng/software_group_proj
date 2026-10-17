import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Archive,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  UploadCloud,
  Users,
} from "lucide-react";
import { useApp } from "../context";
import {
  canTeach,
  enrolledStudents,
  threadStatus,
  visibleThreads,
} from "../lib/access";
import { ACCEPTED_FILES, formatBytes, readMaterialFile } from "../lib/files";
import Courseware from "./Courseware";
import { CreateCourse, JoinCode } from "./CourseActions";
import { getOriginal, saveOriginal } from "../lib/originals";
import { Avatar, Modal } from "./ui";
import { WikiMarkdown } from "./Wiki";
import Market from "./Market";
import "./teacher.css";

const DATE_OPTIONS = {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Hong_Kong",
};
const stamp = (value) => Date.parse(value) || 0;
const date = (value) =>
  stamp(value)
    ? new Date(value).toLocaleDateString("en-GB", DATE_OPTIONS)
    : "No activity yet";
const questionCount = (session) =>
  (session.messages || []).filter((message) => message.role === "user").length;
const lastQuestion = (session) =>
  (session.messages || []).filter((message) => message.role === "user").at(-1)
    ?.content || session.title;
const teacherTabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "materials", label: "Materials", icon: FolderOpen },
  { id: "students", label: "Students", icon: Users },
  { id: "market", label: "Wiki market", icon: Store },
  { id: "courseware", label: "Courseware", icon: FileText },
];

function Empty({ icon: Icon = FolderOpen, title, children, action }) {
  return (
    <div className="tportal-empty">
      <span>
        <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function FieldSearch({ label, placeholder, value, onChange }) {
  return (
    <label className="tportal-search">
      <Search size={17} aria-hidden="true" />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function CourseArt({ course, index }) {
  return (
    <div
      className={`tportal-course-art ${index % 2 ? "lavender" : ""}`}
      aria-hidden="true"
    >
      <span>{course.code}</span>
      <svg viewBox="0 0 420 150">
        <path
          d="M118 76h68m48 0h68m-92-24V20m0 83v28"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".35"
          strokeDasharray="4 5"
        />
        <rect
          x="182"
          y="49"
          width="56"
          height="56"
          rx="14"
          fill="currentColor"
        />
        <path
          d="m210 61 17 9-17 10-17-10 17-9Zm-17 18 17 10 17-10m-34 9 17 10 17-10"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <rect
          x="76"
          y="54"
          width="45"
          height="45"
          rx="11"
          fill="#fff"
          stroke="currentColor"
          strokeOpacity=".3"
        />
        <path
          d="M89 67h19m-19 8h15m-15 8h17"
          stroke="currentColor"
          strokeOpacity=".65"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <rect
          x="300"
          y="54"
          width="45"
          height="45"
          rx="11"
          fill="#fff"
          stroke="currentColor"
          strokeOpacity=".3"
        />
        <path
          d="m312 76 7 7 14-16"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".65"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle
          cx="210"
          cy="21"
          r="12"
          fill="#fff"
          stroke="currentColor"
          strokeOpacity=".3"
        />
        <circle
          cx="210"
          cy="131"
          r="12"
          fill="#fff"
          stroke="currentColor"
          strokeOpacity=".3"
        />
        <path
          d="M205 21h10m-5-5v10m-5 115h10"
          stroke="currentColor"
          strokeOpacity=".6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <small>A SPACE FOR TEACHING</small>
    </div>
  );
}

export default function Teacher() {
  const {
    data,
    role,
    teacher,
    teacherId: contextTeacherId,
    actor,
    courseId,
    course,
    route,
    navigate,
  } = useApp();
  const teacherId = contextTeacherId || teacher?.id || actor?.id;
  const page = route?.teacherPage || "overview";
  const tabsRef = useRef(null);
  useEffect(() => {
    const nav = tabsRef.current,
      tab = nav?.querySelector('[aria-current="page"]');
    if (nav && tab)
      nav.scrollLeft = Math.max(
        0,
        tab.offsetLeft -
          nav.offsetLeft -
          nav.clientWidth +
          tab.clientWidth +
          12,
      );
  }, [page]);
  if (role !== "teacher")
    return (
      <div className="tportal">
        <Empty
          icon={LockKeyhole}
          title="A space for course teachers"
          action={
            <button
              className="btn btn-outline"
              onClick={() => navigate("courses")}
            >
              Back to Courses
            </button>
          }
        >
          Only teacher accounts can manage teaching spaces.
        </Empty>
      </div>
    );
  if (page === "courses") return <TeacherCourses teacherId={teacherId} />;
  if (!canTeach(data, teacherId, courseId))
    return (
      <div className="tportal">
        <Empty
          icon={LockKeyhole}
          title="This course is unavailable"
          action={
            <button
              className="btn btn-outline"
              onClick={() => navigate("teacher-courses")}
            >
              My teaching courses
            </button>
          }
        >
          Only the assigned course teacher can open this space.
        </Empty>
      </div>
    );
  const selected = page === "student" ? "students" : page;
  return (
    <div className="tportal">
      <header className="tportal-course-heading">
        <button
          className="tportal-back"
          onClick={() => navigate("teacher-courses")}
        >
          <ArrowLeft size={15} aria-hidden="true" /> Teaching courses
        </button>
        <div className="tportal-course-title">
          <div>
            <p className="tportal-eyebrow">
              {course.code} <span> / </span> TEACHING SPACE
            </p>
            <h1>{course.name}</h1>
          </div>
          <span className="tportal-term">
            <span />
            {course.term}
          </span>
        </div>
      </header>
      <JoinCode />
      <nav
        className="tportal-tabs"
        ref={tabsRef}
        aria-label="Course management"
      >
        {teacherTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={selected === id ? "active" : ""}
            aria-current={selected === id ? "page" : undefined}
            onClick={() => navigate(`teacher-${id}`, { courseId })}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      {page === "courseware" ? (
        <Courseware />
      ) : page === "materials" ? (
        <TeacherMaterials teacherId={teacherId} />
      ) : page === "students" || page === "student" ? (
        <TeacherStudents teacherId={teacherId} />
      ) : page === "market" ? (
        <div className="tportal-market">
          <Market />
        </div>
      ) : (
        <TeacherOverview teacherId={teacherId} />
      )}
    </div>
  );
}

function TeacherCourses({ teacherId }) {
  const { data, teacher, actor, navigate } = useApp();
  const [query, setQuery] = useState("");
  const courses = data.courses.filter((item) =>
    canTeach(data, teacherId, item.id),
  );
  const threads = visibleThreads(
    data,
    actor || { id: teacherId, role: "teacher" },
  );
  const shown = courses.filter((item) =>
    `${item.code} ${item.name}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="tportal tportal-courses">
      <header className="tportal-library-heading">
        <p className="tportal-eyebrow">YOUR TEACHING SPACES</p>
        <h1>
          Courses<span>.</span>
        </h1>
        <p>Make room for questions. Follow each student’s learning.</p>
      </header>
      <CreateCourse />
      <div className="tportal-toolbar">
        <h2>
          My courses <span>{courses.length}</span>
        </h2>
        <FieldSearch
          label="Search teaching courses"
          placeholder="Search your courses…"
          value={query}
          onChange={setQuery}
        />
      </div>
      {shown.length ? (
        <div className="tportal-courses-grid">
          {shown.map((item, index) => {
            const students = enrolledStudents(data, item.id);
            const materials = data.materials.filter(
              (file) =>
                file.courseId === item.id && !file.ownerId && !file.archivedAt,
            );
            const waiting = threads.filter(
              (thread) =>
                thread.courseId === item.id &&
                threadStatus(thread) === "needs-reply",
            ).length;
            return (
              <article className="tportal-course-card" key={item.id}>
                <a
                  href={`#/teacher/courses/${encodeURIComponent(item.id)}/overview`}
                  aria-label={`Manage ${item.name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate("teacher-overview", { courseId: item.id });
                  }}
                >
                  <CourseArt course={item} index={index} />
                  <div className="tportal-course-card-body">
                    <p className="tportal-course-meta">
                      {item.code}
                      <span>{item.term}</span>
                    </p>
                    <h2>{item.name}</h2>
                    <p className="tportal-course-teacher">
                      {teacher?.name || item.instructor}
                    </p>
                    <p className="tportal-course-description">
                      {item.description}
                    </p>
                    <div className="tportal-course-counts">
                      <span>
                        <Users size={15} aria-hidden="true" />
                        {students.length}{" "}
                        {students.length === 1 ? "student" : "students"}
                      </span>
                      <span>
                        <FileText size={15} aria-hidden="true" />
                        {materials.length}{" "}
                        {materials.length === 1 ? "material" : "materials"}
                      </span>
                    </div>
                    <div
                      className={`tportal-course-pending ${waiting ? "has-pending" : ""}`}
                    >
                      <Inbox size={16} aria-hidden="true" />
                      <span>
                        {waiting
                          ? `${waiting} ${waiting === 1 ? "message needs" : "messages need"} a reply`
                          : "All caught up with your students"}
                      </span>
                      {waiting > 0 && <b>{waiting}</b>}
                    </div>
                    <div className="tportal-course-footer">
                      Open teaching space
                      <ArrowRight size={17} aria-hidden="true" />
                    </div>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={Search}
          title={query ? "No matching courses" : "No teaching courses yet"}
        >
          {query
            ? "Try another course name or course code."
            : "Courses assigned to this teacher will appear here."}
        </Empty>
      )}
      <p className="tportal-footnote">
        <GraduationCap size={16} aria-hidden="true" />
        Your courses, your students, a clearer view of learning.
      </p>
    </div>
  );
}

function TeacherOverview({ teacherId }) {
  const { data, actor, courseId, navigate, openMaterial } = useApp();
  const students = enrolledStudents(data, courseId);
  const rosterIds = new Set(students.map((student) => student.id));
  const sessions = data.sessions
    .filter(
      (session) =>
        session.courseId === courseId && rosterIds.has(session.studentId),
    )
    .sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt));
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekly = sessions.filter(
    (session) => stamp(session.updatedAt) >= cutoff,
  );
  const active = new Set(weekly.map((session) => session.studentId)).size;
  const waiting = visibleThreads(
    data,
    actor || { role: "teacher", id: teacherId },
  ).filter(
    (thread) =>
      thread.courseId === courseId && threadStatus(thread) === "needs-reply",
  ).length;
  const activities = [
    ...sessions.map((session) => ({
      id: session.id,
      type: "session",
      at: session.updatedAt,
      title: session.title,
      student: students.find((student) => student.id === session.studentId),
      item: session,
    })),
    ...data.materials
      .filter(
        (file) =>
          file.courseId === courseId &&
          (!file.ownerId || rosterIds.has(file.ownerId)),
      )
      .map((file) => ({
        id: file.id,
        type: "file",
        at: file.uploadedAt,
        title: file.name,
        student: students.find((student) => student.id === file.ownerId),
        item: file,
      })),
    ...(data.market || [])
      .filter(
        (item) => item.courseId === courseId && rosterIds.has(item.authorId),
      )
      .map((item) => ({
        id: item.id,
        type: "publication",
        at: item.updatedAt,
        title: item.title,
        student: students.find((student) => student.id === item.authorId),
        item,
      })),
  ]
    .sort((a, b) => stamp(b.at) - stamp(a.at))
    .slice(0, 6);
  const review = (session) =>
    navigate("teacher-review", {
      courseId,
      studentId: session.studentId,
      sessionId: session.id,
      returnTo: location.hash,
    });
  return (
    <div className="tportal-content">
      <div className="tportal-section-intro">
        <div>
          <h2>Teaching overview</h2>
          <p>A little context for your next conversation with a student.</p>
        </div>
        <span className="tportal-period">
          <Clock3 size={14} aria-hidden="true" />
          Last 7 days
        </span>
      </div>
      <div className="tportal-stat-grid">
        <Stat
          icon={Users}
          value={students.length}
          label="Enrolled students"
          note="Everyone on this course’s roster"
        />
        <Stat
          icon={Activity}
          value={active}
          label="Active students"
          note="With session activity in 7 days"
        />
        <Stat
          icon={MessageSquare}
          value={weekly.length}
          label="Recent sessions"
          note="Updated in the last 7 days"
        />
        <Stat
          icon={Inbox}
          value={waiting}
          label="Awaiting your reply"
          note="Student messages in this course"
          action={() => navigate("inbox", { courseId, status: "needs-reply" })}
        />
      </div>
      <div className="tportal-overview-columns">
        <section className="tportal-panel">
          <div className="tportal-panel-heading">
            <div>
              <p className="tportal-eyebrow">FROM THEIR CONVERSATIONS</p>
              <h2>Recent questions</h2>
            </div>
            <MessageSquare size={20} aria-hidden="true" />
          </div>
          <p className="tportal-panel-description">
            Open a session to read the question in context.
          </p>
          <div className="tportal-question-list">
            {sessions.slice(0, 4).map((session) => {
              const student = students.find(
                (item) => item.id === session.studentId,
              );
              return (
                <button
                  key={session.id}
                  className="tportal-question"
                  onClick={() => review(session)}
                >
                  <Avatar {...student} size={32} />
                  <span>
                    <small>
                      {student?.name}
                      <i />
                      {date(session.updatedAt)}
                    </small>
                    <strong>{lastQuestion(session)}</strong>
                    <em>{session.title}</em>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              );
            })}
            {!sessions.length && (
              <Empty
                icon={MessageSquare}
                title="The first question is still ahead"
              >
                Student conversations will appear here as learning begins.
              </Empty>
            )}
          </div>
        </section>
        <aside className="tportal-overview-aside">
          <section className="tportal-quick">
            <p className="tportal-eyebrow">A GOOD PLACE TO START</p>
            <h2>Keep the course moving.</h2>
            <button
              onClick={() =>
                navigate("teacher-materials", { courseId, upload: true })
              }
            >
              <UploadCloud size={18} aria-hidden="true" />
              <span>
                Upload course materials
                <small>Add context for the next lesson</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button onClick={() => navigate("teacher-students", { courseId })}>
              <Users size={18} aria-hidden="true" />
              <span>
                Meet your students
                <small>Sessions, files and published work</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button onClick={() => navigate("inbox", { courseId })}>
              <Inbox size={18} aria-hidden="true" />
              <span>
                Open course messages
                <small>
                  {waiting
                    ? `${waiting} waiting for a reply`
                    : "Your conversations with students"}
                </small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
          <div className="tportal-access-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              Review sessions and uploads within your course. Personal Wiki
              notes stay with their author until published.
            </p>
          </div>
        </aside>
      </div>
      <section className="tportal-panel tportal-activity">
        <div className="tportal-panel-heading">
          <div>
            <p className="tportal-eyebrow">THE COURSE, IN MOTION</p>
            <h2>Recent activity</h2>
          </div>
          <span className="tportal-subtle">Latest recorded activity</span>
        </div>
        {activities.length ? (
          <div className="tportal-activity-list">
            {activities.map((event) => {
              const Icon =
                event.type === "session"
                  ? MessageSquare
                  : event.type === "publication"
                    ? BookOpen
                    : FileText;
              return (
                <button
                  key={`${event.type}-${event.id}`}
                  onClick={() =>
                    event.type === "session"
                      ? review(event.item)
                      : event.type === "file"
                        ? openMaterial(event.item.id, 1)
                        : navigate("teacher-market", { courseId })
                  }
                >
                  <span className={`tportal-activity-icon ${event.type}`}>
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {event.student?.name || "Course teacher"} ·{" "}
                      {event.type === "session"
                        ? "Learning session"
                        : event.type === "publication"
                          ? "Published a Wiki snapshot"
                          : "Uploaded a document"}
                    </small>
                  </span>
                  <time>{date(event.at)}</time>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <Empty icon={Activity} title="A fresh course space">
            Uploads, learning sessions and published Wiki snapshots will appear
            here.
          </Empty>
        )}
      </section>
    </div>
  );
}
function Stat({ icon: Icon, value, label, note, action }) {
  const content = (
    <>
      <span className="tportal-stat-label">
        <Icon size={16} aria-hidden="true" />
        {label}
      </span>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <small>
        {note}
        {action && <ArrowRight size={13} aria-hidden="true" />}
      </small>
    </>
  );
  return action ? (
    <button
      className={`tportal-stat ${value ? "accent" : ""}`}
      onClick={action}
    >
      {content}
    </button>
  ) : (
    <div className="tportal-stat">{content}</div>
  );
}

function TeacherStudents() {
  const { data, courseId, route, navigate, openMaterial, toast } = useApp();
  const [query, setQuery] = useState(route?.query || "");
  const [tab, setTab] = useState("sessions");
  const [reading, setReading] = useState(null);
  const [readingPageId, setReadingPageId] = useState(null);
  const students = enrolledStudents(data, courseId);
  const student =
    route?.teacherPage === "student"
      ? students.find((item) => item.id === route.studentId)
      : null;
  useEffect(() => {
    setTab("sessions");
    setReading(null);
  }, [route?.studentId, courseId]);
  useEffect(() => {
    if (route?.teacherPage === "students") setQuery(route?.query || "");
  }, [route?.teacherPage, route?.query]);
  const ownSessions = (id) =>
    data.sessions
      .filter(
        (session) => session.courseId === courseId && session.studentId === id,
      )
      .sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt));
  const ownFiles = (id) =>
    data.materials.filter(
      (file) => file.courseId === courseId && file.ownerId === id,
    );
  const ownPublications = (id) =>
    (data.market || []).filter(
      (item) => item.courseId === courseId && item.authorId === id,
    );
  const lastActivity = (id) =>
    [
      ...ownSessions(id).map((item) => item.updatedAt),
      ...ownFiles(id).map((item) => item.uploadedAt),
      ...ownPublications(id).map((item) => item.updatedAt),
    ].sort((a, b) => stamp(b) - stamp(a))[0];
  const filtered = students.filter((item) =>
    `${item.name} ${item.studentId}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const review = (session) =>
    navigate("teacher-review", {
      courseId,
      studentId: session.studentId,
      sessionId: session.id,
      returnTo: location.hash,
    });
  const pages = reading
    ? reading.pages?.length
      ? reading.pages
      : [
          {
            id: reading.noteId || reading.id,
            title: reading.title,
            content: reading.content,
          },
        ]
    : [];
  const readingPage =
    pages.find((item) => item.id === readingPageId) || pages[0];
  if (route?.teacherPage === "student" && !student)
    return (
      <Empty
        icon={LockKeyhole}
        title="Student unavailable"
        action={
          <button
            className="btn btn-outline"
            onClick={() => navigate("teacher-students", { courseId })}
          >
            Back to students
          </button>
        }
      >
        This student is not enrolled in this course.
      </Empty>
    );
  if (student) {
    const sessions = ownSessions(student.id),
      files = ownFiles(student.id),
      publications = ownPublications(student.id);
    return (
      <div className="tportal-content">
        <button
          className="tportal-back"
          onClick={() =>
            navigate("teacher-students", {
              courseId,
              query: route?.query || query,
            })
          }
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to students
        </button>
        <div className="tportal-student-heading">
          <Avatar {...student} size={56} />
          <div>
            <h2>{student.name}</h2>
            <p>
              {student.studentId} <span> / </span> Last activity:{" "}
              {date(lastActivity(student.id))}
            </p>
          </div>
          <span className="tportal-readonly">
            <ShieldCheck size={14} aria-hidden="true" />
            Course records
          </span>
        </div>
        <div
          className="tportal-detail-tabs"
          role="tablist"
          aria-label="Student course records"
          onKeyDown={(event) => {
            const ids = ["sessions", "files", "published"];
            const current = ids.indexOf(tab);
            const next =
              event.key === "ArrowRight"
                ? ids[(current + 1) % ids.length]
                : event.key === "ArrowLeft"
                  ? ids[(current + ids.length - 1) % ids.length]
                  : event.key === "Home"
                    ? ids[0]
                    : event.key === "End"
                      ? ids.at(-1)
                      : null;
            if (!next) return;
            event.preventDefault();
            setTab(next);
            document.getElementById(`student-tab-${next}`)?.focus();
          }}
        >
          {[
            ["sessions", "Sessions", sessions.length],
            ["files", "Files", files.length],
            ["published", "Published wiki", publications.length],
          ].map(([id, label, count]) => (
            <button
              key={id}
              id={`student-tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              aria-controls={`student-panel-${id}`}
              onClick={() => setTab(id)}
              className={tab === id ? "active" : ""}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <div
          className="tportal-panel tportal-student-records"
          role="tabpanel"
          id={`student-panel-${tab}`}
          aria-labelledby={`student-tab-${tab}`}
        >
          {tab === "sessions" ? (
            sessions.length ? (
              sessions.map((session) => (
                <button
                  key={session.id}
                  className="tportal-record-row"
                  onClick={() => review(session)}
                >
                  <span className="tportal-record-icon">
                    <MessageSquare size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{session.title}</strong>
                    <small>
                      {questionCount(session)}{" "}
                      {questionCount(session) === 1 ? "question" : "questions"}{" "}
                      · Last activity {date(session.updatedAt)}
                    </small>
                  </span>
                  <span className="tportal-review-label">
                    Read-only review{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                </button>
              ))
            ) : (
              <Empty icon={MessageSquare} title="No learning sessions yet">
                This student has not started a conversation in this course.
              </Empty>
            )
          ) : tab === "files" ? (
            files.length ? (
              files.map((file) => (
                <button
                  key={file.id}
                  className="tportal-record-row"
                  onClick={() => openMaterial(file.id, 1)}
                >
                  <span className="tportal-record-icon">
                    <FileText size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {file.type.toUpperCase()} · {formatBytes(file.size)} ·{" "}
                      {file.pages?.length || 0} pages · {date(file.uploadedAt)}
                    </small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ))
            ) : (
              <Empty icon={FileText} title="No personal uploads yet">
                Files uploaded by this student in this course will appear here.
              </Empty>
            )
          ) : publications.length ? (
            publications.map((item) => (
              <button
                key={item.id}
                className="tportal-record-row"
                onClick={() => {
                  setReading(item);
                  setReadingPageId(null);
                }}
              >
                <span className="tportal-record-icon publication">
                  <BookOpen size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    Published snapshot · Version {item.version || 1} ·{" "}
                    {date(item.updatedAt)}
                  </small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))
          ) : (
            <Empty icon={BookOpen} title="No published Wiki yet">
              Only Wiki snapshots this student chooses to publish are visible
              here.
            </Empty>
          )}
        </div>
        <p className="tportal-footnote">
          <LockKeyhole size={14} aria-hidden="true" />
          Only this course’s sessions, uploads and published snapshots are
          shown.
        </p>
        {reading && (
          <Modal
            title={reading.title}
            subtitle={`${reading.author} · Published snapshot · Version ${reading.version || 1}`}
            wide
            onClose={() => setReading(null)}
          >
            {pages.length > 1 && (
              <div
                className="tportal-publication-pages"
                aria-label="Published pages"
              >
                {pages.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === readingPage?.id ? "active" : ""}
                    onClick={() => setReadingPageId(item.id)}
                  >
                    <FileText size={15} aria-hidden="true" />
                    {item.title}
                  </button>
                ))}
              </div>
            )}
            <WikiMarkdown
              content={readingPage?.content || ""}
              notes={pages}
              sourceNote={readingPage}
              onLink={(found, target) =>
                found
                  ? setReadingPageId(found.id)
                  : toast(`“${target}” is not part of this published snapshot.`)
              }
            />
            <p className="tportal-footnote">
              <ShieldCheck size={14} aria-hidden="true" />
              Reading this snapshot does not open or change the student’s
              private notes.
            </p>
          </Modal>
        )}
      </div>
    );
  }
  return (
    <div className="tportal-content">
      <div className="tportal-section-intro">
        <div>
          <h2>
            Your students{" "}
            <span className="tportal-count">{students.length}</span>
          </h2>
          <p>Follow the questions and the work behind them.</p>
        </div>
        <FieldSearch
          label="Search enrolled students"
          placeholder="Search name or student ID…"
          value={query}
          onChange={setQuery}
        />
      </div>
      <div className="tportal-panel tportal-students-table">
        <div className="tportal-student-table-head">
          <span>STUDENT</span>
          <span>SESSIONS</span>
          <span>FILES</span>
          <span>LAST ACTIVITY</span>
          <span />
        </div>
        {filtered.map((item) => (
          <button
            key={item.id}
            className="tportal-student-row"
            onClick={() =>
              navigate("teacher-student", {
                courseId,
                studentId: item.id,
                query,
              })
            }
          >
            <span className="tportal-student-cell">
              <Avatar {...item} size={39} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.studentId}</small>
              </span>
            </span>
            <span className="tportal-student-metric">
              <strong>{ownSessions(item.id).length}</strong>
              <small>sessions</small>
            </span>
            <span className="tportal-student-metric">
              <strong>{ownFiles(item.id).length}</strong>
              <small>files</small>
            </span>
            <span className="tportal-last-activity">
              {date(lastActivity(item.id))}
            </span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        ))}
        {!filtered.length && (
          <Empty
            icon={Users}
            title={query ? "No matching students" : "No enrolled students"}
          >
            {query
              ? "Try another name or student ID."
              : "The course roster will appear here once students are enrolled."}
          </Empty>
        )}
      </div>
      <div className="tportal-access-note">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>
          Students without learning activity stay on the roster. Open a student
          to review their course records.
        </p>
      </div>
    </div>
  );
}

function TeacherMaterials({ teacherId }) {
  const { data, setData, role, courseId, route, toast, openMaterial } =
    useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [uploadOpen, setUploadOpen] = useState(Boolean(route?.upload));
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [downloadId, setDownloadId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const uploadLock = useRef(false);
  const mounted = useRef(true);
  const identity = useRef({ teacherId, courseId, role });
  identity.current = { teacherId, courseId, role };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const materials = data.materials.filter(
    (file) => file.courseId === courseId && !file.ownerId,
  );
  const active = materials.filter((file) => !file.archivedAt),
    archived = materials.filter((file) => file.archivedAt);
  const shown = (filter === "active" ? active : archived)
    .filter((file) =>
      file.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => stamp(b.uploadedAt) - stamp(a.uploadedAt));
  const stillAuthorized = (currentData) =>
    mounted.current &&
    identity.current.role === "teacher" &&
    identity.current.teacherId === teacherId &&
    identity.current.courseId === courseId &&
    canTeach(currentData, teacherId, courseId);
  const closeUpload = () => {
    if (uploadLock.current) return;
    setUploadOpen(false);
    setFiles([]);
    setError("");
  };
  const selectFiles = (list) => {
    if (uploadLock.current) return;
    setFiles(Array.from(list || []));
    setError("");
  };
  async function upload() {
    if (!files.length || uploadLock.current || !stillAuthorized(data)) return;
    uploadLock.current = true;
    setUploading(true);
    setError("");
    const parsed = [],
      failures = [];
    for (const file of files) {
      if (!stillAuthorized(data)) break;
      try {
        const material = await readMaterialFile(file);
        if (!stillAuthorized(data)) break;
        const id = `m-${crypto.randomUUID()}`;
        await saveOriginal(id, file, { courseId });
        parsed.push({
          ...material,
          id,
          hasOriginal: true,
          courseId,
          ownerId: null,
          uploadedBy: teacherId,
          uploadedAt: new Date().toISOString(),
          archivedAt: null,
        });
      } catch (failure) {
        failures.push(`${file.name}: ${failure.message}`);
      }
    }
    if (parsed.length && stillAuthorized(data)) {
      setData((previous) =>
        stillAuthorized(previous)
          ? { ...previous, materials: [...previous.materials, ...parsed] }
          : previous,
      );
      toast(
        `${parsed.length} ${parsed.length === 1 ? "document" : "documents"} added to the course library.`,
      );
      setFilter("active");
    }
    uploadLock.current = false;
    if (!mounted.current) return;
    setUploading(false);
    setFiles([]);
    if (failures.length) setError(failures.join("\n"));
    else setUploadOpen(false);
  }
  function archive(file) {
    if (!stillAuthorized(data)) return;
    const restoring = Boolean(file.archivedAt);
    setData((previous) => {
      if (!stillAuthorized(previous)) return previous;
      return {
        ...previous,
        materials: previous.materials.map((item) =>
          item.id === file.id && item.courseId === courseId && !item.ownerId
            ? {
                ...item,
                archivedAt: restoring ? null : new Date().toISOString(),
                archivedBy: restoring ? null : teacherId,
              }
            : item,
        ),
      };
    });
    toast(
      restoring
        ? "Document restored to the course library."
        : "Document archived. Historical session references remain available.",
    );
  }
  function rename(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || name.length > 180) {
      setRenameError("Enter a document name between 1 and 180 characters.");
      return;
    }
    if (!stillAuthorized(data)) return;
    setData((previous) =>
      stillAuthorized(previous)
        ? {
            ...previous,
            materials: previous.materials.map((file) =>
              file.id === renameId &&
              file.courseId === courseId &&
              !file.ownerId
                ? { ...file, name, renamedBy: teacherId }
                : file,
            ),
          }
        : previous,
    );
    setRenameId(null);
    toast("Document renamed.");
  }
  async function download(file) {
    if (downloadId || !stillAuthorized(data)) return;
    setDownloadId(file.id);
    try {
      const original = file.hasOriginal ? await getOriginal(file.id) : null;
      if (!stillAuthorized(data)) return;
      if (file.hasOriginal && !original)
        throw new Error(
          "The original file is unavailable on the server. Open the document to read its extracted text.",
        );
      const blob =
        original ||
        new Blob([(file.pages || []).map((page) => page.text).join("\n\n")], {
          type: "text/plain;charset=utf-8",
        });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const name = file.name || original?.name || "document";
      const extension =
        original?.name.match(/\.[^.]+$/)?.[0] || `.${file.type}`;
      link.download = original
        ? name.toLowerCase().endsWith(extension.toLowerCase())
          ? name
          : `${name}${extension}`
        : `${name.replace(/\.[^.]+$/, "")}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      toast(failure.message);
    } finally {
      if (mounted.current) setDownloadId(null);
    }
  }
  return (
    <div className="tportal-content">
      <div className="tportal-section-intro">
        <div>
          <h2>Course materials</h2>
          <p>A shared foundation for every student’s questions.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError("");
            setUploadOpen(true);
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Upload materials
        </button>
      </div>
      <div className="tportal-material-notice">
        <span>
          <FolderOpen size={23} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p>
          <strong>
            {active.length} shared{" "}
            {active.length === 1 ? "document" : "documents"}
          </strong>
          <small>Available to everyone enrolled in this course.</small>
        </p>
        <span className="tportal-ready">
          <Check size={13} aria-hidden="true" />
          Local text extraction
        </span>
      </div>
      <div className="tportal-toolbar">
        <div
          className="tportal-material-filters"
          role="group"
          aria-label="Material archive filter"
        >
          <button
            className={filter === "active" ? "active" : ""}
            aria-pressed={filter === "active"}
            onClick={() => setFilter("active")}
          >
            Course library<span>{active.length}</span>
          </button>
          <button
            className={filter === "archived" ? "active" : ""}
            aria-pressed={filter === "archived"}
            onClick={() => setFilter("archived")}
          >
            <Archive size={14} aria-hidden="true" />
            Archived<span>{archived.length}</span>
          </button>
        </div>
        <FieldSearch
          label="Search shared course materials"
          placeholder="Find a document…"
          value={query}
          onChange={setQuery}
        />
      </div>
      <div className="tportal-panel tportal-material-table">
        <div className="tportal-material-table-head">
          <span>DOCUMENT</span>
          <span>PAGES</span>
          <span>ADDED</span>
          <span>ACTIONS</span>
        </div>
        {shown.map((file) => (
          <div key={file.id} className="tportal-material-row">
            <button
              className="tportal-material-open"
              onClick={() => openMaterial(file.id, 1)}
            >
              <span className="tportal-file-kind">
                <FileText size={21} strokeWidth={1.5} aria-hidden="true" />
                <small>{file.type.toUpperCase()}</small>
              </span>
              <span>
                <strong>{file.name}</strong>
                <small>
                  {formatBytes(file.size)}
                  <i />
                  <span className="tportal-ready">
                    <Check size={11} aria-hidden="true" />
                    {file.archivedAt ? "Archived" : "Text ready"}
                  </span>
                </small>
              </span>
            </button>
            <span className="tportal-pages">
              {file.pages?.length || 0}
              <small>pages</small>
            </span>
            <time>{date(file.uploadedAt)}</time>
            <div className="tportal-material-actions">
              <button
                aria-label={`Rename ${file.name}`}
                title="Rename document"
                onClick={() => {
                  setRenameId(file.id);
                  setNewName(file.name);
                  setRenameError("");
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                aria-label={`${file.hasOriginal ? "Download original" : "Download text"} ${file.name}`}
                title={
                  file.hasOriginal
                    ? "Download original"
                    : "Download extracted text"
                }
                disabled={downloadId === file.id}
                onClick={() => download(file)}
              >
                {downloadId === file.id ? (
                  <LoaderCircle
                    size={16}
                    className="tportal-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowDownToLine size={16} aria-hidden="true" />
                )}
              </button>
              <button
                aria-label={`${file.archivedAt ? "Restore" : "Archive"} ${file.name}`}
                title={
                  file.archivedAt ? "Restore document" : "Archive document"
                }
                onClick={() => archive(file)}
              >
                {file.archivedAt ? (
                  <RotateCcw size={16} aria-hidden="true" />
                ) : (
                  <Archive size={16} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ))}
        {!shown.length && (
          <Empty
            icon={filter === "archived" ? Archive : FolderOpen}
            title={
              query
                ? "No matching documents"
                : filter === "archived"
                  ? "Nothing archived"
                  : "Your course library starts here"
            }
          >
            {query
              ? "Try another title or clear the search."
              : filter === "archived"
                ? "Archived documents will stay available through historical session references."
                : "Upload a PDF, Markdown or text document for your students."}
          </Empty>
        )}
      </div>
      <p className="tportal-footnote">
        <ShieldCheck size={15} aria-hidden="true" />
        {filter === "archived"
          ? "Archived documents are excluded from new questions. Existing citations and original files remain available."
          : "Personal student uploads live under Students. This library contains course-wide materials only."}
      </p>
      {uploadOpen && (
        <Modal
          title="Upload course materials"
          subtitle="Shared with everyone enrolled in this course."
          onClose={closeUpload}
        >
          <label
            className={`tportal-dropzone ${dragging ? "dragging" : ""} ${uploading ? "busy" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!uploading) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFiles(event.dataTransfer.files);
            }}
          >
            <input
              ref={input}
              type="file"
              aria-label="Choose course material files"
              multiple
              accept={ACCEPTED_FILES}
              disabled={uploading}
              onChange={(event) => selectFiles(event.target.files)}
            />
            <UploadCloud size={30} strokeWidth={1.5} aria-hidden="true" />
            <strong>
              Choose files <span>or drop them here</span>
            </strong>
            <small>PDF, Markdown or text · up to 10 MB each</small>
          </label>
          {files.length > 0 && (
            <div className="tportal-upload-files">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  <FileText size={16} aria-hidden="true" />
                  <span>
                    {file.name}
                    <small>{formatBytes(file.size)}</small>
                  </span>
                  <Check size={15} aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="tportal-error" role="alert">
              {error}
            </p>
          )}
          <p className="tportal-upload-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Original files and extracted text stay in this browser. Scanned
              PDFs need OCR before upload.
            </span>
          </p>
          <div className="tportal-modal-actions">
            <button
              className="btn btn-outline"
              disabled={uploading}
              onClick={closeUpload}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!files.length || uploading}
              onClick={upload}
            >
              {uploading ? (
                <LoaderCircle
                  size={16}
                  className="tportal-spin"
                  aria-hidden="true"
                />
              ) : (
                <UploadCloud size={16} aria-hidden="true" />
              )}
              {uploading
                ? "Extracting text…"
                : `Add ${files.length > 1 ? `${files.length} documents` : "document"}`}
            </button>
          </div>
        </Modal>
      )}
      {renameId && (
        <Modal
          title="Rename document"
          subtitle="Existing session citations will continue to open this document."
          onClose={() => setRenameId(null)}
        >
          <form className="tportal-rename-form" onSubmit={rename}>
            <label htmlFor="teacher-material-name">Document name</label>
            <input
              id="teacher-material-name"
              value={newName}
              maxLength={180}
              onChange={(event) => {
                setNewName(event.target.value);
                setRenameError("");
              }}
            />
            {renameError && (
              <p className="tportal-error" role="alert">
                {renameError}
              </p>
            )}
            <div className="tportal-modal-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setRenameId(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                Save name
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
