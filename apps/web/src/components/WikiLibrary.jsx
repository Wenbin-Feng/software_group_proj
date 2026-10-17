import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileText,
  Link2,
  Network,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { canReadPrivateNote, visibleCourses } from "../lib/access";
import { outgoingLinks } from "../lib/wikiLinks";
import "./wiki-library.css";

const plainExcerpt = (content = "") =>
  content
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_, target, alias) => alias || target,
    )
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently edited"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NoteCover({ index, course }) {
  const variant = index % 3;
  const points = [
    [
      [54, 57],
      [106, 27],
      [138, 78],
      [199, 47],
      [232, 92],
      [278, 33],
    ],
    [
      [48, 79],
      [100, 33],
      [145, 67],
      [196, 23],
      [232, 80],
      [285, 45],
    ],
    [
      [52, 33],
      [103, 82],
      [150, 39],
      [205, 73],
      [239, 25],
      [283, 84],
    ],
  ][variant];
  const edges = [
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 5],
  ];
  return (
    <div
      className={`wiki-library-cover wiki-library-cover-${variant}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 330 112" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern
            id={`wiki-note-grid-${index}`}
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="currentColor" opacity="0.13" />
          </pattern>
        </defs>
        <rect width="330" height="112" fill={`url(#wiki-note-grid-${index})`} />
        {edges.map(([start, end]) => (
          <path
            key={`${start}-${end}`}
            d={`M${points[start][0]} ${points[start][1]}L${points[end][0]} ${points[end][1]}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        {points.map(([x, y], i) => (
          <g key={i}>
            {i === 2 && (
              <circle cx={x} cy={y} r="16" fill="currentColor" opacity="0.08" />
            )}
            <circle
              cx={x}
              cy={y}
              r={i === 2 ? 5 : 3.5}
              fill="currentColor"
              opacity={i === 2 ? 0.85 : 0.38}
            />
          </g>
        ))}
      </svg>
      <span className="wiki-library-course-badge">
        <BookOpen size={11} />
        {course?.code || "Personal wiki"}
      </span>
      <span className="wiki-library-cover-icon">
        <FileText size={17} strokeWidth={1.6} />
      </span>
    </div>
  );
}

export default function WikiLibrary({ onCreate }) {
  const { data, user, actor, role, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const isTeacher = role === "teacher";
  const notes = useMemo(
    () =>
      (data.notes || [])
        .filter(
          (note) => role === "student" && canReadPrivateNote(data, actor, note),
        )
        .sort(
          (a, b) =>
            (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
        ),
    [data, role, actor],
  );
  const courseIds = new Set(notes.map((note) => note.courseId));
  const courses = visibleCourses(data, actor).filter((course) =>
    courseIds.has(course.id),
  );
  const shown = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return notes.filter((note) => {
      const course = data.courses.find((item) => item.id === note.courseId);
      const text =
        `${note.title} ${note.content || ""} ${note.category || ""} ${(note.tags || []).join(" ")} ${course?.name || ""} ${course?.code || ""}`.toLocaleLowerCase();
      return (
        (courseFilter === "all" || note.courseId === courseFilter) &&
        (!search || text.includes(search))
      );
    });
  }, [notes, query, courseFilter, data.courses]);

  const clearFilters = () => {
    setQuery("");
    setCourseFilter("all");
  };

  if (role !== "student")
    return (
      <div className="vault-unavailable">
        <ShieldCheck size={32} />
        <h1>Personal wikis belong to students</h1>
        <p>Only published snapshots are shared with course teachers.</p>
      </div>
    );

  return (
    <div className="wiki-library">
      <header className="wiki-library-heading">
        <div>
          <div className="wiki-library-eyebrow">YOUR CONNECTED KNOWLEDGE</div>
          <h1>
            {isTeacher ? "Student wikis" : "My wiki"}
            <span>.</span>
          </h1>
          <p>
            {isTeacher
              ? "A read-only view of student notes, across your courses."
              : "Every small insight, connected. Your notes from every course."}
          </p>
          <div className="wiki-library-summary">
            <span>
              <FileText size={14} aria-hidden="true" />
              <strong>{notes.length}</strong>{" "}
              {notes.length === 1 ? "note" : "notes"}
            </span>
            <span className="wiki-library-summary-dot" aria-hidden="true" />
            <span>
              <BookOpen size={14} aria-hidden="true" />
              <strong>{courses.length}</strong>{" "}
              {courses.length === 1 ? "course" : "courses"}
            </span>
          </div>
        </div>
        {!isTeacher && onCreate && (
          <button
            className="btn btn-primary wiki-library-create"
            type="button"
            onClick={onCreate}
          >
            <Plus size={16} aria-hidden="true" />
            New note
          </button>
        )}
      </header>

      <div className="wiki-library-toolbar">
        <p className="wiki-library-list-label">
          {courseFilter === "all"
            ? "All notes"
            : data.courses.find((course) => course.id === courseFilter)?.code ||
              "Notes"}
          <span aria-label={`${shown.length} matching notes`}>
            {shown.length}
          </span>
        </p>
        <div className="wiki-library-controls">
          <div className="wiki-library-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search all wiki notes"
              placeholder="Search your notes…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear wiki search"
                onClick={() => setQuery("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <label className="wiki-library-filter">
            <select
              aria-label="Filter wiki notes by course"
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
            >
              <option value="all">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>
      </div>

      {shown.length ? (
        <div className="wiki-library-grid" aria-label="Wiki notes">
          {shown.map((note, index) => {
            const course = data.courses.find(
              (item) => item.id === note.courseId,
            );
            const owner = data.students.find(
              (student) =>
                student.id === note.studentId ||
                student.studentId === note.studentId,
            );
            const linkCount = outgoingLinks(note, notes).length;
            return (
              <article className="wiki-library-card" key={note.id}>
                <a
                  className="wiki-library-card-link"
                  href={`#/wiki?note=${encodeURIComponent(note.id)}&course=${encodeURIComponent(note.courseId)}`}
                  aria-label={`Open wiki note ${note.title}`}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    navigate("wiki", { noteId: note.id });
                  }}
                >
                  <NoteCover index={index} course={course} />
                  <div className="wiki-library-card-body">
                    <span className="wiki-library-category">
                      {note.category || "Notes & ideas"}
                    </span>
                    <h2>{note.title}</h2>
                    <p className="wiki-library-excerpt">
                      {plainExcerpt(note.content) ||
                        "A new thought, ready to grow. Open this note to start writing."}
                    </p>
                    <div className="wiki-library-tags">
                      {(note.tags || []).slice(0, 2).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                    {isTeacher && (
                      <p className="wiki-library-owner">
                        {owner?.name || "Student"}
                        <span>Read only</span>
                      </p>
                    )}
                    <div className="wiki-library-card-footer">
                      <span className="wiki-library-links">
                        <Link2 size={13} aria-hidden="true" />
                        {linkCount} {linkCount === 1 ? "link" : "links"}
                      </span>
                      <span className="wiki-library-updated">
                        {formatDate(note.updatedAt)}
                      </span>
                      <ArrowUpRight
                        size={17}
                        className="wiki-library-open-arrow"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="wiki-library-empty">
          {notes.length ? (
            <Search size={27} aria-hidden="true" />
          ) : (
            <Network size={29} aria-hidden="true" />
          )}
          <h2>
            {notes.length ? "No matching notes" : "Your knowledge starts here"}
          </h2>
          <p>
            {notes.length
              ? "Try a different search, or explore another course."
              : "Save an insight from a course conversation, or create your first note."}
          </p>
          {notes.length ? (
            <button
              className="btn btn-outline"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          ) : (
            !isTeacher &&
            onCreate && (
              <button
                className="btn btn-primary"
                onClick={onCreate}
                type="button"
              >
                <Plus size={15} />
                Create a note
              </button>
            )
          )}
        </div>
      )}
      <p className="wiki-library-footnote">
        <Network size={14} aria-hidden="true" />
        Open any note to explore its links and knowledge graph.
      </p>
    </div>
  );
}
