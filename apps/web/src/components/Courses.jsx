import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  FileText,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { visibleCourses } from "../lib/access";
import "./courses.css";
import {JoinCourse} from "./CourseActions";

function CourseCover({ course, index }) {
  const web = course.id === "web" || index % 2 === 1;
  return (
    <div
      className={`courses-cover ${web ? "courses-cover-web" : "courses-cover-software"}`}
      aria-hidden="true"
    >
      <div className="courses-cover-grid" />
      <span className="courses-cover-code">{course.code}</span>
      {web ? (
        <svg viewBox="0 0 440 210" className="courses-cover-art">
          <rect
            x="131"
            y="31"
            width="219"
            height="142"
            rx="10"
            fill="#e4dcec"
            stroke="#c5b4d4"
          />
          <rect
            x="94"
            y="47"
            width="238"
            height="143"
            rx="10"
            fill="#fffdfa"
            stroke="#b8a5ce"
            strokeWidth="1.5"
          />
          <path d="M94 74h238" stroke="#d8cce2" />
          <circle cx="108" cy="61" r="2.5" fill="#8b6ac0" />
          <circle cx="118" cy="61" r="2.5" fill="#c6b6d6" />
          <circle cx="128" cy="61" r="2.5" fill="#c6b6d6" />
          <rect x="111" y="89" width="73" height="83" rx="4" fill="#f0eaf5" />
          <rect x="199" y="91" width="97" height="5" rx="2.5" fill="#b9a5cc" />
          <rect x="199" y="103" width="68" height="4" rx="2" fill="#e2d8eb" />
          <rect x="199" y="122" width="49" height="49" rx="4" fill="#e9e2f0" />
          <rect x="258" y="122" width="57" height="49" rx="4" fill="#f5f0e7" />
          <path
            d="m134 119-10 10 10 10m24-20 10 10-10 10m-9-25-7 30"
            fill="none"
            stroke="#8b6ac0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="309"
            y="137"
            width="33"
            height="53"
            rx="5"
            fill="#fffdfa"
            stroke="#9f83bc"
            strokeWidth="1.5"
          />
          <rect x="315" y="146" width="21" height="25" rx="2" fill="#e8deef" />
          <path
            d="M320 181h11"
            stroke="#c4b1d3"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="362" cy="69" r="13" fill="#f9f6ed" />
          <path
            d="m358 69 3 3 5-6"
            fill="none"
            stroke="#a995bd"
            strokeWidth="1.5"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 440 210" className="courses-cover-art">
          <path
            d="M116 108h68m72 0h68M220 70V39m0 138v-31"
            stroke="#9baddb"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />
          <rect x="180" y="69" width="80" height="80" rx="19" fill="#3156d3" />
          <path
            d="m220 88 22 12-22 12-22-12 22-12Zm-22 23 22 12 22-12m-44 12 22 12 22-12"
            stroke="#fff"
            strokeWidth="2"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <rect
            x="72"
            y="82"
            width="51"
            height="51"
            rx="13"
            fill="#fffdfa"
            stroke="#c7d2eb"
          />
          <path
            d="M86 98h22m-22 7h16m-16 7h19m-19 7h11"
            stroke="#8b9eca"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="317"
            y="82"
            width="51"
            height="51"
            rx="13"
            fill="#fffdfa"
            stroke="#c7d2eb"
          />
          <path
            d="m331 108 8 8 15-18"
            stroke="#7e94bf"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="220" cy="35" r="15" fill="#fffdfa" stroke="#c7d2eb" />
          <path
            d="M215 35h10m-5-5v10"
            stroke="#8b9eca"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="220" cy="180" r="15" fill="#fffdfa" stroke="#c7d2eb" />
          <path d="m216 175 8 5-8 5v-10Z" fill="#8b9eca" />
          <circle cx="138" cy="51" r="4" fill="#bfccdF" />
          <circle cx="308" cy="165" r="4" fill="#bfccdf" />
        </svg>
      )}
      <span className="courses-cover-subject">
        {web ? "BUILD FOR THE WEB" : "IDEAS INTO SOFTWARE"}
      </span>
    </div>
  );
}

export default function Courses() {
  const { data, user, actor, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("All terms");
  const courses = visibleCourses(data, actor);
  const terms = [...new Set(courses.map((item) => item.term).filter(Boolean))];
  const shown = useMemo(
    () =>
      courses.filter(
        (item) =>
          (term === "All terms" || item.term === term) &&
          `${item.name} ${item.code} ${item.instructor}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [courses, query, term],
  );
  const belongsToUser = (item) =>
    item.studentId === user.id || item.studentId === user.studentId;

  return (
    <div className="courses-page">
      <header className="courses-heading">
        <div className="courses-eyebrow">YOUR LEARNING SPACES</div>
        <h1>
          Courses<span>.</span>
        </h1>
        <p>
          Your materials, conversations, and growing understanding. All in one
          place.
        </p>
      </header>

      <JoinCourse/>
      <div className="courses-toolbar">
        <p className="courses-list-label">
          My courses <span>{courses.length}</span>
        </p>
        <div className="courses-controls">
          <div className="courses-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Search courses"
              placeholder="Search courses…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear course search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <label className="courses-term">
            <select
              aria-label="Filter courses by term"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            >
              <option>All terms</option>
              {terms.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>
      </div>

      {shown.length ? (
        <div className="courses-grid">
          {shown.map((item, index) => {
            const materials = (data.materials || []).filter(
              (material) =>
                material.courseId === item.id &&
                !material.ownerId &&
                !material.archivedAt,
            );
            const sessions = (data.sessions || [])
              .filter(
                (session) =>
                  session.courseId === item.id && belongsToUser(session),
              )
              .sort(
                (a, b) =>
                  (Date.parse(b.updatedAt) || 0) -
                  (Date.parse(a.updatedAt) || 0),
              );
            const notes = (data.notes || []).filter(
              (note) => note.courseId === item.id && belongsToUser(note),
            );
            const recent = sessions[0];
            return (
              <article className="courses-card" key={item.id}>
                <a
                  className="courses-card-link"
                  href={`#/courses/${encodeURIComponent(item.id)}${recent ? `?session=${encodeURIComponent(recent.id)}` : ""}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate("course", {
                      courseId: item.id,
                      sessionId: recent?.id,
                    });
                  }}
                  aria-label={`Open ${item.name}`}
                >
                  <CourseCover course={item} index={index} />
                  <div className="courses-card-body">
                    <div className="courses-card-meta">
                      <span>{item.code}</span>
                      <span>{item.term}</span>
                    </div>
                    <h2>{item.name}</h2>
                    <p className="courses-instructor">{item.instructor}</p>
                    <p className="courses-description">{item.description}</p>
                    <div className="courses-counts">
                      <span>
                        <FileText size={14} aria-hidden="true" />
                        {materials.length}{" "}
                        {materials.length === 1 ? "material" : "materials"}
                      </span>
                      <span>
                        <MessageSquare size={14} aria-hidden="true" />
                        {sessions.length}{" "}
                        {sessions.length === 1 ? "session" : "sessions"}
                      </span>
                      <span>
                        <BookOpen size={14} aria-hidden="true" />
                        {notes.length} wiki{" "}
                        {notes.length === 1 ? "page" : "pages"}
                      </span>
                    </div>
                    <div className="courses-recent">
                      <span className="courses-recent-label">
                        {recent
                          ? "YOUR LAST CONVERSATION"
                          : "A NEW SPACE TO EXPLORE"}
                      </span>
                      <p>
                        {recent?.title ||
                          "Open your materials and start a conversation."}
                      </p>
                    </div>
                    <div className="courses-card-footer">
                      <span>
                        {recent ? "Continue learning" : "Open course"}
                      </span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </div>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="courses-empty">
          <Search size={25} aria-hidden="true" />
          <h2>No courses found</h2>
          <p>Try a different course name, code, or instructor.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTerm("All terms");
            }}
          >
            Clear filters <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="courses-bottom-note">
        <BookOpen size={14} aria-hidden="true" />
        One course. Your own space to make sense of it.
      </p>
    </div>
  );
}
