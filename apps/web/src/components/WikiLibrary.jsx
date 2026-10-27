import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  FileText,
  Network,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { canReadPrivateNote, visibleCourses } from "../lib/access";
import "./wiki-library.css";

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
          (note) => role === "student" && canReadPrivateNote(data, actor, note) && !note.ledger,
        )
        .sort(
          (a, b) =>
            (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
        ),
    [data, role, actor],
  );
  const wikis = useMemo(() => {
    const roots = notes.filter((note) => note.wikiRoot);
    const made = roots.map((root) => ({
      id: root.id,
      title: root.title,
      courseId: root.courseId,
      updatedAt: root.updatedAt,
      pages: notes.filter(
        (note) => note.wikiId === root.id && !note.ledger && !note.wikiRoot,
      ),
    }));
    const legacy = [];
    for (const note of notes) {
      if (note.wikiRoot || note.wikiId || note.ledger) continue;
      const existing = legacy.find((item) => item.courseId === note.courseId);
      if (existing) existing.pages.push(note);
      else
        legacy.push({
          id: `legacy:${note.courseId}`,
          title:
            data.courses.find((course) => course.id === note.courseId)?.name ||
            "Course notes",
          courseId: note.courseId,
          updatedAt: note.updatedAt,
          pages: [note],
          legacy: true,
        });
    }
    return [...made, ...legacy].sort(
      (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
    );
  }, [notes, data.courses]);
  const courseIds = new Set(wikis.map((wiki) => wiki.courseId));
  const courses = visibleCourses(data, actor).filter((course) =>
    courseIds.has(course.id),
  );
  const shown = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return wikis.filter((wiki) => {
      const course = data.courses.find((item) => item.id === wiki.courseId);
      const text =
        `${wiki.title} ${course?.name || ""} ${course?.code || ""} ${wiki.pages.map((page) => page.title).join(" ")}`.toLocaleLowerCase();
      return (
        (courseFilter === "all" || wiki.courseId === courseFilter) &&
        (!search || text.includes(search))
      );
    });
  }, [wikis, query, courseFilter, data.courses]);

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
              : "Each wiki is one subject. Generate it from a course, or start empty."}
          </p>
          <div className="wiki-library-summary">
            <span>
              <FileText size={14} aria-hidden="true" />
              <strong>{wikis.length}</strong>{" "}
              {wikis.length === 1 ? "wiki" : "wikis"}
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
            New wiki
          </button>
        )}
      </header>

      <div className="wiki-library-toolbar">
        <p className="wiki-library-list-label">
          {courseFilter === "all"
            ? "All wikis"
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
              aria-label="Search wikis"
              placeholder="Search your wikis…"
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
              aria-label="Filter wikis by course"
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
        <div className="wiki-library-grid" aria-label="Wikis">
          {shown.map((wiki, index) => {
            const course = data.courses.find((item) => item.id === wiki.courseId);
            const openId = wiki.pages[0]?.id || wiki.id;
            return (
              <article className="wiki-library-card" key={wiki.id}>
                <a
                  className="wiki-library-card-link"
                  href={`#/wiki?wiki=${encodeURIComponent(wiki.id)}&note=${encodeURIComponent(openId)}&course=${encodeURIComponent(wiki.courseId)}`}
                  aria-label={`Open wiki ${wiki.title}`}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    navigate("wiki", {
                      wikiId: wiki.id,
                      noteId: openId,
                      courseId: wiki.courseId,
                    });
                  }}
                >
                  <NoteCover index={index} course={course} />
                  <div className="wiki-library-card-body">
                    <span className="wiki-library-category">
                      {wiki.legacy ? "Earlier notes" : wiki.pages.length ? "Generated wiki" : "Empty wiki"}
                    </span>
                    <h2>{wiki.title}</h2>
                    <p>
                      {wiki.pages.length
                        ? `${wiki.pages.length} ${wiki.pages.length === 1 ? "page" : "pages"}`
                        : "No pages yet"}
                    </p>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="wiki-library-empty">
          {wikis.length ? (
            <Search size={27} aria-hidden="true" />
          ) : (
            <Network size={29} aria-hidden="true" />
          )}
          <h2>
            {wikis.length ? "No matching wikis" : "Your knowledge starts here"}
          </h2>
          <p>
            {wikis.length
              ? "Try a different search, or look in another course."
              : "Generate a wiki from a course, or start an empty one."}
          </p>
          {wikis.length ? (
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
                Create a wiki
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
