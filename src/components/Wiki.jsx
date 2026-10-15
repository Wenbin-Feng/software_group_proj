import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Check,
  FileText,
  FolderOpen,
  GitBranch,
  Link2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { Modal } from "./ui";
import LearningAnimation from "./Animation";
import "./wiki.css";

const owns = (note, user) =>
  note.studentId === user.id || note.studentId === user.studentId;
export const friendlyDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value || "today"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const avatarStyle = (color) => ({
  background: color?.length === 7 ? `${color}18` : "#eef0f6",
  color: color || "#64728a",
});
const textKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");

export function WikiMarkdown({ content = "", notes = [], onLink }) {
  const inline = (text, key) =>
    text.split(/(\[\[.*?\]\]|\*\*.*?\*\*|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const [target, label] = part.slice(2, -2).split("|");
        const found = notes.find(
          (n) => textKey(n.title) === textKey(target) || n.id === target,
        );
        return (
          <button
            className="wiki-inline-link"
            type="button"
            key={`${key}-${i}`}
            onClick={() => onLink?.(found, target)}
          >
            <Link2 size={12} />
            {label || found?.title || target}
          </button>
        );
      }
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={`${key}-${i}`}>{part.slice(1, -1)}</code>;
      return part;
    });
  const blocks = content.split("\n");
  let inCode = false;
  return (
    <div className="wiki-markdown">
      {blocks.map((line, i) => {
        if (line.startsWith("```")) {
          inCode = !inCode;
          return null;
        }
        if (inCode) return <pre key={i}>{line || " "}</pre>;
        if (!line.trim()) return <div className="wiki-paragraph-gap" key={i} />;
        if (line.startsWith("### "))
          return <h3 key={i}>{inline(line.slice(4), i)}</h3>;
        if (line.startsWith("## "))
          return (
            <h2 id={`section-${i}`} key={i}>
              {inline(line.slice(3), i)}
            </h2>
          );
        if (line.startsWith("# "))
          return <h2 key={i}>{inline(line.slice(2), i)}</h2>;
        if (/^[-*] /.test(line))
          return (
            <div className="wiki-list-line" key={i}>
              <span className="wiki-list-dot" />
              <span>{inline(line.slice(2), i)}</span>
            </div>
          );
        if (/^\d+\. /.test(line))
          return (
            <div className="wiki-list-line" key={i}>
              <span className="wiki-list-number">{line.match(/^\d+/)[0]}.</span>
              <span>{inline(line.replace(/^\d+\. /, ""), i)}</span>
            </div>
          );
        if (line.startsWith("> "))
          return <blockquote key={i}>{inline(line.slice(2), i)}</blockquote>;
        if (line === "---") return <hr key={i} />;
        return <p key={i}>{inline(line, i)}</p>;
      })}
    </div>
  );
}

function ConceptAnimation() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stages = [
    "Start with a consistent balance.",
    "Read the balance into the transaction.",
    "Apply the update as one complete unit.",
    "Commit. The new state is safely stored.",
  ];
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(
      () =>
        setStep((s) => {
          if (s >= 3) {
            setPlaying(false);
            return 3;
          }
          return s + 1;
        }),
      1450,
    );
    return () => clearInterval(interval);
  }, [playing]);
  return (
    <div className="wiki-animation">
      <div className="wiki-animation-top">
        <span>
          <Sparkles size={14} /> A concept, in motion
        </span>
        <span>HTML EXPLAINER</span>
      </div>
      <div className="wiki-animation-canvas">
        <div className={`wiki-anim-node ${step === 0 ? "is-active" : ""}`}>
          <span className="wiki-anim-symbol">
            <FileText size={21} />
          </span>
          <strong>Account A</strong>
          <span>${step >= 2 ? "450" : "500"}</span>
        </div>
        <div className="wiki-anim-connector">
          <div
            className={step > 0 ? "wiki-moving-dot moved" : "wiki-moving-dot"}
          />
          <span>
            {step >= 3 ? "committed" : step >= 1 ? "transfer $50" : "ready"}
          </span>
        </div>
        <div
          className={`wiki-anim-transaction ${step === 1 || step === 2 ? "is-active" : ""}`}
        >
          <ShieldCheck size={23} />
          <span>
            ATOMIC
            <br />
            TRANSACTION
          </span>
        </div>
        <div className="wiki-anim-connector">
          <div
            className={step > 1 ? "wiki-moving-dot moved" : "wiki-moving-dot"}
          />
          <span>{step >= 3 ? "complete" : "all or nothing"}</span>
        </div>
        <div className={`wiki-anim-node ${step === 3 ? "is-active" : ""}`}>
          <span className="wiki-anim-symbol">
            <FileText size={21} />
          </span>
          <strong>Account B</strong>
          <span>${step >= 2 ? "250" : "200"}</span>
        </div>
      </div>
      <div className="wiki-animation-bottom">
        <button
          className="wiki-play-btn"
          aria-label={playing ? "Pause animation" : "Play animation"}
          onClick={() => {
            if (step === 3) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? (
            <Square size={12} fill="currentColor" />
          ) : (
            <Play size={13} fill="currentColor" />
          )}
        </button>
        <span aria-live="polite">{stages[step]}</span>
        <button
          className="icon-btn"
          aria-label="Reset animation"
          onClick={() => {
            setStep(0);
            setPlaying(false);
          }}
        >
          <RotateCcw size={14} />
        </button>
        <span className="wiki-step">{step + 1} / 4</span>
      </div>
    </div>
  );
}

function KnowledgeGraph({ notes, activeId, onSelect }) {
  const shown = notes.slice(0, 6);
  const coords = [
    [116, 78],
    [52, 31],
    [190, 34],
    [38, 127],
    [187, 127],
    [118, 151],
  ];
  return (
    <div className="wiki-graph">
      <svg
        viewBox="0 0 232 177"
        role="img"
        aria-label="Knowledge graph showing links between your notes"
      >
        {shown.slice(1).map((n, i) => (
          <line
            key={n.id}
            x1={coords[0][0]}
            y1={coords[0][1]}
            x2={coords[i + 1][0]}
            y2={coords[i + 1][1]}
            stroke="#dce2ed"
            strokeWidth="1.3"
          />
        ))}
        {shown.map((note, i) => (
          <g
            key={note.id}
            onClick={() => onSelect(note.id)}
            className="wiki-graph-node"
            role="button"
            tabIndex="0"
            aria-label={`Open ${note.title}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(note.id);
              }
            }}
          >
            <circle
              cx={coords[i][0]}
              cy={coords[i][1]}
              r={note.id === activeId ? 9 : 5}
              fill={note.id === activeId ? "#3156d3" : "#b1bdd8"}
            />
            <text
              x={coords[i][0]}
              y={coords[i][1] + 19}
              textAnchor="middle"
              fill={note.id === activeId ? "#3156d3" : "#6d7890"}
              fontSize="8.6"
            >
              {note.title.length > 22
                ? note.title.slice(0, 20) + "…"
                : note.title}
            </text>
          </g>
        ))}
      </svg>
      <span>
        <i /> Connected ideas grow stronger.
      </span>
    </div>
  );
}

export default function Wiki() {
  const {
    data,
    setData,
    courseId,
    course,
    user,
    role,
    activeNoteId,
    setActiveNoteId,
    navigate,
    toast,
    openMaterial,
  } = useApp();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("My notes");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishCategory, setPublishCategory] = useState("Core concepts");
  const [selectedIds, setSelectedIds] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const notes = useMemo(
    () =>
      (data.notes || []).filter(
        (n) => n.courseId === courseId && (role === "teacher" || owns(n, user)),
      ),
    [data.notes, courseId, user.id, user.studentId, role],
  );
  const active = notes.find((n) => n.id === activeNoteId) || notes[0];
  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );
  const categories = [
    ...new Set(filtered.map((n) => n.category || "My notes")),
  ];
  const owner =
    (data.students || []).find(
      (s) => s.id === active?.studentId || s.studentId === active?.studentId,
    ) || user;
  const backlinks = notes.filter(
    (n) =>
      n.id !== active?.id &&
      ((n.links || []).includes(active?.id) ||
        n.content?.includes(`[[${active?.title}]]`)),
  );
  const headings = (active?.content || "")
    .split("\n")
    .map((line, i) => ({ line, i }))
    .filter((x) => x.line.startsWith("## "));
  const canEdit = role !== "teacher" && (!active || owns(active, user));
  const published = (data.market || []).find(
    (m) => m.noteId === active?.id && m.courseId === courseId,
  );
  const selectNote = (id) => {
    setEditing(false);
    setActiveNoteId(id);
    navigate("wiki", { noteId: id });
  };
  const followLink = (note, target) =>
    note
      ? selectNote(note.id)
      : toast(
          `“${target}” isn't in this wiki yet. Create a note to connect it.`,
        );
  useEffect(() => {
    setEditing(false);
  }, [courseId, user.id, role]);
  const save = () => {
    if (!canEdit)
      return toast("Student wiki pages are read-only in teacher view.");
    if (!draft.title.trim()) return toast("Give your note a title first.");
    const links = [
      ...new Set(
        [...draft.content.matchAll(/\[\[([^|\]]+)/g)]
          .map(
            (match) =>
              notes.find(
                (n) =>
                  n.id === match[1] || textKey(n.title) === textKey(match[1]),
              )?.id,
          )
          .filter(Boolean),
      ),
    ];
    setData((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === active.id
          ? {
              ...n,
              ...draft,
              links,
              title: draft.title.trim(),
              updatedAt: "Just now",
            }
          : n,
      ),
    }));
    setEditing(false);
    toast("Your wiki is up to date.");
  };
  const addNote = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const id = `note-${Date.now()}`;
    const note = {
      id,
      courseId,
      studentId: user.id,
      title: newTitle.trim(),
      category: newCategory.trim() || "My notes",
      content:
        "## The idea\nStart with what you understand.\n\n## Connections\nConnect this idea to another note using [[double brackets]].",
      tags: [],
      links: [],
      updatedAt: "Just now",
    };
    setData((prev) => ({ ...prev, notes: [...prev.notes, note] }));
    setNewOpen(false);
    setNewTitle("");
    setActiveNoteId(id);
    setDraft({ title: note.title, content: note.content });
    setEditing(true);
    toast("A fresh page for a new idea.");
  };
  const beginPublish = () => {
    if (!canEdit) return toast("Only the author can publish this wiki.");
    setSelectedIds(active ? [active.id] : []);
    setPublishTitle(active?.title || "");
    setPublishDescription("");
    setPublishCategory(active?.category || "Core concepts");
    setPublishOpen(true);
  };
  const publish = (e) => {
    e.preventDefault();
    if (!selectedIds.length)
      return toast("Select at least one page to publish.");
    const pages = notes.filter(
      (n) => selectedIds.includes(n.id) && owns(n, user),
    );
    if (!pages.length || role === "teacher")
      return toast("Publish from your own student wiki.");
    const previous = (data.market || []).filter(
      (m) => m.authorId === user.id && m.noteId === pages[0].id,
    );
    const version = previous.length
      ? Math.max(...previous.map((m) => Number(m.version) || 1)) + 1
      : 1;
    const pageIds = new Set(pages.map((n) => n.id));
    const snapshotPages = pages.map((n) => {
      const publicMaterial =
        n.source &&
        (data.materials || []).find(
          (m) =>
            m.id === n.source.materialId &&
            m.courseId === courseId &&
            !m.ownerId,
        );
      return {
        id: n.id,
        title: n.title,
        category: n.category,
        content: n.content,
        tags: [...(n.tags || [])],
        links: (n.links || []).filter((id) => pageIds.has(id)),
        animation: ["race", "request"].includes(n.animation)
          ? n.animation
          : /race condition/i.test(n.title)
            ? "race"
            : null,
        hasAnimation: !!n.hasAnimation,
        ...(publicMaterial
          ? {
              source: {
                materialId: publicMaterial.id,
                name: publicMaterial.name,
                page: n.source.page || 1,
              },
            }
          : {}),
      };
    });
    const snapshot = {
      id: `market-${Date.now()}`,
      noteId: pages[0].id,
      noteIds: pages.map((n) => n.id),
      pages: snapshotPages,
      courseId,
      title: publishTitle.trim(),
      description: publishDescription.trim(),
      author: user.name,
      authorId: user.id,
      initials: user.initials,
      color: user.color || "#e6ecff",
      category: publishCategory,
      content: pages
        .map((n) =>
          pages.length > 1 ? `# ${n.title}\n\n${n.content}` : n.content,
        )
        .join("\n\n---\n\n"),
      tags: [...new Set(pages.flatMap((n) => n.tags || []))],
      likes: 0,
      bookmarkedBy: [],
      version,
      updatedAt: "Just now",
      hasAnimation: pages.some((n) => n.hasAnimation),
      animation: snapshotPages[0].animation,
      pageCount: pages.length,
    };
    setData((prev) => ({
      ...prev,
      market: [snapshot, ...(prev.market || [])],
    }));
    setPublishOpen(false);
    toast(`Published “${snapshot.title}” · version ${version}.`);
  };
  return (
    <div className="wiki-page">
      <div className="wiki-page-heading">
        <div>
          <div className="eyebrow">YOUR SECOND BRAIN</div>
          <h1>
            My learning wiki<span className="wiki-title-dot">.</span>
          </h1>
          <p>A little more connected. A little more understood.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
          <Plus size={16} /> New note
        </button>
      </div>
      <div className="wiki-workspace">
        <aside className="wiki-tree-panel">
          <div className="wiki-tree-heading">
            <span>
              <BookOpen size={16} /> Knowledge library
            </span>
            <span className="wiki-count">{notes.length}</span>
          </div>
          <label className="wiki-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a note…"
              aria-label="Find a wiki note"
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="wiki-course-label">
            {course?.code || "THIS COURSE"} <span>PRIVATE WIKI</span>
          </div>
          <div className="wiki-folders">
            {categories.map((category) => (
              <div className="wiki-folder" key={category}>
                <button
                  className="wiki-folder-title"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [category]: !c[category] }))
                  }
                >
                  {collapsed[category] ? (
                    <ChevronRight size={13} />
                  ) : (
                    <ChevronDown size={13} />
                  )}
                  <FolderOpen size={15} />
                  <span>{category}</span>
                </button>
                {!collapsed[category] && (
                  <div className="wiki-folder-items">
                    {filtered
                      .filter((n) => (n.category || "My notes") === category)
                      .map((n) => (
                        <button
                          key={n.id}
                          className={`wiki-note-item ${n.id === active?.id ? "active" : ""}`}
                          onClick={() => selectNote(n.id)}
                        >
                          <FileText size={14} />
                          <span>{n.title}</span>
                          {n.hasAnimation && (
                            <span className="wiki-note-spark">
                              <Sparkles size={11} />
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!filtered.length && (
            <p className="wiki-small-empty">
              No notes found. Try a different phrase.
            </p>
          )}
          <button className="wiki-new-note" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> Add a page
          </button>
          <div className="wiki-library-footer">
            <GitBranch size={16} />
            <div>
              <strong>Built like your mind.</strong>
              <span>Markdown pages. Connected ideas.</span>
            </div>
          </div>
        </aside>
        {active ? (
          <>
            <article className="wiki-document">
              <div className="wiki-document-bar">
                <span>
                  {active.category}
                  <ChevronRight size={12} />
                  <span>{editing ? "Editing note" : "Knowledge note"}</span>
                </span>
                <div>
                  {editing ? (
                    <>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setEditing(false)}
                      >
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={save}>
                        <Check size={14} /> Save changes
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="icon-btn"
                        aria-label="Edit note"
                        disabled={!canEdit}
                        title={
                          canEdit ? "Edit note" : "Student wiki is read-only"
                        }
                        onClick={() => {
                          setDraft({
                            title: active.title,
                            content: active.content,
                          });
                          setEditing(true);
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="btn btn-outline wiki-publish-btn"
                        disabled={!canEdit}
                        onClick={beginPublish}
                      >
                        <Upload size={14} /> Publish
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="wiki-article-body">
                {editing ? (
                  <div className="wiki-editor">
                    <label>
                      Note title
                      <input
                        value={draft.title}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, title: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Markdown content
                      <textarea
                        aria-label="Markdown content"
                        value={draft.content}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, content: e.target.value }))
                        }
                      />
                    </label>
                    <p>
                      <Link2 size={13} /> Use [[Note title]] to connect ideas
                      across your wiki.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="wiki-document-badge">
                      <span />{" "}
                      {published
                        ? "PUBLISHED TO COURSE"
                        : role === "teacher"
                          ? "STUDENT KNOWLEDGE · TEACHER VIEW"
                          : "YOUR PRIVATE KNOWLEDGE"}
                    </div>
                    <h2 className="wiki-document-title">{active.title}</h2>
                    <div className="wiki-document-meta">
                      <span
                        className="wiki-mini-avatar"
                        style={avatarStyle(owner.color)}
                      >
                        {owner.initials || "WF"}
                      </span>
                      <span>{owner.name?.split(" ")[0] || "You"}</span>
                      <span className="wiki-meta-dot">·</span>
                      <span>Updated {friendlyDate(active.updatedAt)}</span>
                      <span className="wiki-meta-dot">·</span>
                      <span>
                        {Math.max(
                          1,
                          Math.ceil(
                            (active.content || "").split(" ").length / 200,
                          ),
                        )}{" "}
                        min read
                      </span>
                    </div>
                    <div className="wiki-note-tags">
                      {(active.tags || []).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                      <span className="wiki-ai-tag">
                        <Sparkles size={11} /> AI nurtured, human owned
                      </span>
                    </div>
                    <WikiMarkdown
                      content={(active.content || "").replace(
                        /^# [^\n]+\n*/,
                        "",
                      )}
                      notes={notes}
                      onLink={followLink}
                    />
                    {active.hasAnimation &&
                      (["race", "request"].includes(active.animation) ||
                      /race condition/i.test(active.title) ? (
                        <div className="wiki-shared-animation">
                          <LearningAnimation
                            key={`${active.id}-${active.animation || "race"}`}
                            type={active.animation || "race"}
                          />
                        </div>
                      ) : (
                        <ConceptAnimation />
                      ))}
                    <div className="wiki-note-end">
                      <span /> End of note <span />
                    </div>
                    <div className="wiki-ai-callout">
                      <div className="wiki-ai-callout-icon">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <strong>Keep the curiosity going.</strong>
                        <p>
                          Take this idea into a learning session and explore it
                          together.
                        </p>
                      </div>
                      <button
                        aria-label="Ask AI about this note"
                        onClick={() => navigate("studio")}
                      >
                        <ChevronRight size={19} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
            <aside className="wiki-context-panel">
              <div className="wiki-context-section">
                <div className="wiki-context-title">
                  <GitBranch size={14} /> KNOWLEDGE GRAPH
                </div>
                <KnowledgeGraph
                  notes={[active, ...notes.filter((n) => n.id !== active.id)]}
                  activeId={active.id}
                  onSelect={selectNote}
                />
              </div>
              <div className="wiki-context-section">
                <div className="wiki-context-title">
                  <FileText size={14} /> ON THIS PAGE
                </div>
                {headings.length ? (
                  headings.map((h) => (
                    <button
                      className="wiki-toc-link"
                      onClick={() =>
                        document
                          .getElementById(`section-${h.i}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                      }
                      key={h.i}
                    >
                      {h.line.slice(3)}
                    </button>
                  ))
                ) : (
                  <span className="wiki-context-muted">
                    Your ideas live here.
                  </span>
                )}
              </div>
              <div className="wiki-context-section">
                <div className="wiki-context-title">
                  <Link2 size={14} /> BACKLINKS <span>{backlinks.length}</span>
                </div>
                {backlinks.length ? (
                  backlinks.map((n) => (
                    <button
                      className="wiki-backlink"
                      onClick={() => selectNote(n.id)}
                      key={n.id}
                    >
                      <FileText size={13} />
                      <span>{n.title}</span>
                      <ChevronRight size={12} />
                    </button>
                  ))
                ) : (
                  <p className="wiki-context-muted">
                    Notes that link here will appear here.
                  </p>
                )}
              </div>
              <div className="wiki-context-section">
                <div className="wiki-context-title">
                  <BookOpen size={14} /> SOURCES
                </div>
                {active.source ? (
                  <button
                    className="wiki-source"
                    onClick={() =>
                      openMaterial?.(
                        active.source.materialId,
                        active.source.page,
                      )
                    }
                  >
                    <span className="wiki-source-pdf">PDF</span>
                    <span>
                      <strong>
                        {(data.materials || []).find(
                          (m) => m.id === active.source.materialId,
                        )?.name || "Course lecture slides"}
                      </strong>
                      <small>
                        Page {active.source.page || 1} · Course material
                      </small>
                    </span>
                    <ChevronRight size={12} />
                  </button>
                ) : (
                  <div className="wiki-source-text">
                    <Sparkles size={14} /> Built from your learning sessions
                  </div>
                )}
              </div>
              <div className="wiki-publish-prompt">
                <span className="wiki-publish-symbol">
                  <Send size={19} />
                </span>
                <h4>Good ideas travel.</h4>
                <p>
                  Someone in your course might need your way of understanding.
                </p>
                <button onClick={beginPublish}>
                  Share this note <ChevronRight size={13} />
                </button>
              </div>
            </aside>
          </>
        ) : (
          <div className="wiki-blank-state">
            <BookOpen size={35} />
            <h2>Your next idea starts here.</h2>
            <p>Collect your understanding in connected Markdown notes.</p>
            <button
              className="btn btn-primary"
              onClick={() => setNewOpen(true)}
            >
              <Plus size={15} /> Create your first note
            </button>
          </div>
        )}
      </div>
      {newOpen && (
        <Modal
          title="Make room for an idea."
          subtitle="A new page in your personal learning wiki."
          onClose={() => setNewOpen(false)}
        >
          <form className="wiki-modal-form" onSubmit={addNote}>
            <label>
              Note title
              <input
                autoFocus
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What are you thinking about?"
              />
            </label>
            <label>
              Folder
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                list="wiki-folders"
              />
              <datalist id="wiki-folders">
                {categories.map((c) => (
                  <option value={c} key={c} />
                ))}
              </datalist>
            </label>
            <div className="wiki-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                <Plus size={15} /> Create note
              </button>
            </div>
          </form>
        </Modal>
      )}
      {publishOpen && (
        <Modal
          title="Let your knowledge travel."
          subtitle="Publish a snapshot to this course’s wiki market."
          onClose={() => setPublishOpen(false)}
          wide
        >
          <form className="wiki-modal-form" onSubmit={publish}>
            <div className="wiki-publish-notice">
              <ShieldCheck size={18} />
              <p>
                Only the pages you select are shared. Your sessions and original
                files stay private to you and your teacher. Future edits won’t
                change this published version.
              </p>
            </div>
            <label>
              Choose pages{" "}
              <span className="wiki-field-hint">
                Publish one note or a connected topic collection.
              </span>
              <div className="wiki-publish-select">
                {notes
                  .filter((n) => owns(n, user))
                  .map((n) => (
                    <label
                      className={`wiki-select-row ${selectedIds.includes(n.id) ? "selected" : ""}`}
                      key={n.id}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(n.id)}
                        onChange={(e) =>
                          setSelectedIds((ids) =>
                            e.target.checked
                              ? [...ids, n.id]
                              : ids.filter((id) => id !== n.id),
                          )
                        }
                      />
                      <FileText size={16} />
                      <span>
                        {n.title}
                        <small>{n.category}</small>
                      </span>
                      {n.hasAnimation && <Sparkles size={14} />}
                    </label>
                  ))}
              </div>
            </label>
            <label>
              Publication title
              <input
                required
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                placeholder="A title your classmates will understand"
              />
            </label>
            <label>
              Short description
              <textarea
                required
                rows={3}
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                placeholder="What will someone understand after reading this?"
              />
            </label>
            <label>
              Topic
              <input
                required
                value={publishCategory}
                onChange={(e) => setPublishCategory(e.target.value)}
                list="wiki-categories"
              />
              <datalist id="wiki-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="wiki-modal-actions">
              <span className="wiki-snapshot-label">
                {selectedIds.length} page{selectedIds.length !== 1 ? "s" : ""} ·
                Versioned snapshot
              </span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setPublishOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!selectedIds.length}
              >
                <Upload size={15} /> Publish to course
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
