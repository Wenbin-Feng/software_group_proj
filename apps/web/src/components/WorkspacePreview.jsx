import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  LoaderCircle,
  Pencil,
  Play,
} from "lucide-react";
import { getOriginal } from "../lib/originals";
import { coursewareHtml } from "../lib/coursewareHtml";
import { WikiMarkdown } from "./Wiki";
import LearningAnimation from "./Animation";

export function materialPages(material) {
  return material?.pages?.length
    ? material.pages
    : [{ page: 1, text: material?.text || "No extracted text is available." }];
}

export function validMaterialPage(material, requested = 1) {
  const pages = materialPages(material);
  const value = Number(requested);
  if (!Number.isFinite(value)) return pages[0].page;
  const rounded = Math.floor(value);
  return pages.reduce((closest, page) =>
    Math.abs(page.page - rounded) < Math.abs(closest.page - rounded)
      ? page
      : closest,
  ).page;
}

function downloadText(name, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MaterialDocument({ material, pageNumber, onPage, notes, onOpenNote }) {
  const [original, setOriginal] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("text");
  const [originalError, setOriginalError] = useState("");
  const pages = materialPages(material);
  const page = pages.find((item) => item.page === pageNumber) || pages[0];
  const index = pages.findIndex((item) => item.page === page.page);

  useEffect(() => {
    let disposed = false;
    let url;
    setOriginal(null);
    setOriginalUrl(null);
    setMode("text");
    setOriginalError("");
    setLoading(Boolean(material.hasOriginal));
    if (material.hasOriginal) {
      getOriginal(material.id)
        .then((file) => {
          if (disposed) return;
          if (!file) {
            setOriginalError(
              "Original file unavailable on the server. Extracted text is still available.",
            );
            return;
          }
          url = URL.createObjectURL(file);
          setOriginal(file);
          setOriginalUrl(url);
          if (material.type === "pdf") setMode("original");
        })
        .catch(() => {
          if (!disposed)
            setOriginalError(
              "Could not load the original file. You can still read the extracted text.",
            );
        })
        .finally(() => {
          if (!disposed) setLoading(false);
        });
    }
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [material.id, material.hasOriginal, material.type]);

  function exportText() {
    downloadText(
      `${material.name.replace(/\.[^.]+$/, "")}-extracted.txt`,
      pages
        .map((item) => `Page ${item.page}\n\n${item.text}`)
        .join("\n\n---\n\n"),
    );
  }

  return (
    <div className="workspace-document">
      <div className="workspace-reader-toolbar">
        <div className="workspace-page-control">
          <button
            className="workspace-icon-button"
            aria-label="Previous page"
            disabled={index <= 0}
            onClick={() => onPage(pages[index - 1].page)}
          >
            <ChevronLeft size={16} />
          </button>
          <label>
            <span className="sr-only">Document page</span>
            <select
              value={page.page}
              onChange={(event) => onPage(Number(event.target.value))}
            >
              {pages.map((item) => (
                <option value={item.page} key={item.page}>
                  Page {item.page} of {pages.length}
                </option>
              ))}
            </select>
          </label>
          <button
            className="workspace-icon-button"
            aria-label="Next page"
            disabled={index >= pages.length - 1}
            onClick={() => onPage(pages[index + 1].page)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {originalUrl ? (
          <a
            className="workspace-icon-button"
            href={originalUrl}
            download={original.name}
            title="Download original"
            aria-label="Download original"
          >
            <ArrowDownToLine size={16} />
          </a>
        ) : (
          <button
            className="workspace-icon-button"
            onClick={exportText}
            title="Download extracted text"
            aria-label="Download extracted text"
          >
            <ArrowDownToLine size={16} />
          </button>
        )}
      </div>
      {original && material.type === "pdf" && (
        <div
          className="workspace-reader-modes"
          role="group"
          aria-label="Document view"
        >
          <button
            aria-pressed={mode === "original"}
            className={mode === "original" ? "active" : ""}
            onClick={() => setMode("original")}
          >
            Original PDF
          </button>
          <button
            aria-pressed={mode === "text"}
            className={mode === "text" ? "active" : ""}
            onClick={() => setMode("text")}
          >
            Extracted text
          </button>
        </div>
      )}
      {originalError && (
        <p className="workspace-reader-notice" role="status">
          {originalError}
        </p>
      )}
      {loading && (
        <p className="workspace-reader-loading">
          <LoaderCircle size={15} className="workspace-spin" /> Loading
          original…
        </p>
      )}
      {mode === "original" && originalUrl ? (
        <iframe
          title={`Original PDF: ${material.name}`}
          className="workspace-pdf"
          src={`${originalUrl}#page=${page.page}&view=FitH`}
        />
      ) : (
        <div className="workspace-document-scroll">
          <article
            className={`workspace-document-paper ${material.type === "md" ? "is-markdown" : ""}`}
          >
            <div className="workspace-document-label">
              <FileText size={13} /> {material.type.toUpperCase()} ·{" "}
              {material.ownerId ? "Personal material" : "Course material"}
            </div>
            <h2>{material.name.replace(/\.(pdf|md|markdown|txt)$/i, "")}</h2>
            {material.type === "md" ? (
              <WikiMarkdown
                content={page.text}
                notes={notes}
                onLink={onOpenNote}
              />
            ) : (
              <div className="workspace-extracted-content">{page.text}</div>
            )}
            <footer>{page.page}</footer>
          </article>
          <p className="workspace-document-caption">
            {material.hasOriginal
              ? "Extracted document text"
              : "Sample course material · text preview"}
          </p>
        </div>
      )}
    </div>
  );
}

function NoteDocument({
  note,
  notes,
  readOnly,
  onOpenNote,
  onOpenMaterial,
  onOpenAnimation,
  onSave,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content || "");
  useEffect(() => {
    if (!editing) setDraft(note.content || "");
  }, [note.content, editing]);
  const animation =
    (note.visualizationHtml ? "html" : note.animation) ||
    (/race condition/i.test(note.title)
      ? "race"
      : /browser|web request/i.test(note.title)
        ? "request"
        : null);
  return (
    <div className="workspace-note-document">
      <div className="workspace-reader-toolbar">
        <span className="workspace-note-path">
          <BookOpen size={14} /> LLM_wiki
        </span>
        <div className="workspace-reader-actions">
          {!readOnly &&
            (editing ? (
              <>
                <button
                  className="workspace-small-button"
                  onClick={() => {
                    setDraft(note.content || "");
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="workspace-small-button is-primary"
                  onClick={() => {
                    onSave(note.id, draft);
                    setEditing(false);
                  }}
                >
                  <Check size={13} /> Save
                </button>
              </>
            ) : (
              <button
                className="workspace-icon-button"
                onClick={() => setEditing(true)}
                aria-label="Edit wiki note"
                title="Edit wiki note"
              >
                <Pencil size={15} />
              </button>
            ))}
          <button
            className="workspace-icon-button"
            onClick={() =>
              downloadText(
                `${note.title}.md`,
                note.content || "",
                "text/markdown;charset=utf-8",
              )
            }
            aria-label="Download Markdown"
            title="Download Markdown"
          >
            <ArrowDownToLine size={16} />
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          className="workspace-wiki-editor"
          aria-label="Wiki Markdown"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="workspace-document-scroll">
          <article className="workspace-note-paper">
            <div className="workspace-document-label">
              PERSONAL WIKI {readOnly ? "· READ ONLY" : ""}
            </div>
            <h2>{note.title}</h2>
            {note.tags?.length > 0 && (
              <div className="workspace-note-tags">
                {note.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            )}
            <WikiMarkdown
              content={(note.content || "").replace(/^# [^\n]+\n*/, "")}
              notes={notes}
              sourceNote={note}
              onLink={onOpenNote}
            />
            {(note.source || (note.hasAnimation && animation)) && (
              <div className="workspace-note-references">
                {note.source && (
                  <button
                    onClick={() =>
                      onOpenMaterial(note.source.materialId, note.source.page)
                    }
                  >
                    <Link2 size={14} />
                    <span>
                      {note.source.name}
                      <small>Page {note.source.page}</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                )}
                {note.hasAnimation && animation && (
                  <button
                    onClick={() =>
                      onOpenAnimation({
                        type: animation,
                        html: note.visualizationHtml,
                        messageId: `note-${note.id}`,
                        title: `${note.title}.html`,
                      })
                    }
                  >
                    <Play size={14} />
                    <span>Open interactive animation</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

export default function WorkspacePreview({
  tab,
  material,
  note,
  notes,
  readOnly,
  onPage,
  onOpenNote,
  onOpenMaterial,
  onOpenAnimation,
  onSaveNote,
}) {
  if (tab.kind === "material" && material?.html)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <a
          className="btn btn-outline"
          href={`/api/materials/${encodeURIComponent(material.id)}/original`}
        >
          Download PPTX
        </a>
        <iframe
          className="generated-html"
          title={material.name}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={
            material.type === "pptx" &&
            typeof material.generatedCoursewareId === "string" &&
            material.generatedCoursewareId
              ? coursewareHtml(material.html)
              : material.html
          }
        />
      </div>
    );
  if (tab.kind === "material" && material)
    return (
      <MaterialDocument
        material={material}
        pageNumber={tab.page}
        onPage={onPage}
        notes={notes}
        onOpenNote={onOpenNote}
      />
    );
  if (tab.kind === "note" && note)
    return (
      <NoteDocument
        note={note}
        notes={notes}
        readOnly={readOnly}
        onOpenNote={onOpenNote}
        onOpenMaterial={onOpenMaterial}
        onOpenAnimation={onOpenAnimation}
        onSave={onSaveNote}
      />
    );
  if (tab.kind === "animation")
    return (
      <div className="workspace-animation-document">
        <div className="workspace-reader-toolbar">
          <span className="workspace-note-path">
            <Play size={13} /> Interactive animation
          </span>
          <span className="workspace-html-label">HTML</span>
        </div>
        <div className="workspace-animation-scroll">
          <>
            {tab.type === "html" ? (
              <iframe
                className="generated-html"
                title={tab.title || "Visual explanation"}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                srcDoc={tab.html}
              />
            ) : (
              <LearningAnimation type={tab.type} />
            )}
          </>
        </div>
      </div>
    );
  return null;
}
