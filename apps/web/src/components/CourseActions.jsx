import { useState } from "react";
import { Plus, LogIn, RefreshCw, Copy } from "lucide-react";
import { api, flushChanges } from "../lib/api";
import { useApp } from "../context";
import { Modal } from "./ui";

export function JoinCourse() {
  const { refreshWorkspace, toast, navigate } = useApp();
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function join(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await flushChanges();
      const result = await api("/api/courses/join", {
        method: "POST",
        body: { code },
      });
      await refreshWorkspace();
      setCode("");
      toast("You have joined the course.");
      if (result.course?.id) navigate("course", { courseId: result.course.id });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="course-enrollment" onSubmit={join}>
        <label className="sr-only" htmlFor="join-code">
          Course join code
        </label>
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter a course join code"
          maxLength={40}
          required
        />
        <button className="btn btn-primary" disabled={busy}>
          <LogIn size={16} />
          {busy ? "Joining…" : "Join course"}
        </button>
      </form>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  );
}
export function CreateCourse() {
  const { refreshWorkspace, toast, navigate } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await flushChanges();
      const result = await api("/api/courses", {
        method: "POST",
        body: Object.fromEntries(form),
      });
      await refreshWorkspace();
      setOpen(false);
      toast("Your teaching space is ready.");
      if (result.course?.id)
        navigate("teacher-overview", { courseId: result.course.id });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="course-enrollment">
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Create course
        </button>
      </div>
      {open && (
        <Modal
          title="Create a teaching space"
          subtitle="Invite students with a course join code."
          onClose={() => !busy && setOpen(false)}
        >
          <form onSubmit={create}>
            <label className="auth-field">
              Course name
              <input name="name" required maxLength={120} />
            </label>
            <label className="auth-field">
              Course code
              <input
                name="code"
                required
                maxLength={30}
                placeholder="e.g. COMP2021"
              />
            </label>
            <label className="auth-field">
              Description
              <input name="description" maxLength={1000} />
            </label>
            {error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? "Creating…" : "Create course"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function JoinCode() {
  const { course, courseId, refreshWorkspace, toast } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function reset() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/courses/${courseId}/join-code/reset`, { method: "POST" });
      await refreshWorkspace();
      toast("Join code replaced. Share the new code with your students.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="course-enrollment">
      <span>
        Student join code: <strong>{course.joinCode || "Not available"}</strong>
      </span>
      <button
        className="btn btn-outline"
        disabled={!course.joinCode}
        onClick={() =>
          navigator.clipboard
            .writeText(course.joinCode)
            .then(() => toast("Join code copied."))
            .catch(() => setError("Select and copy the join code above."))
        }
      >
        <Copy size={14} />
        Copy
      </button>
      <button className="btn btn-outline" disabled={busy} onClick={reset}>
        <RefreshCw size={14} />
        {busy ? "Replacing…" : "Replace code"}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
