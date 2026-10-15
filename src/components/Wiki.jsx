import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Link2,
  List,
  Maximize2,
  Network,
  PanelLeft,
  PanelRight,
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
import {
  canReadCourse,
  canReadPrivateNote,
  visibleCourses,
} from "../lib/access";
import { Modal } from "./ui";
import LearningAnimation from "./Animation";
import WikiLibrary from "./WikiLibrary";
import WikiGraph from "./WikiGraph";
import {
  incomingLinks,
  outgoingLinks,
  parseWikiLinks,
  resolveWikiLink,
} from "../lib/wikiLinks";
import "./wiki.css";
import "./wiki-vault.css";

const owns = (note, user) =>
  note.studentId === user.id || note.studentId === user.studentId;
export const friendlyDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value || "today"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
export function WikiMarkdown({ content = "", notes = [], onLink, sourceNote }) {
  const inline = (text, key) =>
    text.split(/(\[\[.*?\]\]|\*\*.*?\*\*|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const link = parseWikiLinks(part)[0];
        if (!link) return part;
        const { target, label, heading } = link;
        const found = resolveWikiLink(notes, target, sourceNote);
        return (
          <button
            className="wiki-inline-link"
            type="button"
            key={`${key}-${i}`}
            onClick={() => onLink?.(found, target, heading)}
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
          return (
            <h3 id={`section-${i}`} key={i}>
              {inline(line.slice(4), i)}
            </h3>
          );
        if (line.startsWith("## "))
          return (
            <h2 id={`section-${i}`} key={i}>
              {inline(line.slice(3), i)}
            </h2>
          );
        if (line.startsWith("# "))
          return (
            <h2 id={`section-${i}`} key={i}>
              {inline(line.slice(2), i)}
            </h2>
          );
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

export default function Wiki() {
  const {
    data,
    setData,
    courseId: contextCourseId,
    user,
    role,
    actor,
    activeNoteId,
    navigate,
    toast,
    openMaterial,
  } = useApp();
  const allowedNotes = useMemo(
    () =>
      role === "student"
        ? data.notes.filter((note) => canReadPrivateNote(data, actor, note))
        : [],
    [data, role, actor],
  );
  const availableCourses = visibleCourses(data, actor);
  const active = allowedNotes.find((note) => note.id === activeNoteId);
  const notes = useMemo(
    () =>
      role === "teacher" && active
        ? allowedNotes.filter((note) => note.studentId === active.studentId)
        : allowedNotes,
    [allowedNotes, role, active?.studentId],
  );
  const noteCourseId = active?.courseId || contextCourseId;
  const noteCourse = data.courses.find((item) => item.id === noteCourseId);
  const owner =
    data.students.find(
      (item) =>
        item.id === active?.studentId || item.studentId === active?.studentId,
    ) || user;
  const canEdit =
    role === "student" &&
    (active
      ? canReadPrivateNote(data, actor, active)
      : availableCourses.length > 0);
  const [search, setSearch] = useState("");
  const [pendingHeading, setPendingHeading] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [tabIds, setTabIds] = useState(activeNoteId ? [activeNoteId] : []);
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphActive, setGraphActive] = useState(false);
  const [graphCourse, setGraphCourse] = useState("all");
  const [mobilePanel, setMobilePanel] = useState("note");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("My notes");
  const [newCourseId, setNewCourseId] = useState(contextCourseId);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishCategory, setPublishCategory] = useState("Core concepts");
  const [selectedIds, setSelectedIds] = useState([]);
  const articleRef = useRef(null);
  const tabsRef = useRef(null);
  const draft = drafts[active?.id] || {
    title: active?.title || "",
    content: active?.content || "",
  };
  const setDraft = (value) =>
    setDrafts((previous) => ({
      ...previous,
      [active.id]:
        typeof value === "function"
          ? value(
              previous[active.id] || {
                title: active.title,
                content: active.content,
              },
            )
          : value,
    }));
  const categories = [
    ...new Set(notes.map((note) => note.category || "My notes")),
  ];
  const outgoing = active ? outgoingLinks(active, notes) : [];
  const backlinks = active ? incomingLinks(active, notes) : [];
  const localIds = new Set([
    active?.id,
    ...outgoing.map((link) => link.note?.id),
    ...backlinks.map((link) => link.note.id),
  ]);
  const localNotes = notes.filter((note) => localIds.has(note.id));
  const renderedContent = (active?.content || "").replace(/^# [^\n]+\n*/, "");
  const headings = renderedContent
    .split("\n")
    .map((line, i) => ({ line, i }))
    .filter((item) => /^#{1,3} /.test(item.line));
  const openTabs = tabIds
    .map((id) => notes.find((note) => note.id === id))
    .filter(Boolean);
  const filtered = notes.filter((note) =>
    `${note.title} ${note.category} ${(note.tags || []).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const published = data.market.find(
    (item) =>
      item.courseId === noteCourseId &&
      (item.noteIds || [item.noteId]).includes(active?.id),
  );

  useEffect(() => {
    if (active) {
      setTabIds((ids) => (ids.includes(active.id) ? ids : [...ids, active.id]));
      setGraphActive(false);
      setMobilePanel("note");
    }
  }, [active?.id]);
  useEffect(() => {
    articleRef.current?.scrollTo({ top: 0 });
  }, [active?.id, graphActive]);
  const selectNote = (id) => {
    if (
      role !== "student" ||
      !data.notes.some(
        (note) => note.id === id && canReadPrivateNote(data, actor, note),
      )
    )
      return;
    setEditing(false);
    setGraphActive(false);
    navigate("wiki", { noteId: id });
    setMobilePanel("note");
  };
  const followLink = (note, target, heading) => {
    if (note) {
      setPendingHeading(heading || "");
      selectNote(note.id);
    } else
      toast(`“${target}” does not have a note yet. Create it with New note.`);
  };
  useEffect(() => {
    if (!pendingHeading || editing) return;
    const frame = requestAnimationFrame(() => {
      const heading = [
        ...(articleRef.current?.querySelectorAll("h2,h3") || []),
      ].find(
        (item) =>
          item.textContent.toLowerCase() === pendingHeading.toLowerCase(),
      );
      heading?.scrollIntoView({ block: "start" });
      setPendingHeading("");
    });
    return () => cancelAnimationFrame(frame);
  }, [active?.id, pendingHeading, editing]);
  const openGraph = () => {
    setGraphOpen(true);
    setGraphActive(true);
    setEditing(false);
    setMobilePanel("note");
  };
  function closeTab(id) {
    const index = openTabs.findIndex((note) => note.id === id);
    const remaining = openTabs.filter((note) => note.id !== id);
    setTabIds((ids) => ids.filter((item) => item !== id));
    if (id === active?.id && !graphActive) {
      if (remaining.length)
        selectNote(remaining[Math.min(index, remaining.length - 1)].id);
      else if (graphOpen) setGraphActive(true);
      else navigate("wiki");
    }
  }
  function tabKeys(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...tabsRef.current.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    tabs[next]?.focus();
    tabs[next]?.click();
  }
  function save() {
    if (!canEdit || !active) return;
    if (!draft.title.trim()) return toast("Give your note a title first.");
    const updated = {
      ...active,
      title: draft.title.trim(),
      content: draft.content,
      updatedAt: new Date().toISOString(),
    };
    const candidates = notes.map((note) =>
      note.id === active.id ? updated : note,
    );
    updated.links = outgoingLinks(updated, candidates)
      .map((link) => link.note?.id)
      .filter(Boolean);
    setData((previous) =>
      !canReadPrivateNote(
        previous,
        actor,
        previous.notes.find((note) => note.id === active.id),
      )
        ? previous
        : {
            ...previous,
            notes: previous.notes.map((note) =>
              note.id === active.id ? updated : note,
            ),
          },
    );
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[active.id];
      return next;
    });
    setEditing(false);
    toast("Wiki note saved. Links and graph updated.");
  }
  function startNew() {
    if (role !== "student" || !availableCourses.length) return;
    setNewCourseId(
      availableCourses.some((item) => item.id === noteCourseId)
        ? noteCourseId
        : availableCourses[0].id,
    );
    setNewOpen(true);
  }
  function addNote(event) {
    event.preventDefault();
    if (
      !newTitle.trim() ||
      role !== "student" ||
      !canReadCourse(data, actor, newCourseId)
    )
      return;
    const note = {
      id: `note-${crypto.randomUUID()}`,
      courseId: newCourseId,
      studentId: user.id,
      title: newTitle.trim(),
      category: newCategory.trim() || "My notes",
      content: `# ${newTitle.trim()}\n\n`,
      tags: [],
      links: [],
      updatedAt: new Date().toISOString(),
    };
    setData((previous) =>
      canReadCourse(previous, actor, newCourseId)
        ? { ...previous, notes: [...previous.notes, note] }
        : previous,
    );
    setNewOpen(false);
    setNewTitle("");
    navigate("wiki", { noteId: note.id, courseId: note.courseId });
    setEditing(true);
    setGraphActive(false);
    toast("New wiki note created.");
  }
  function downloadNote() {
    if (role !== "student" || !canReadPrivateNote(data, actor, active)) return;
    const url = URL.createObjectURL(
      new Blob([active.content], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.title}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
    if (role !== "student" || !canReadCourse(data, actor, noteCourseId)) return;
    if (!selectedIds.length)
      return toast("Select at least one page to publish.");
    const pages = notes.filter(
      (n) =>
        n.courseId === noteCourseId &&
        selectedIds.includes(n.id) &&
        canReadPrivateNote(data, actor, n),
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
            m.courseId === noteCourseId &&
            !m.ownerId,
        );
      return {
        id: n.id,
        title: n.title,
        category: n.category,
        content: n.content,
        tags: [...(n.tags || [])],
        links: outgoingLinks(n, notes)
          .map((link) => link.note?.id)
          .filter((id) => pageIds.has(id)),
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
      courseId: noteCourseId,
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
    setData((prev) =>
      !pages.every((page) =>
        canReadPrivateNote(
          prev,
          actor,
          prev.notes.find((note) => note.id === page.id),
        ),
      )
        ? prev
        : {
            ...prev,
            market: [snapshot, ...(prev.market || [])],
          },
    );
    setPublishOpen(false);
    toast(`Published “${snapshot.title}” · version ${version}.`);
  };

  if (role !== "student")
    return (
      <div className="vault-unavailable">
        <ShieldCheck size={32} />
        <h1>Personal wikis belong to students</h1>
        <p>Browse published knowledge in your course’s wiki market.</p>
        <button onClick={() => navigate("market")}>
          Browse published wikis
        </button>
      </div>
    );

  return (
    <>
      {!activeNoteId ? (
        <WikiLibrary onCreate={role !== "teacher" ? startNew : undefined} />
      ) : !active ? (
        <div className="vault-unavailable">
          <BookOpen size={32} />
          <h1>Wiki note unavailable</h1>
          <p>This note is outside your personal knowledge library.</p>
          <button onClick={() => navigate("wiki")}>Back to My wiki</button>
        </div>
      ) : (
        <div className="obsidian-vault" data-panel={mobilePanel}>
          <div className="vault-mobile-nav" aria-label="Wiki panels">
            {[
              { id: "files", label: "Files", icon: Folder },
              {
                id: "note",
                label: graphActive ? "Graph" : "Note",
                icon: FileText,
              },
              { id: "links", label: "Links", icon: Link2 },
            ].map((item) => (
              <button
                key={item.id}
                aria-pressed={mobilePanel === item.id}
                onClick={() => setMobilePanel(item.id)}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
          <aside className="vault-ribbon" aria-label="Wiki tools">
            <button
              aria-label="Find wiki files"
              onClick={() => {
                setMobilePanel("files");
                document.getElementById("vault-file-search")?.focus();
              }}
            >
              <Search size={19} />
            </button>
            <button
              className={graphActive ? "active" : ""}
              aria-label="Open knowledge graph"
              onClick={openGraph}
            >
              <Network size={20} />
            </button>
            {canEdit && (
              <button aria-label="Create wiki note" onClick={startNew}>
                <Plus size={20} />
              </button>
            )}
            <div className="vault-ribbon-bottom">
              <BookOpen size={20} />
            </div>
          </aside>
          <aside className="vault-files" aria-label="Wiki file explorer">
            <div className="vault-panel-heading">
              <span>FILES</span>
              <div>
                <button aria-label="Open knowledge graph" onClick={openGraph}>
                  <Network size={16} />
                </button>
                {canEdit && (
                  <button aria-label="New wiki note" onClick={startNew}>
                    <Plus size={17} />
                  </button>
                )}
              </div>
            </div>
            <label className="vault-search">
              <Search size={14} />
              <input
                id="vault-file-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a note…"
                aria-label="Find a wiki note"
              />
            </label>
            <div className="vault-file-scroll">
              {data.courses
                .filter((item) =>
                  notes.some((note) => note.courseId === item.id),
                )
                .map((item) => {
                  const courseNotes = filtered.filter(
                    (note) => note.courseId === item.id,
                  );
                  return (
                    <div className="vault-course-folder" key={item.id}>
                      <button
                        className="vault-folder"
                        aria-expanded={!collapsed[item.id]}
                        onClick={() =>
                          setCollapsed((state) => ({
                            ...state,
                            [item.id]: !state[item.id],
                          }))
                        }
                      >
                        {collapsed[item.id] ? (
                          <ChevronRight size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        )}
                        <FolderOpen size={15} />
                        <span>{item.name}</span>
                        <small>
                          {
                            notes.filter((note) => note.courseId === item.id)
                              .length
                          }
                        </small>
                      </button>
                      {!collapsed[item.id] &&
                        [
                          ...new Set(
                            courseNotes.map(
                              (note) => note.category || "My notes",
                            ),
                          ),
                        ].map((category) => (
                          <div className="vault-category" key={category}>
                            <div className="vault-category-label">
                              <ChevronDown size={12} />
                              {category}
                            </div>
                            {courseNotes
                              .filter(
                                (note) =>
                                  (note.category || "My notes") === category,
                              )
                              .map((note) => (
                                <button
                                  className={`vault-file ${note.id === active.id && !graphActive ? "active" : ""}`}
                                  key={note.id}
                                  aria-current={
                                    note.id === active.id && !graphActive
                                      ? "page"
                                      : undefined
                                  }
                                  onClick={() => selectNote(note.id)}
                                  title={note.title}
                                >
                                  <FileText size={14} />
                                  <span>{note.title}</span>
                                  {drafts[note.id] && (
                                    <i title="Unsaved draft" />
                                  )}
                                </button>
                              ))}
                          </div>
                        ))}
                    </div>
                  );
                })}
              {!filtered.length && (
                <p className="vault-empty">No matching notes.</p>
              )}
            </div>
            <div className="vault-owner">
              <span className="vault-owner-icon">{owner.initials}</span>
              <div>
                <strong>{owner.name.split(" ")[0]}’s vault</strong>
                <small>
                  {notes.length} notes ·{" "}
                  {new Set(notes.map((note) => note.courseId)).size} courses
                  {role === "teacher" ? " · read only" : ""}
                </small>
              </div>
            </div>
          </aside>
          <section className="vault-center" aria-label="Wiki editor workspace">
            <div
              className="vault-tabs"
              role="tablist"
              aria-label="Open wiki tabs"
              ref={tabsRef}
              onKeyDown={tabKeys}
            >
              {openTabs.map((note) => (
                <div
                  className={`vault-tab-wrap ${note.id === active.id && !graphActive ? "active" : ""}`}
                  key={note.id}
                >
                  <button
                    role="tab"
                    aria-selected={note.id === active.id && !graphActive}
                    tabIndex={note.id === active.id && !graphActive ? 0 : -1}
                    aria-controls="vault-active-panel"
                    onClick={() => selectNote(note.id)}
                  >
                    <FileText size={14} />
                    <span>{note.title}</span>
                    {drafts[note.id] && <i />}
                  </button>
                  <button
                    className="vault-tab-close"
                    aria-label={`Close ${note.title}`}
                    onClick={() => closeTab(note.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {graphOpen && (
                <div
                  className={`vault-tab-wrap ${graphActive ? "active" : ""}`}
                >
                  <button
                    role="tab"
                    aria-selected={graphActive}
                    tabIndex={graphActive ? 0 : -1}
                    aria-controls="vault-active-panel"
                    onClick={openGraph}
                  >
                    <Network size={14} />
                    <span>Graph view</span>
                  </button>
                  <button
                    className="vault-tab-close"
                    aria-label="Close graph view"
                    onClick={() => {
                      setGraphOpen(false);
                      setGraphActive(false);
                      if (!openTabs.length) navigate("wiki");
                      else if (!openTabs.some((note) => note.id === active.id))
                        selectNote(openTabs[0].id);
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="vault-editor-toolbar">
              <div className="vault-note-path">
                {graphActive ? (
                  <>
                    <Network size={14} />
                    <span>Knowledge graph</span>
                  </>
                ) : (
                  <>
                    <span>{noteCourse?.code}</span>
                    <ChevronRight size={12} />
                    <span>{active.category}</span>
                    <ChevronRight size={12} />
                    <span>{active.title}</span>
                  </>
                )}
              </div>
              <div className="vault-editor-actions">
                {graphActive ? (
                  <select
                    aria-label="Filter graph by course"
                    value={graphCourse}
                    onChange={(event) => setGraphCourse(event.target.value)}
                  >
                    <option value="all">All courses</option>
                    {data.courses
                      .filter((item) =>
                        notes.some((note) => note.courseId === item.id),
                      )
                      .map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.code}
                        </option>
                      ))}
                  </select>
                ) : (
                  <>
                    {editing ? (
                      <>
                        <button
                          onClick={() => {
                            setEditing(false);
                            setDrafts((previous) => {
                              const next = { ...previous };
                              delete next[active.id];
                              return next;
                            });
                          }}
                        >
                          Discard
                        </button>
                        <button className="vault-save" onClick={save}>
                          <Check size={14} />
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            aria-label="Edit note"
                            onClick={() => setEditing(true)}
                          >
                            <Pencil size={15} />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          aria-label="Download Markdown"
                          onClick={downloadNote}
                        >
                          <ArrowDownToLine size={15} />
                        </button>
                        {canEdit && (
                          <button onClick={beginPublish}>
                            <Upload size={14} />
                            <span>Publish</span>
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div
              className="vault-active-panel"
              id="vault-active-panel"
              role="tabpanel"
              tabIndex={0}
            >
              {graphActive ? (
                <div className="vault-graph-page">
                  <div className="vault-graph-title">
                    <div>
                      <h1>Connected thinking.</h1>
                      <p>
                        Every line is a link you wrote. Select a note to follow
                        an idea.
                      </p>
                    </div>
                    <span>{notes.length} notes</span>
                  </div>
                  <WikiGraph
                    notes={
                      graphCourse === "all"
                        ? notes
                        : notes.filter((note) => note.courseId === graphCourse)
                    }
                    activeId={active.id}
                    onSelect={selectNote}
                  />
                </div>
              ) : (
                <div className="vault-reading-scroll" ref={articleRef}>
                  {editing ? (
                    <div className="vault-markdown-editor">
                      <label>
                        Note title
                        <input
                          aria-label="Note title"
                          value={draft.title}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        MARKDOWN
                        <textarea
                          aria-label="Markdown content"
                          value={draft.content}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              content: event.target.value,
                            }))
                          }
                          spellCheck={false}
                        />
                      </label>
                      <p>
                        <Link2 size={13} />
                        Use [[Note title]] or [[Note title|label]] to connect
                        your ideas.
                      </p>
                    </div>
                  ) : (
                    <article className="vault-note-body">
                      <div className="vault-note-context">
                        <span>{noteCourse?.name}</span>
                        <span>
                          {published ? "Published snapshot" : "Personal wiki"}
                          {role === "teacher" ? " · Read only" : ""}
                        </span>
                      </div>
                      <h1>{active.title}</h1>
                      <div className="vault-properties">
                        <span>Updated</span>
                        <time>{friendlyDate(active.updatedAt)}</time>
                        <span>Tags</span>
                        <div>
                          {active.tags?.length ? (
                            active.tags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => {
                                  setSearch(tag);
                                  setMobilePanel("files");
                                }}
                              >
                                #{tag}
                              </button>
                            ))
                          ) : (
                            <small>No tags</small>
                          )}
                        </div>
                      </div>
                      <WikiMarkdown
                        content={renderedContent}
                        notes={notes}
                        sourceNote={active}
                        onLink={followLink}
                      />
                      {active.hasAnimation && (
                        <details className="vault-animation">
                          <summary>
                            <Play size={14} />
                            Interactive explanation
                            <ChevronDown size={14} />
                          </summary>
                          {["race", "request"].includes(active.animation) ||
                          /race condition|web request/i.test(active.title) ? (
                            <LearningAnimation
                              type={
                                active.animation ||
                                (/web request/i.test(active.title)
                                  ? "request"
                                  : "race")
                              }
                            />
                          ) : (
                            <ConceptAnimation />
                          )}
                        </details>
                      )}
                      <div className="vault-inline-links">
                        <div>
                          <Link2 size={14} />
                          {outgoing.filter((link) => link.note).length} outgoing
                          links
                        </div>
                        <div>
                          <GitBranch size={14} />
                          {backlinks.length} backlinks
                        </div>
                      </div>
                    </article>
                  )}
                </div>
              )}
            </div>
            <div className="vault-status">
              <span>
                <span className="vault-status-dot" />
                {role === "teacher"
                  ? "Read-only teacher view"
                  : drafts[active.id]
                    ? "Unsaved draft"
                    : "Saved in this browser"}
              </span>
              <span>
                {
                  (active.content || "").trim().split(/\s+/).filter(Boolean)
                    .length
                }{" "}
                words · Markdown
              </span>
            </div>
          </section>
          <aside className="vault-inspector" aria-label="Wiki connections">
            <div className="vault-panel-heading">
              <span>CONNECTIONS</span>
              <button aria-label="Expand knowledge graph" onClick={openGraph}>
                <Maximize2 size={15} />
              </button>
            </div>
            <section className="vault-inspector-section vault-local-graph">
              <h2>
                <Network size={14} />
                Local graph
                <button onClick={openGraph} aria-label="Open full graph">
                  <Maximize2 size={13} />
                </button>
              </h2>
              <WikiGraph
                notes={localNotes}
                activeId={active.id}
                onSelect={selectNote}
                compact
              />
            </section>
            <section className="vault-inspector-section">
              <h2>
                <Link2 size={14} />
                Outgoing links<span>{outgoing.length}</span>
              </h2>
              {outgoing.length ? (
                outgoing.map((link, index) => (
                  <button
                    key={`${link.target}-${index}`}
                    className={`vault-connection ${!link.note ? "unresolved" : ""}`}
                    onClick={() => followLink(link.note, link.target)}
                  >
                    <FileText size={14} />
                    <span>
                      {link.note?.title || link.label || link.target}
                      <small>
                        {link.note
                          ? data.courses.find(
                              (item) => item.id === link.note.courseId,
                            )?.code
                          : "Note not created"}
                      </small>
                    </span>
                    <ChevronRight size={12} />
                  </button>
                ))
              ) : (
                <p className="vault-empty">
                  No outgoing links yet. Add [[Note title]] in the editor.
                </p>
              )}
            </section>
            <section className="vault-inspector-section">
              <h2>
                <GitBranch size={14} />
                Backlinks<span>{backlinks.length}</span>
              </h2>
              {backlinks.length ? (
                backlinks.map(({ note, excerpt }) => (
                  <button
                    key={note.id}
                    className="vault-connection vault-backlink"
                    onClick={() => selectNote(note.id)}
                  >
                    <FileText size={14} />
                    <span>
                      {note.title}
                      {excerpt && <small>{excerpt}</small>}
                    </span>
                  </button>
                ))
              ) : (
                <p className="vault-empty">
                  Notes that link here will appear here.
                </p>
              )}
            </section>
            <section className="vault-inspector-section">
              <h2>
                <List size={14} />
                Outline
              </h2>
              {headings.length ? (
                headings.map((item) => (
                  <button
                    key={item.i}
                    className="vault-outline"
                    onClick={() =>
                      articleRef.current
                        ?.querySelector(`#section-${item.i}`)
                        ?.scrollIntoView({
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "auto"
                            : "smooth",
                          block: "start",
                        })
                    }
                  >
                    {item.line.replace(/^#+ /, "")}
                  </button>
                ))
              ) : (
                <p className="vault-empty">
                  Add headings to outline this note.
                </p>
              )}
            </section>
            {active.source && (
              <section className="vault-inspector-section">
                <h2>
                  <BookOpen size={14} />
                  Source
                </h2>
                <button
                  className="vault-connection"
                  onClick={() =>
                    openMaterial(active.source.materialId, active.source.page)
                  }
                >
                  <FileText size={15} />
                  <span>
                    {active.source.name}
                    <small>
                      Page {active.source.page || 1} · {noteCourse?.code}
                    </small>
                  </span>
                  <ChevronRight size={12} />
                </button>
              </section>
            )}
          </aside>
        </div>
      )}
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
              Course
              <select
                aria-label="New note course"
                value={newCourseId}
                onChange={(event) => setNewCourseId(event.target.value)}
              >
                {availableCourses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
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
                  .filter(
                    (n) =>
                      n.courseId === noteCourseId &&
                      canReadPrivateNote(data, actor, n),
                  )
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
    </>
  );
}
