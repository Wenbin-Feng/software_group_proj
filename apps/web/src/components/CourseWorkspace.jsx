import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  SquarePlay,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { ACCEPTED_FILES, formatBytes, readMaterialFile } from "../lib/files";
import { saveOriginal } from "../lib/originals";
import { outgoingLinks } from "../lib/wikiLinks";
import { canReadMaterial, canReadSession } from "../lib/access";
import { Modal } from "./ui";
import Studio from "./Studio";
import WorkspacePreview, { validMaterialPage } from "./WorkspacePreview";
import "./workspace.css";

const tabKey = (kind, id) => `${kind}:${id}`;

export default function CourseWorkspace() {
  const {
    data,
    setData,
    courseId,
    user,
    role,
    actor,
    route,
    activeSessionId,
    toast,
    openMaterial,
    workspaceRequest,
    workspacePanel,
  } = useApp();
  const isTeacher = role === "teacher";
  const sessions = useMemo(
    () =>
      (data.sessions || []).filter(
        (session) =>
          session.courseId === courseId && canReadSession(data, actor, session),
      ),
    [data, courseId, actor],
  );
  const requestedSession = sessions.find(
    (session) =>
      session.id === activeSessionId &&
      (!isTeacher ||
        !route?.studentId ||
        session.studentId === route.studentId),
  );
  const currentSession = isTeacher
    ? requestedSession
    : requestedSession || sessions[0];
  const student = isTeacher
    ? (data.students || []).find(
        (item) => item.id === currentSession?.studentId,
      )
    : user;
  const studentKey = student?.id;
  const ownedByStudent = useCallback(
    (id) => Boolean(student && (id === student.id || id === student.studentId)),
    [student?.id, student?.studentId],
  );
  const materials = useMemo(
    () =>
      (data.materials || []).filter(
        (material) =>
          material.courseId === courseId &&
          canReadMaterial(data, actor, material) &&
          (!isTeacher || Boolean(currentSession)) &&
          (!material.ownerId || ownedByStudent(material.ownerId)),
      ),
    [data, actor, courseId, currentSession?.id, isTeacher, ownedByStudent],
  );
  const notes = useMemo(
    () =>
      isTeacher
        ? []
        : (data.notes || []).filter(
            (note) =>
              note.courseId === courseId && ownedByStudent(note.studentId),
          ),
    [data.notes, courseId, isTeacher, ownedByStudent],
  );
  const [tabs, setTabs] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({
    shared: true,
    personal: true,
    wiki: true,
  });
  const [mobilePanel, setMobilePanel] = useState("chat");
  const [treeOpen, setTreeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);
  const previousScope = useRef(null);
  const handledRequest = useRef(null);
  const uploadBusy = useRef(false);
  const tabListRef = useRef(null);
  const scope = `${courseId}:${role}:${user.id}:${studentKey || "none"}`;
  const matched = (text) =>
    String(text).toLowerCase().includes(search.trim().toLowerCase());
  const publicMaterials = materials.filter(
    (material) => !material.ownerId && !material.archivedAt,
  );
  const personalMaterials = materials.filter(
    (material) => material.ownerId && !material.archivedAt,
  );

  // Identity changes must never leave another student's private tabs visible.
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    const first = materials.find(
      (material) => !material.ownerId && !material.archivedAt,
    );
    const initial = first
      ? {
          key: tabKey("material", first.id),
          kind: "material",
          id: first.id,
          title: first.name,
          page: validMaterialPage(first),
        }
      : null;
    setTabs(initial ? [initial] : []);
    setActiveKey(initial?.key || null);
    setSearch("");
    setTreeOpen(false);
    setMobilePanel("chat");
    setFiles([]);
    setUploadOpen(false);
  }, [scope, materials]);

  useEffect(() => {
    if (workspacePanel === "files") {
      setTreeOpen(true);
      setMobilePanel("files");
    }
  }, [workspacePanel]);

  const visibleTabs = tabs.filter((tab) => {
    if (tab.kind === "material")
      return materials.some((material) => material.id === tab.id);
    if (tab.kind === "note") return notes.some((note) => note.id === tab.id);
    return (
      tab.ownerId === studentKey &&
      (!tab.sessionId ||
        sessions.some(
          (session) =>
            session.id === tab.sessionId && session.studentId === studentKey,
        ))
    );
  });
  const activeTab =
    visibleTabs.find((tab) => tab.key === activeKey) || visibleTabs[0];

  const openTab = useCallback((next) => {
    setTabs((previous) => {
      const existing = previous.some((tab) => tab.key === next.key);
      return existing
        ? previous.map((tab) =>
            tab.key === next.key ? { ...tab, ...next } : tab,
          )
        : [...previous, next];
    });
    setActiveKey(next.key);
    setTreeOpen(false);
    setMobilePanel("preview");
  }, []);

  const showMaterial = useCallback(
    (id, page = 1) => {
      const material = materials.find((item) => item.id === id);
      if (!material) {
        toast("This document is not available in the current learning space.");
        return;
      }
      openTab({
        key: tabKey("material", id),
        kind: "material",
        id,
        title: material.name,
        page: validMaterialPage(material, page),
      });
    },
    [materials, openTab, toast],
  );

  const showNote = useCallback(
    (note, target) => {
      if (!note || !notes.some((item) => item.id === note.id)) {
        toast(
          target
            ? `“${target}” does not have a page in this Wiki yet.`
            : "This Wiki page is not available.",
        );
        return;
      }
      openTab({
        key: tabKey("note", note.id),
        kind: "note",
        id: note.id,
        title: `${note.title}.md`,
      });
    },
    [notes, openTab, toast],
  );

  const showAnimation = useCallback(
    ({ type, messageId, sessionId, title, html }) => {
      if (!["race", "request", "html"].includes(type)) return;
      if (
        sessionId &&
        !sessions.some(
          (session) =>
            session.id === sessionId && session.studentId === studentKey,
        )
      ) {
        toast("This animation is not available in the current learning space.");
        return;
      }
      const id = `${sessionId || studentKey}:${messageId || type}`;
      openTab({
        key: tabKey("animation", id),
        kind: "animation",
        html,
        id,
        type,
        sessionId,
        ownerId: studentKey,
        title:
          title ||
          (type === "request" ? "browser-request.html" : "race-condition.html"),
      });
    },
    [sessions, studentKey, openTab, toast],
  );

  useEffect(() => {
    if (
      !workspaceRequest ||
      workspaceRequest.requestId === handledRequest.current
    )
      return;
    handledRequest.current = workspaceRequest.requestId;
    if (workspaceRequest.kind === "material")
      showMaterial(workspaceRequest.id, workspaceRequest.page);
    if (workspaceRequest.kind === "note")
      showNote(notes.find((note) => note.id === workspaceRequest.id));
  }, [workspaceRequest, showMaterial, showNote, notes]);

  useEffect(() => {
    if (!treeOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") setTreeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [treeOpen]);

  function closeTab(key) {
    const index = visibleTabs.findIndex((tab) => tab.key === key);
    const remaining = visibleTabs.filter((tab) => tab.key !== key);
    setTabs((previous) => previous.filter((tab) => tab.key !== key));
    if (activeTab?.key === key)
      setActiveKey(
        remaining[Math.min(index, remaining.length - 1)]?.key || null,
      );
  }

  function changePage(key, page) {
    setTabs((previous) =>
      previous.map((tab) => {
        if (tab.key !== key) return tab;
        const material = materials.find((item) => item.id === tab.id);
        return material
          ? { ...tab, page: validMaterialPage(material, page) }
          : tab;
      }),
    );
  }

  function closeUpload() {
    if (uploadBusy.current) return;
    setUploadOpen(false);
    setFiles([]);
    setUploadError("");
  }

  function startUpload() {
    if (isTeacher) return;
    setFiles([]);
    setUploadError("");
    setUploadOpen(true);
    setTreeOpen(false);
  }

  async function uploadFiles() {
    if (isTeacher || !files.length || uploadBusy.current) return;
    uploadBusy.current = true;
    setUploading(true);
    setUploadError("");
    const parsed = [];
    const failures = [];
    for (const file of files) {
      try {
        const material = await readMaterialFile(file);
        const id = `m-${crypto.randomUUID()}`;
        await saveOriginal(id, file, {courseId});
        parsed.push({
          ...material,
          id,
          hasOriginal: true,
          courseId,
          ownerId: isTeacher ? null : user.id,
          uploadedAt: new Date().toISOString(),
        });
      } catch (error) {
        failures.push(`${file.name}: ${error.message}`);
      }
    }
    if (parsed.length) {
      setData((previous) => ({
        ...previous,
        materials: [...previous.materials, ...parsed],
      }));
      setExpanded((previous) => ({
        ...previous,
        [isTeacher ? "shared" : "personal"]: true,
      }));
      setSearch("");
      const first = parsed[0];
      openTab({
        key: tabKey("material", first.id),
        kind: "material",
        id: first.id,
        title: first.name,
        page: validMaterialPage(first),
      });
      toast(
        `${parsed.length} ${parsed.length === 1 ? "document" : "documents"} added.`,
      );
    }
    uploadBusy.current = false;
    setUploading(false);
    setFiles([]);
    if (failures.length) setUploadError(failures.join("\n"));
    else setUploadOpen(false);
  }

  function saveNote(id, content) {
    if (isTeacher || !notes.some((note) => note.id === id)) return;
    const edited = { ...notes.find((note) => note.id === id), content };
    const links = [
      ...new Set(
        outgoingLinks(edited, notes)
          .map((link) => link.note?.id)
          .filter(Boolean),
      ),
    ];
    setData((previous) => ({
      ...previous,
      notes: previous.notes.map((note) =>
        note.id === id
          ? { ...note, content, links, updatedAt: new Date().toISOString() }
          : note,
      ),
    }));
    toast("Wiki page saved.");
  }

  function tabKeys(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = visibleTabs.findIndex((tab) => tab.key === activeTab?.key);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? visibleTabs.length - 1
          : (index +
              (event.key === "ArrowRight" ? 1 : -1) +
              visibleTabs.length) %
            visibleTabs.length;
    if (visibleTabs[next]) {
      setActiveKey(visibleTabs[next].key);
      tabListRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
    }
  }

  const groups = [
    {
      id: "shared",
      name: "course_material",
      items: publicMaterials,
      description: "Shared with the course",
    },
    {
      id: "personal",
      name: "personal_material",
      items: personalMaterials,
      description: "Personal uploads",
    },
    {
      id: "wiki",
      name: "LLM_wiki",
      items: notes,
      description: "Connected knowledge pages",
    },
  ].filter((group) => !isTeacher || group.id !== "wiki");

  return (
    <div className="course-workspace" data-mobile-panel={mobilePanel}>
      <div className="workspace-compact-toolbar">
        <button
          className={treeOpen ? "active" : ""}
          onClick={() => setTreeOpen((value) => !value)}
          aria-expanded={treeOpen}
          aria-controls="course-file-tree"
        >
          <PanelLeft size={16} /> Files
        </button>
        <span>Learning workspace</span>
        <span className="workspace-compact-count">
          <PanelRight size={14} /> {visibleTabs.length} open
        </span>
      </div>
      <nav
        className="workspace-mobile-nav"
        aria-label="Course workspace panels"
      >
        <button
          aria-pressed={mobilePanel === "files"}
          className={mobilePanel === "files" ? "active" : ""}
          onClick={() => setMobilePanel("files")}
        >
          <FolderOpen size={16} /> Files
        </button>
        <button
          aria-pressed={mobilePanel === "chat"}
          className={mobilePanel === "chat" ? "active" : ""}
          onClick={() => setMobilePanel("chat")}
        >
          <MessageSquare size={16} /> Chat
        </button>
        <button
          aria-pressed={mobilePanel === "preview"}
          className={mobilePanel === "preview" ? "active" : ""}
          onClick={() => setMobilePanel("preview")}
        >
          <PanelRight size={16} /> Preview
          {visibleTabs.length > 0 && <span>{visibleTabs.length}</span>}
        </button>
      </nav>
      {treeOpen && (
        <button
          className="workspace-tree-backdrop"
          aria-label="Close files"
          onClick={() => setTreeOpen(false)}
        />
      )}
      <aside
        id="course-file-tree"
        className={`workspace-tree ${treeOpen ? "is-open" : ""}`}
        aria-label="Course file explorer"
      >
        <div className="workspace-tree-heading">
          <span>
            <FolderOpen size={16} /> Files
          </span>
          <div>
            {!isTeacher && (
              <button
                className="workspace-icon-button"
                aria-label={
                  isTeacher
                    ? "Upload course material"
                    : "Upload personal material"
                }
                title={
                  isTeacher
                    ? "Upload course material"
                    : "Upload personal material"
                }
                onClick={startUpload}
              >
                <Plus size={18} />
              </button>
            )}
            <button
              className="workspace-icon-button workspace-tree-close"
              aria-label="Close files"
              onClick={() => setTreeOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="workspace-tree-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a file…"
            aria-label="Search course files"
          />
          {search && (
            <button
              aria-label="Clear file search"
              onClick={() => setSearch("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="workspace-tree-content">
          {groups.map((group) => {
            const items = group.items.filter((item) =>
              matched(group.id === "wiki" ? item.title : item.name),
            );
            const isExpanded = Boolean(search.trim()) || expanded[group.id];
            return (
              <section className="workspace-folder-group" key={group.id}>
                <button
                  className="workspace-folder"
                  aria-expanded={isExpanded}
                  aria-controls={`folder-${group.id}`}
                  title={group.description}
                  onClick={() =>
                    setExpanded((previous) => ({
                      ...previous,
                      [group.id]: !previous[group.id],
                    }))
                  }
                >
                  {isExpanded ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )}
                  {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                  <span>{group.name}</span>
                  <small>{group.items.length}</small>
                </button>
                {isExpanded && (
                  <div
                    className="workspace-folder-files"
                    id={`folder-${group.id}`}
                  >
                    {items.map((item) => {
                      const key = tabKey(
                        group.id === "wiki" ? "note" : "material",
                        item.id,
                      );
                      return (
                        <button
                          className={`workspace-tree-file ${activeTab?.key === key ? "active" : ""}`}
                          aria-current={
                            activeTab?.key === key ? "true" : undefined
                          }
                          title={
                            group.id === "wiki" ? `${item.title}.md` : item.name
                          }
                          key={item.id}
                          onClick={() =>
                            group.id === "wiki"
                              ? showNote(item)
                              : showMaterial(item.id)
                          }
                        >
                          {group.id === "wiki" ? (
                            <BookOpen size={14} />
                          ) : (
                            <FileText size={14} />
                          )}
                          <span>
                            {group.id === "wiki"
                              ? `${item.title}.md`
                              : item.name}
                          </span>
                          {group.id !== "wiki" && <small>{item.type}</small>}
                        </button>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="workspace-folder-empty">
                        {search.trim()
                          ? "No matching files"
                          : group.id === "personal"
                            ? isTeacher
                              ? "No personal uploads"
                              : "Upload your own files"
                            : group.id === "wiki"
                              ? "Save insights from a chat"
                              : "No course materials yet"}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <div className="workspace-tree-footer">
          <LockKeyhole size={13} />
          <span>
            {isTeacher
              ? `${student?.name || "Student"}’s learning space · read only`
              : "Personal files stay in your learning space."}
          </span>
        </div>
      </aside>
      <section className="workspace-chat" aria-label="Learning conversation">
        <Studio
          embedded
          onOpenAnimation={showAnimation}
          onManageMaterials={startUpload}
        />
      </section>
      <aside
        className="workspace-preview"
        aria-label="Document and animation preview"
      >
        {visibleTabs.length ? (
          <>
            <div
              className="workspace-preview-tabs"
              role="tablist"
              aria-label="Open documents"
              ref={tabListRef}
              onKeyDown={tabKeys}
            >
              {visibleTabs.map((tab) => (
                <div
                  className={`workspace-preview-tab ${activeTab?.key === tab.key ? "active" : ""}`}
                  key={tab.key}
                  role="presentation"
                >
                  <button
                    role="tab"
                    id={`tab-${tab.key}`}
                    aria-selected={activeTab?.key === tab.key}
                    aria-controls={`panel-${tab.key}`}
                    tabIndex={activeTab?.key === tab.key ? 0 : -1}
                    title={tab.title}
                    onClick={() => setActiveKey(tab.key)}
                  >
                    {tab.kind === "animation" ? (
                      <SquarePlay size={14} />
                    ) : tab.kind === "note" ? (
                      <BookOpen size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                    <span>{tab.title}</span>
                  </button>
                  <button
                    className="workspace-tab-close"
                    onClick={() => closeTab(tab.key)}
                    aria-label={`Close ${tab.title}`}
                    title="Close tab"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="workspace-preview-panels">
              {visibleTabs.map((tab) => (
                <div
                  role="tabpanel"
                  aria-labelledby={`tab-${tab.key}`}
                  id={`panel-${tab.key}`}
                  className="workspace-preview-panel"
                  hidden={activeTab?.key !== tab.key}
                  key={tab.key}
                >
                  <WorkspacePreview
                    tab={tab}
                    material={materials.find(
                      (material) => material.id === tab.id,
                    )}
                    note={notes.find((note) => note.id === tab.id)}
                    notes={notes}
                    readOnly={isTeacher}
                    onPage={(page) => changePage(tab.key, page)}
                    onOpenNote={showNote}
                    onOpenMaterial={openMaterial}
                    onOpenAnimation={showAnimation}
                    onSaveNote={saveNote}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="workspace-preview-empty">
            <span>
              <PanelRight size={24} strokeWidth={1.5} />
            </span>
            <h2>A little room to explore.</h2>
            <p>
              Open a file from the tree or an animation from your conversation.
            </p>
            <button
              className="workspace-small-button"
              onClick={() => {
                setTreeOpen(true);
                setMobilePanel("files");
              }}
            >
              <FolderOpen size={14} /> Browse files
            </button>
          </div>
        )}
      </aside>
      {!isTeacher && uploadOpen && (
        <Modal
          title={isTeacher ? "Add course material" : "Add personal material"}
          subtitle={
            isTeacher
              ? "Shared with everyone in this course."
              : "Visible to you and your course teacher."
          }
          onClose={closeUpload}
        >
          <label
            className={`workspace-upload-drop ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!uploading) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!uploading) {
                setFiles(Array.from(event.dataTransfer.files));
                setUploadError("");
              }
            }}
          >
            <input
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              disabled={uploading}
              onChange={(event) => {
                setFiles(Array.from(event.target.files));
                setUploadError("");
              }}
            />
            <Upload size={26} strokeWidth={1.5} />
            <strong>Choose files or drop them here</strong>
            <span>PDF, Markdown or text · 10 MB per file</span>
          </label>
          {files.length > 0 && (
            <div className="workspace-upload-files">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  <FileText size={16} />
                  <span>{file.name}</span>
                  <small>{formatBytes(file.size)}</small>
                </div>
              ))}
            </div>
          )}
          {uploadError && (
            <p className="workspace-upload-error" role="alert">
              {uploadError}
            </p>
          )}
          <p className="workspace-upload-note">
            Original files and extracted text are saved in this browser. Scanned
            PDFs need OCR before upload.
          </p>
          <div className="workspace-upload-actions">
            <button
              className="workspace-small-button"
              disabled={uploading}
              onClick={closeUpload}
            >
              Cancel
            </button>
            <button
              className="workspace-small-button is-primary"
              disabled={!files.length || uploading}
              onClick={uploadFiles}
            >
              {uploading ? (
                <LoaderCircle size={15} className="workspace-spin" />
              ) : (
                <Plus size={15} />
              )}
              {uploading ? "Extracting text…" : "Add materials"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
