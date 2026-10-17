import { useState } from "react";
import { BookOpen, GraduationCap } from "lucide-react";
import { Modal } from "./ui";

export default function Settings({
  user,
  onSave,
  onClose,
  onLogout,
  googleEnabled,
  onConnectGoogle,
  connectingGoogle,
  googleError,
  authFeedback,
  settingsMessage,
}) {
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(user.role);
  const [studentId, setStudentId] = useState(user.studentId || "");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [edited, setEdited] = useState(false);
  const busy = saving || signingOut || connectingGoogle;
  const changed =
    name.trim() !== user.name ||
    role !== user.role ||
    (role === "student" && studentId.trim() !== (user.studentId || ""));
  function edit(setValue, value) {
    setValue(value);
    setEdited(true);
    setError("");
  }
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: name.trim(),
        role,
        studentId: role === "student" ? studentId.trim() : "",
      });
    } catch (failure) {
      setError(
        failure.message || "Your settings could not be saved. Try again.",
      );
      setSaving(false);
    }
  }
  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      await onLogout();
    } catch (failure) {
      setError(failure.message || "We could not sign you out. Try again.");
      setSigningOut(false);
    }
  }
  return (
    <Modal
      title="Settings"
      subtitle="Your profile and sign-in methods"
      onClose={onClose}
      closeDisabled={busy}
      className="settings-dialog"
    >
      <form className="settings-form" onSubmit={save} aria-busy={saving}>
        <label className="auth-field">
          Display name
          <input
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => edit(setName, event.target.value)}
            disabled={busy}
          />
        </label>
        <fieldset
          className="settings-roles"
          disabled={busy}
          aria-describedby="settings-role-hint"
        >
          <legend>Your role</legend>
          {["student", "teacher"].map((value) => (
            <label key={value} className={role === value ? "is-selected" : ""}>
              <input
                type="radio"
                name="settings-role"
                value={value}
                checked={role === value}
                onChange={() => edit(setRole, value)}
              />
              {value === "student" ? (
                <BookOpen size={18} aria-hidden="true" />
              ) : (
                <GraduationCap size={18} aria-hidden="true" />
              )}
              <span>{value === "student" ? "Student" : "Teacher"}</span>
            </label>
          ))}
        </fieldset>
        {role === "student" && (
          <label className="auth-field">
            Student number
            <input
              required
              maxLength={40}
              value={studentId}
              onChange={(event) => edit(setStudentId, event.target.value)}
              disabled={busy}
            />
          </label>
        )}
        <p className="settings-hint" id="settings-role-hint">
          Switch between learning and teaching anytime. Your courses and
          personal wiki stay with this account.
        </p>
        {role !== user.role && (
          <p className="settings-role-notice" role="status">
            Saving will open your {role === "teacher" ? "teaching" : "learning"}{" "}
            workspace. You can switch back here.
          </p>
        )}
        {settingsMessage && !edited && !error && (
          <div className="auth-success" role="status">
            {settingsMessage}
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        <div className="settings-actions">
          <button
            className="btn btn-outline"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !changed}
            type="submit"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <section className="settings-signin" aria-labelledby="settings-signin">
        <h3 id="settings-signin">Sign-in methods</h3>
        <p className="settings-hint">
          {user.authMethod === "google"
            ? "Signed in with Google"
            : "Signed in with MetaMask"}
        </p>
        <div className="account-methods">
          {user.googleLinked && (
            <div className="account-method">
              <strong>Google connected</strong>
              <span>{user.googleEmail || "Connected Google account"}</span>
            </div>
          )}
          {user.walletAddress && (
            <div className="account-method">
              <strong>Wallet</strong>
              <span>{user.walletAddress}</span>
            </div>
          )}
        </div>
        {authFeedback &&
          (authFeedback.error || authFeedback.linked) &&
          !googleError && (
            <div
              className={authFeedback.error ? "auth-error" : "auth-success"}
              role={authFeedback.error ? "alert" : "status"}
            >
              {authFeedback.message}
            </div>
          )}
        {googleError && (
          <div className="auth-error" role="alert">
            {googleError}
          </div>
        )}
        {googleEnabled && !user.googleLinked && (
          <>
            <p className="settings-hint">
              Connect Google to sign in to this same account without your
              wallet. Your courses and learning stay together.
            </p>
            <button
              className="btn auth-google"
              onClick={onConnectGoogle}
              disabled={busy}
              aria-busy={connectingGoogle}
            >
              <img
                className="google-mark"
                src="/google-g.png"
                width="20"
                height="20"
                alt=""
                aria-hidden="true"
              />
              {connectingGoogle ? "Opening Google…" : "Connect Google"}
            </button>
          </>
        )}
        <button
          className="btn btn-outline settings-signout"
          onClick={signOut}
          disabled={busy}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </section>
    </Modal>
  );
}
