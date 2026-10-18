import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  LoaderCircle,
  Presentation,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context";
import { api } from "../lib/api";
import { coursewareHtml } from "../lib/coursewareHtml";
import "./courseware.css";

export default function Courseware() {
  const { data, courseId, toast, refresh } = useApp();
  const [items, setItems] = useState([]),
    [selected, setSelected] = useState(null);
  const [job, setJob] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    topic: "",
    requirements: "",
    language: "English",
    slideCount: 10,
    materialIds: [],
  });
  const [deck, setDeck] = useState(null),
    [dirty, setDirty] = useState(false),
    [editor, setEditor] = useState(0);
  const materials = data.materials.filter(
    (file) => file.courseId === courseId && !file.ownerId && !file.archivedAt,
  );
  const notify = (message) => {
    if (typeof toast === "function") toast(message);
  };
  const loadItems = async () => {
    const result = await api(
      `/api/courseware?courseId=${encodeURIComponent(courseId)}`,
    );
    setItems(result.courseware);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected(null);
    setDeck(null);
    setJob(null);
    setError("");
    setForm({
      topic: "",
      requirements: "",
      language: "English",
      slideCount: 10,
      materialIds: [],
    });
    Promise.all([
      api(`/api/courseware?courseId=${encodeURIComponent(courseId)}`),
      api(`/api/jobs?courseId=${encodeURIComponent(courseId)}`),
    ])
      .then(([result, tasks]) => {
        if (active) {
          setItems(result.courseware);
          setJob(
            tasks.jobs.find(
              (item) =>
                item.type === "courseware" &&
                ["queued", "running"].includes(item.status),
            ) ||
              tasks.jobs.find(
                (item) =>
                  item.type === "courseware" && item.status === "failed",
              ) ||
              null,
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    let active = true,
      timer;
    const poll = async () => {
      let terminal = false;
      try {
        const { job: next } = await api(`/api/jobs/${job.id}`);
        if (!active) return;
        if (next.status === "succeeded") {
          const [list, detail] = await Promise.all([
            api(`/api/courseware?courseId=${encodeURIComponent(courseId)}`),
            api(`/api/courseware/${next.result.coursewareId}`),
          ]);
          if (!active) return;
          // Apply the review before changing the status, which cleans up this polling effect.
          setItems(list.courseware);
          setSelected(detail.courseware);
          setDeck(structuredClone(detail.courseware.deck));
          setDirty(false);
          setEditor(0);
          setError("");
          notify("Your courseware is ready to review.");
          terminal = true;
        } else if (next.status === "failed") terminal = true;
        setJob(next);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active && !terminal) timer = setTimeout(poll, 1600);
      }
    };
    timer = setTimeout(poll, 1600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [job?.id, job?.status, courseId]);
  async function openDeck(id) {
    setError("");
    try {
      const result = await api(`/api/courseware/${id}`);
      setSelected(result.courseware);
      setDeck(structuredClone(result.courseware.deck));
      setDirty(false);
      setEditor(0);
    } catch (e) {
      setError(e.message);
    }
  }
  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { jobId } = await api("/api/courseware", {
        method: "POST",
        body: { ...form, courseId, slideCount: Number(form.slideCount) },
      });
      setJob({ id: jobId, status: "queued", progress: 0, attempts: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/courseware/${selected.id}`, {
        method: "PATCH",
        body: { deck },
      });
      setSelected(result.courseware);
      setDirty(false);
      await loadItems();
      notify("Changes saved.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (dirty && !(await save())) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/api/courseware/${selected.id}/publish`, {
        method: "POST",
      });
      setSelected(result.courseware);
      await loadItems();
      if (refresh) await refresh();
      notify("Courseware published to course materials.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function editSlide(field, value) {
    setDeck((current) => ({
      ...current,
      slides: current.slides.map((slide, i) =>
        i === editor ? { ...slide, [field]: value } : slide,
      ),
    }));
    setDirty(true);
  }
  const pending = job && ["queued", "running"].includes(job.status);
  return (
    <section className="courseware" aria-label="Teacher courseware">
      <header className="courseware-header">
        <div>
          <span className="courseware-kicker">TEACHING STUDIO</span>
          <h2>Courseware</h2>
          <p>
            Turn your course materials into a lesson you can edit and share.
          </p>
        </div>
        {selected && (
          <button
            className="btn btn-outline"
            onClick={() => {
              setSelected(null);
              setDeck(null);
            }}
          >
            <ArrowLeft size={15} /> All courseware
          </button>
        )}
      </header>
      {error && (
        <div role="alert" className="courseware-error">
          {error}
        </div>
      )}
      {job && (
        <div className={`courseware-task ${job.status}`} aria-live="polite">
          <div className="courseware-task-heading">
            {pending ? (
              <LoaderCircle size={17} className="courseware-spin" />
            ) : job.status === "succeeded" ? (
              <Check size={17} />
            ) : (
              <RefreshCw size={17} />
            )}
            <strong>
              {job.status === "queued"
                ? "Waiting to generate"
                : job.status === "running"
                  ? "Preparing your lesson"
                  : job.status === "succeeded"
                    ? "Courseware ready"
                    : "Generation stopped"}
            </strong>
            <span>{pending ? `${job.progress || 0}%` : ""}</span>
          </div>
          {pending ? (
            <>
              <progress max={100} value={job.progress || 0} />
              <p>You can leave this page. The task continues on the server.</p>
            </>
          ) : job.status === "failed" ? (
            <>
              <p>{job.error}</p>
              {job.attempts < 3 && (
                <button
                  className="btn btn-outline"
                  onClick={async () => {
                    try {
                      const result = await api(`/api/jobs/${job.id}/retry`, {
                        method: "POST",
                      });
                      setJob(result.job);
                      setError("");
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  <RefreshCw size={14} /> Retry generation
                </button>
              )}
            </>
          ) : null}
        </div>
      )}
      {selected && deck ? (
        <div className="courseware-review">
          <div className="courseware-review-bar">
            <div>
              <span className={`courseware-status ${selected.status}`}>
                {selected.status === "published"
                  ? "Published"
                  : "Private draft"}
              </span>
              {dirty && (
                <span className="courseware-unsaved">Unsaved changes</span>
              )}
            </div>
            <div>
              <button
                className="btn btn-outline"
                disabled={busy || !dirty}
                onClick={save}
              >
                <Save size={15} /> Save changes
              </button>
              <a
                className={`btn btn-outline ${dirty ? "disabled" : ""}`}
                aria-disabled={dirty}
                href={dirty ? undefined : `/api/courseware/${selected.id}/pptx`}
                onClick={(e) => {
                  if (dirty) e.preventDefault();
                }}
              >
                <Download size={15} /> Editable PPTX
              </a>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={publish}
              >
                <Send size={15} />{" "}
                {selected.status === "published"
                  ? "Update published copy"
                  : "Publish to course"}
              </button>
            </div>
          </div>
          <label className="courseware-title-label">
            Deck title
            <input
              value={deck.title}
              maxLength={160}
              onChange={(e) => {
                setDeck({ ...deck, title: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          <div className="courseware-editor-layout">
            <div className="courseware-edit-panel">
              <div
                className="courseware-slide-tabs"
                role="tablist"
                aria-label="Slides"
              >
                {deck.slides.map((slide, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === editor}
                    onClick={() => setEditor(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <span className="courseware-kicker">
                SLIDE {editor + 1} ·{" "}
                {deck.slides[editor].layout.replace("-", " ")}
              </span>
              <label>
                Title
                <input
                  value={deck.slides[editor].title}
                  maxLength={140}
                  onChange={(e) => editSlide("title", e.target.value)}
                />
              </label>
              <label>
                Main points <small>One point per line, up to six</small>
                <textarea
                  rows={7}
                  value={deck.slides[editor].body.join("\n")}
                  onChange={(e) =>
                    editSlide("body", e.target.value.split("\n").slice(0, 6))
                  }
                />
              </label>
              {deck.slides[editor].layout === "two-column" && (
                <label>
                  Second column
                  <textarea
                    rows={5}
                    value={deck.slides[editor].secondary.join("\n")}
                    onChange={(e) =>
                      editSlide(
                        "secondary",
                        e.target.value.split("\n").slice(0, 6),
                      )
                    }
                  />
                </label>
              )}
              {deck.slides[editor].layout === "table" && (
                <label>
                  Table <small>One row per line, separate cells with |</small>
                  <textarea
                    rows={6}
                    value={deck.slides[editor].table
                      .map((row) => row.join(" | "))
                      .join("\n")}
                    onChange={(e) =>
                      editSlide(
                        "table",
                        e.target.value
                          .split("\n")
                          .map((row) =>
                            row.split("|").map((cell) => cell.trim()),
                          ),
                      )
                    }
                  />
                </label>
              )}
              <label>
                Teaching notes
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={deck.slides[editor].notes}
                  onChange={(e) => editSlide("notes", e.target.value)}
                />
              </label>
              {deck.slides[editor].sources.length > 0 && (
                <p className="courseware-source-note">
                  <FileText size={13} />{" "}
                  {deck.slides[editor].sources
                    .map(
                      (source) =>
                        `${materials.find((item) => item.id === source.materialId)?.name || "Course material"}, p. ${source.page}`,
                    )
                    .join(" · ")}
                </p>
              )}
              <p className="courseware-help">
                Save changes to refresh the preview and enable export. Complex
                animations become static slides in PowerPoint.
              </p>
            </div>
            <div className="courseware-preview">
              <div>
                <Presentation size={15} /> Saved preview <span>16:9</span>
              </div>
              <iframe
                title="Courseware preview"
                srcDoc={coursewareHtml(selected.html)}
                sandbox=""
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="courseware-grid">
          <form className="courseware-form" onSubmit={generate}>
            <div className="courseware-section-title">
              <Sparkles size={18} />
              <h3>Create a lesson</h3>
            </div>
            <label htmlFor="courseware-topic">
              Topic
              <input
                id="courseware-topic"
                required
                maxLength={200}
                placeholder="For example, transaction isolation"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
            </label>
            <label htmlFor="courseware-requirements">
              Teaching requirements
              <textarea
                id="courseware-requirements"
                maxLength={4000}
                rows={4}
                placeholder="Learning goals, audience, worked examples or exercises…"
                value={form.requirements}
                onChange={(e) =>
                  setForm({ ...form, requirements: e.target.value })
                }
              />
            </label>
            <div className="courseware-form-row">
              <label htmlFor="courseware-language">
                Language
                <select
                  aria-label="Language"
                  id="courseware-language"
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                >
                  <option>English</option>
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-HK">繁體中文</option>
                </select>
              </label>
              <label htmlFor="courseware-count">
                Slides
                <input
                  id="courseware-count"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={form.slideCount}
                  onChange={(e) =>
                    setForm({ ...form, slideCount: e.target.value })
                  }
                />
              </label>
            </div>
            <fieldset>
              <legend>
                Course sources <span>{form.materialIds.length} selected</span>
              </legend>
              <p className="courseware-help">
                Only active public course materials are available here.
              </p>
              <div className="courseware-source-list">
                {materials.map((material) => (
                  <label key={material.id}>
                    <input
                      type="checkbox"
                      checked={form.materialIds.includes(material.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          materialIds: e.target.checked
                            ? [...form.materialIds, material.id]
                            : form.materialIds.filter(
                                (id) => id !== material.id,
                              ),
                        })
                      }
                    />
                    <FileText size={16} />
                    <span>
                      {material.name}
                      <small>{material.pages?.length || 1} pages</small>
                    </span>
                  </label>
                ))}
                {!materials.length && (
                  <p>
                    No active materials yet. You can still generate a general
                    lesson.
                  </p>
                )}
              </div>
            </fieldset>
            <button
              className="btn btn-primary courseware-generate"
              disabled={busy || pending || !form.topic.trim()}
            >
              <Sparkles size={16} />{" "}
              {busy ? "Starting…" : "Generate courseware"}
            </button>
            <p className="courseware-help">
              Generated lessons stay private until you publish. Review AI
              content before sharing it with students.
            </p>
          </form>
          <div className="courseware-library">
            <div className="courseware-section-title">
              <Presentation size={18} />
              <h3>Your courseware</h3>
              <span>{items.length}</span>
            </div>
            {loading ? (
              <p className="courseware-empty">Loading courseware…</p>
            ) : !items.length ? (
              <div className="courseware-empty">
                <Presentation size={35} />
                <h3>Your next lesson starts here.</h3>
                <p>
                  Select your materials and describe the lesson. You will get an
                  HTML preview and an editable PowerPoint file.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  className="courseware-card"
                  key={item.id}
                  onClick={() => openDeck(item.id)}
                >
                  <span className="courseware-card-icon">
                    <Presentation size={21} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      Updated {new Date(item.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                  <span className={`courseware-status ${item.status}`}>
                    {item.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
