import React, { useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  FileText,
  GraduationCap,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Play,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { formatBytes } from "../lib/files";
import "./course.css";

export default function Teacher() {
  const { data, courseId, course, role, navigate, openMaterial } = useApp();
  const [studentFilter, setStudentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const sessions = data.sessions.filter((s) => s.courseId === courseId);
  const notes = data.notes.filter((n) => n.courseId === courseId);
  const studentFiles = data.materials.filter(
    (m) => m.courseId === courseId && m.ownerId,
  );
  const publicCount = data.materials.filter(
    (m) => m.courseId === courseId && !m.ownerId,
  ).length;
  const students = data.students;
  const visibleStudents = students.filter(
    (student) => studentFilter === "all" || studentFilter === student.id,
  );
  const filteredSessions = sessions
    .filter(
      (session) =>
        (studentFilter === "all" || session.studentId === studentFilter) &&
        (session.title.toLowerCase().includes(search.toLowerCase()) ||
          students
            .find((s) => s.id === session.studentId)
            ?.name.toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const filteredFiles = studentFiles.filter(
    (file) => studentFilter === "all" || file.ownerId === studentFilter,
  );
  const selectedStudent = students.find(
    (student) => student.id === studentFilter,
  );
  const activeStudents = new Set(sessions.map((session) => session.studentId))
    .size;

  if (role !== "teacher")
    return (
      <div className="course-page course-empty teacher-denied">
        <span className="teacher-denied-icon">
          <LockKeyhole size={30} />
        </span>
        <h1>A space for your teacher.</h1>
        <p>Student sessions can only be reviewed in teacher mode.</p>
        <button className="btn primary" onClick={() => navigate("overview")}>
          Back to my course
        </button>
      </div>
    );

  return (
    <div className="course-page teacher-page">
      <div className="course-page-heading">
        <div>
          <div className="course-eyebrow">THE TEACHER’S PERSPECTIVE</div>
          <h1>A window into learning.</h1>
          <p>Follow the questions, not just the final answers.</p>
        </div>
        <span className="teacher-course-status">
          <span /> {course?.term || "Fall 2026"} · Course in progress
        </span>
      </div>
      <div className="teacher-stats">
        <div>
          <span className="teacher-stat-label">
            <Users size={16} /> Enrolled students
          </span>
          <strong>{students.length.toString().padStart(2, "0")}</strong>
          <p>{activeStudents} learning in this course</p>
        </div>
        <div>
          <span className="teacher-stat-label">
            <MessageSquare size={16} /> Learning sessions
          </span>
          <strong>{sessions.length.toString().padStart(2, "0")}</strong>
          <p>Questions becoming understanding</p>
        </div>
        <div>
          <span className="teacher-stat-label">
            <BookOpen size={16} /> Knowledge pages
          </span>
          <strong>{notes.length.toString().padStart(2, "0")}</strong>
          <p>Ideas captured by your students</p>
        </div>
        <div>
          <span className="teacher-stat-label">
            <FileText size={16} /> Course materials
          </span>
          <strong>{publicCount.toString().padStart(2, "0")}</strong>
          <p>
            <button onClick={() => navigate("materials")}>
              Manage your library <ArrowUpRight size={13} />
            </button>
          </p>
        </div>
      </div>
      <div className="teacher-review-note">
        <ShieldCheck size={17} />
        <p>
          Students know their course teacher can review sessions and uploaded
          files.
        </p>
        <span>
          <Eye size={14} /> Read-only review
        </span>
      </div>
      <section className="teacher-students-section">
        <div className="teacher-section-heading">
          <div>
            <h2>
              Your students <span>{students.length}</span>
            </h2>
            <p>Every learner has their own path.</p>
          </div>
          <label className="teacher-student-filter">
            <span>View</span>
            <select
              aria-label="Filter by student"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
            >
              <option value="all">All students</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="teacher-student-grid">
          {visibleStudents.map((student) => {
            const studentSessions = sessions.filter(
              (session) => session.studentId === student.id,
            );
            const studentNotes = notes.filter(
              (note) => note.studentId === student.id,
            );
            const studentAttachments = studentFiles.filter(
              (file) => file.ownerId === student.id,
            );
            return (
              <button
                className={`teacher-student-card ${studentFilter === student.id ? "selected" : ""}`}
                key={student.id}
                onClick={() =>
                  setStudentFilter(
                    studentFilter === student.id ? "all" : student.id,
                  )
                }
                aria-pressed={studentFilter === student.id}
              >
                <div className="teacher-student-card-top">
                  <span
                    className="teacher-avatar"
                    style={{ "--student-color": student.color }}
                  >
                    {student.initials}
                  </span>
                  <span className="teacher-student-arrow">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
                <h3>{student.name}</h3>
                <p>{student.studentId}</p>
                <div className="teacher-student-card-stats">
                  <span>
                    <strong>{studentSessions.length}</strong>sessions
                  </span>
                  <span>
                    <strong>{studentNotes.length}</strong>wiki pages
                  </span>
                  <span>
                    <strong>{studentAttachments.length}</strong>files
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <div className="teacher-content-layout">
        <section className="teacher-sessions-panel">
          <div className="teacher-section-heading">
            <div>
              <h2>
                {selectedStudent
                  ? `${selectedStudent.name.split(" ")[0]}’s sessions`
                  : "Learning sessions"}{" "}
                <span>{filteredSessions.length}</span>
              </h2>
              <p>See how understanding takes shape.</p>
            </div>
            <label className="course-search">
              <Search size={15} />
              <input
                placeholder="Search sessions…"
                aria-label="Search learning sessions"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="teacher-session-table">
            <div className="teacher-session-head">
              <span>SESSION / STUDENT</span>
              <span>
                LAST ACTIVITY <ArrowDown size={11} />
              </span>
              <span />
            </div>
            {filteredSessions.map((session) => {
              const student = students.find((s) => s.id === session.studentId);
              return (
                <button
                  className="teacher-session-row"
                  key={session.id}
                  onClick={() => navigate("studio", { sessionId: session.id })}
                >
                  <span>
                    <span className="teacher-session-title">
                      {session.title}
                    </span>
                    <span className="teacher-session-student">
                      <span
                        className="teacher-avatar small"
                        style={{ "--student-color": student?.color }}
                      >
                        {student?.initials}
                      </span>
                      {student?.name}
                      <i />
                      {
                        session.messages.filter((m) => m.role === "user").length
                      }{" "}
                      {session.messages.filter((m) => m.role === "user")
                        .length === 1
                        ? "question"
                        : "questions"}
                      {session.animation && (
                        <span className="teacher-animation-tag">
                          <Play size={10} /> Animation
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="teacher-session-time">
                    {new Date(session.updatedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                    <small>
                      {new Date(session.updatedAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Hong_Kong",
                      })}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
            {!filteredSessions.length && (
              <div className="course-empty">
                <MessageSquare size={28} />
                <h3>No sessions to show yet</h3>
                <p>
                  {search
                    ? "Try another search or choose a different student."
                    : "Learning sessions will appear here when a student starts a conversation."}
                </p>
                {(search || studentFilter !== "all") && (
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setSearch("");
                      setStudentFilter("all");
                    }}
                  >
                    Show all sessions
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
        <aside className="teacher-attachments-panel">
          <div className="teacher-section-heading">
            <div>
              <h2>
                Student files <span>{filteredFiles.length}</span>
              </h2>
              <p>Context behind the questions.</p>
            </div>
            <Layers3 size={19} />
          </div>
          <div className="teacher-attachment-list">
            {filteredFiles.map((file) => {
              const owner = students.find(
                (student) => student.id === file.ownerId,
              );
              return (
                <button key={file.id} onClick={() => openMaterial(file.id, 1)}>
                  <span className="teacher-attachment-icon">
                    <FileText size={19} />
                  </span>
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {owner?.name} · {formatBytes(file.size)}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              );
            })}
            {!filteredFiles.length && (
              <div className="teacher-no-attachments">
                <FileText size={23} />
                <p>No personal files uploaded yet.</p>
              </div>
            )}
          </div>
          <div className="teacher-attachment-footer">
            <LockKeyhole size={14} />
            <p>
              Personal files are available to their owner and the course
              teacher.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
