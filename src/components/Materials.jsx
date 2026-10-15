import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { ACCEPTED_FILES, formatBytes, readMaterialFile } from "../lib/files";
import { saveOriginal } from "../lib/originals";
import "./course.css";

export default function Materials() {
  const { data, setData, courseId, user, role, navigate, toast, openMaterial } =
    useApp();
  const [tab, setTab] = useState("shared");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const busyRef = useRef(false);
  busyRef.current = uploading;
  useEffect(() => {
    if (!uploadOpen) return;
    const previousFocus = document.activeElement;
    modalRef.current?.querySelector("button")?.focus();
    function handleKey(event) {
      if (event.key === "Escape" && !busyRef.current) {
        setUploadOpen(false);
        setFiles([]);
        setError("");
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        modalRef.current?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ) || [],
      );
      if (!items.length) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === items[items.length - 1]
      ) {
        event.preventDefault();
        items[0].focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [uploadOpen]);
  const all = data.materials.filter(
    (m) =>
      m.courseId === courseId &&
      (!m.ownerId || role === "teacher" || m.ownerId === user.id),
  );
  const shared = all.filter((m) => !m.ownerId);
  const personal = all.filter((m) => m.ownerId);
  const displayed = (tab === "shared" ? shared : personal).filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  );
  const pageCount = shared.reduce((sum, m) => sum + m.pages.length, 0);
  const closeUpload = () => {
    if (!uploading) {
      setUploadOpen(false);
      setFiles([]);
      setError("");
    }
  };
  const selectFiles = (list) => {
    setFiles(Array.from(list));
    setError("");
  };

  async function handleUpload() {
    if (!files.length || uploading) return;
    setUploading(true);
    setError("");
    const parsed = [];
    const failures = [];
    for (const file of files) {
      try {
        const material = await readMaterialFile(file);
        const id = `m-${crypto.randomUUID()}`;
        await saveOriginal(id, file);
        parsed.push({
          ...material,
          id,
          hasOriginal: true,
          courseId,
          ownerId: role === "teacher" ? null : user.id,
          uploadedAt: new Date().toISOString(),
        });
      } catch (e) {
        failures.push(`${file.name}: ${e.message}`);
      }
    }
    if (parsed.length) {
      setData((previous) => ({
        ...previous,
        materials: [...previous.materials, ...parsed],
      }));
      setTab(role === "teacher" ? "shared" : "personal");
      toast(
        `${parsed.length} ${parsed.length === 1 ? "document" : "documents"} added. Text extracted locally.`,
      );
    }
    setUploading(false);
    if (failures.length) {
      setError(failures.join("\n"));
      setFiles([]);
    } else {
      setUploadOpen(false);
      setFiles([]);
    }
  }

  return (
    <div className="course-page">
      <div className="course-page-heading">
        <div>
          <div className="course-eyebrow">YOUR COURSE LIBRARY</div>
          <h1>Materials</h1>
          <p>The starting point for every good question.</p>
        </div>
        <button className="btn primary" onClick={() => setUploadOpen(true)}>
          <Plus size={17} /> Upload material
        </button>
      </div>
      <div className="materials-banner">
        <div className="materials-banner-icon">
          <FolderOpen size={29} strokeWidth={1.5} />
        </div>
        <div>
          <span className="course-eyebrow">
            A SHARED FOUNDATION. YOUR OWN PERSPECTIVE.
          </span>
          <h2>Everything you need, in one place.</h2>
          <p>
            Learn from your course materials, then bring your own notes into the
            conversation.
          </p>
        </div>
        <div className="materials-banner-stats">
          <strong>{shared.length}</strong>
          <span>course materials</span>
          <span className="material-stat-separator" />
          <strong>{pageCount}</strong>
          <span>pages of context</span>
        </div>
      </div>
      <div className="materials-layout">
        <section className="materials-main">
          <div className="materials-toolbar">
            <div
              className="course-tabs"
              role="tablist"
              aria-label="Material visibility"
            >
              <button
                role="tab"
                aria-selected={tab === "shared"}
                className={tab === "shared" ? "active" : ""}
                onClick={() => setTab("shared")}
              >
                <Globe2 size={15} /> Course library <span>{shared.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={tab === "personal"}
                className={tab === "personal" ? "active" : ""}
                onClick={() => setTab("personal")}
              >
                <LockKeyhole size={14} />
                {role === "teacher" ? "Student uploads" : "My materials"}
                <span>{personal.length}</span>
              </button>
            </div>
            <label className="course-search">
              <Search size={16} />
              <input
                aria-label="Search materials"
                placeholder="Find a document…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="materials-visibility">
            <ShieldCheck size={14} />
            {tab === "shared"
              ? "Available to everyone enrolled in this course."
              : role === "teacher"
                ? "Student files are visible to their owner and the course teacher."
                : "Only you and your course teacher can see these files."}
          </div>
          <div className="material-table">
            <div className="material-table-head">
              <span>DOCUMENT</span>
              <span>PAGES</span>
              <span>ADDED</span>
              <span />
            </div>
            {displayed.map((material, index) => {
              const owner = data.students.find(
                (student) => student.id === material.ownerId,
              );
              return (
                <button
                  className="material-row"
                  key={material.id}
                  onClick={() => openMaterial(material.id, 1)}
                >
                  <span className="material-name-cell">
                    <span className={`material-file-icon ${material.type}`}>
                      <FileText size={21} strokeWidth={1.5} />
                      <small>{material.type.toUpperCase()}</small>
                    </span>
                    <span>
                      <strong>{material.name}</strong>
                      <span className="material-row-meta">
                        {formatBytes(material.size)}
                        <i />
                        {owner ? owner.name : "Course material"}
                        <i />
                        <span className="material-ready">
                          <Check size={11} /> Ready to explore
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="material-page-number">
                    {material.pages.length}
                  </span>
                  <span className="material-date">
                    {new Date(material.uploadedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
            {displayed.length === 0 && (
              <div className="course-empty">
                <FolderOpen size={30} />
                <h3>
                  {search
                    ? "No matching documents"
                    : "A little room for your own ideas"}
                </h3>
                <p>
                  {search
                    ? "Try a different title or clear the search."
                    : "Upload notes, readings or questions to add your perspective."}
                </p>
                <button
                  className="btn secondary"
                  onClick={() => (search ? setSearch("") : setUploadOpen(true))}
                >
                  {search ? "Clear search" : "Upload your first file"}
                </button>
              </div>
            )}
          </div>
          <p className="material-library-note">
            <BookOpen size={14} /> Open a document to read its extracted text,
            follow page references or view the uploaded original.
          </p>
        </section>
        <aside className="materials-aside">
          <div className="material-explore-card">
            <span className="material-explore-symbol">
              <Sparkles size={20} />
            </span>
            <span className="course-eyebrow">GO BEYOND THE PAGE</span>
            <h3>
              Don’t just read it.
              <br />
              Make it click.
            </h3>
            <p>
              Ask a question, connect an idea, or turn a tricky concept into an
              interactive animation.
            </p>
            <button onClick={() => navigate("studio")}>
              Open learning studio <ArrowUpRight size={17} />
            </button>
            <div className="material-card-graphic">
              <span>Read</span>
              <i />
              <span>Ask</span>
              <i />
              <span>Understand</span>
            </div>
          </div>
          <div className="material-info-card">
            <div>
              <LockKeyhole size={17} />
              <h3>Your context stays yours</h3>
            </div>
            <p>
              Your personal uploads are included in your learning context. Other
              students cannot see or use them.
            </p>
            <span>Teacher access is visible and intentional.</span>
          </div>
          <div className="material-supported">
            <FileText size={16} />
            <span>
              PDF · Markdown · Text
              <br />
              <small>Up to 10 MB per file</small>
            </span>
          </div>
        </aside>
      </div>
      {uploadOpen && (
        <div className="course-modal-backdrop" onClick={closeUpload}>
          <section
            ref={modalRef}
            className="course-upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="course-modal-top">
              <span className="course-modal-icon">
                <UploadCloud size={23} />
              </span>
              <button
                className="course-icon-button"
                aria-label="Close upload"
                disabled={uploading}
                onClick={closeUpload}
              >
                <X size={19} />
              </button>
            </div>
            <h2 id="upload-heading">Bring your materials.</h2>
            <p>
              {role === "teacher"
                ? "Add a shared document to the course library."
                : "Add context to your personal learning space."}
            </p>
            <label
              className={`material-dropzone ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!uploading) selectFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_FILES}
                multiple
                disabled={uploading}
                onChange={(e) => selectFiles(e.target.files)}
              />
              <UploadCloud size={29} strokeWidth={1.5} />
              <strong>
                Click to browse <span>or drop files here</span>
              </strong>
              <small>PDF, Markdown or text · up to 10 MB each</small>
            </label>
            {files.length > 0 && (
              <div className="upload-selected-list">
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`}>
                    <FileText size={17} />
                    <span>
                      {file.name}
                      <small>{formatBytes(file.size)}</small>
                    </span>
                    <Check size={15} />
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="course-upload-error" role="alert">
                {error}
              </p>
            )}
            <div className="upload-local-note">
              <ShieldCheck size={16} />
              <p>
                Your original file and extracted text stay in this browser.
                Scanned PDFs need OCR before upload.
              </p>
            </div>
            <div className="upload-access-label">
              <LockKeyhole size={14} />
              {role === "teacher"
                ? "Shared with this course"
                : "Visible to you and your course teacher"}
            </div>
            <div className="course-modal-actions">
              <button
                className="btn secondary"
                disabled={uploading}
                onClick={closeUpload}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!files.length || uploading}
                onClick={handleUpload}
              >
                {uploading ? (
                  <LoaderCircle size={17} className="course-spin" />
                ) : (
                  <ArrowDownToLine size={17} />
                )}{" "}
                {uploading
                  ? "Extracting text…"
                  : `Add ${files.length > 1 ? `${files.length} documents` : "document"}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
