import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Layers3,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import App from "../App";
import { api } from "../lib/api";
import "./auth.css";

export default function Auth() {
  const [user, setUser] = useState(null),
    [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [studentId, setStudentId] = useState(""),
    [role, setRole] = useState("student");
  const provider = useRef(null);
  const refresh = async () => {
    const result = await api("/api/workspace");
    setWorkspace(result.data || result);
  };
  useEffect(() => {
    api("/api/auth/me")
      .then(async ({ user: next }) => {
        setUser(next);
        if (next?.profileComplete) await refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const onProvider = (event) => {
      if (event.detail.info.rdns === "io.metamask")
        provider.current = event.detail.provider;
    };
    window.addEventListener("eip6963:announceProvider", onProvider);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    provider.current ||=
      window.ethereum?.providers?.find((p) => p.isMetaMask) || window.ethereum;
    const changed = () => {
      setWorkspace(null);
      setUser(null);
      api("/api/auth/logout", { method: "POST" }).catch(() => {});
    };
    const wallet = provider.current;
    wallet?.on?.("accountsChanged", changed);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onProvider);
      wallet?.removeListener?.("accountsChanged", changed);
    };
  }, []);
  async function login() {
    setBusy(true);
    setError("");
    try {
      const wallet = provider.current || window.ethereum;
      if (!wallet)
        throw new Error(
          "Install MetaMask, then open this page in the same browser.",
        );
      const [address] = await wallet.request({ method: "eth_requestAccounts" }),
        chain = await wallet.request({ method: "eth_chainId" });
      const { message } = await api("/api/auth/challenge", {
        method: "POST",
        body: { address, chainId: parseInt(chain, 16) },
      });
      const hex =
        "0x" +
        Array.from(new TextEncoder().encode(message), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
      const signature = await wallet.request({
        method: "personal_sign",
        params: [hex, address],
      });
      const result = await api("/api/auth/verify", {
        method: "POST",
        body: { message, signature },
      });
      setUser(result.user);
      if (result.user.profileComplete) await refresh();
    } catch (e) {
      setError(
        e.code === 4001
          ? "Signature cancelled. You can connect again when ready."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function profile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/auth/profile", {
        method: "POST",
        body: { name, studentId: role === "student" ? studentId : "", role },
      });
      setUser(result.user);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setWorkspace(null);
    setUser(null);
    location.hash = "#/courses";
  }
  if (loading)
    return (
      <div className="auth-loading" role="status">
        <Layers3 size={28} />
        <p>Opening your learning space…</p>
      </div>
    );
  if (user?.profileComplete && workspace)
    return (
      <App authenticatedUser={user} initialData={workspace} onLogout={logout} />
    );
  return (
    <main className="auth-page">
      <header className="auth-brand">
        <Layers3 size={28} />
        <strong>
          folio<span>.</span>
        </strong>
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">A CLEARER WAY TO LEARN</span>
          <h1>
            Make room
            <br />
            for your next
            <br />
            <em>understanding.</em>
          </h1>
          <p>
            Read your course materials. Ask better questions. Build a personal
            collection of what you learn.
          </p>
          <div className="auth-promises">
            <span>
              <BookOpen size={19} /> Your courses, together
            </span>
            <span>
              <ShieldCheck size={19} /> Your private learning space
            </span>
          </div>
        </section>
        <section className="auth-card">
          <span className="auth-icon">
            {user ? <GraduationCap size={27} /> : <Wallet size={27} />}
          </span>
          <h2>
            {user?.profileComplete
              ? "Your space is almost here."
              : user
                ? "Make this space yours."
                : "Welcome to Folio."}
          </h2>
          <p>
            {user?.profileComplete
              ? "Your account is ready. Reconnect to load your saved workspace."
              : user
                ? "Choose how you will use Folio and complete your profile."
                : "Sign in with MetaMask to continue learning or create your teaching space."}
          </p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          {user?.profileComplete ? (
            <>
              <button
                className="btn btn-primary auth-submit"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Opening…" : "Try again"}
                <ArrowRight size={18} />
              </button>
              <button className="btn btn-outline auth-submit" onClick={logout}>
                Sign out
              </button>
            </>
          ) : user ? (
            <form onSubmit={profile}>
              <fieldset className="auth-roles">
                <legend>I’m joining as a</legend>
                {["student", "teacher"].map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                    />
                    {value === "student" ? "Student" : "Teacher"}
                  </label>
                ))}
              </fieldset>
              <label className="auth-field">
                Display name
                <input
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {role === "student" && (
                <label className="auth-field">
                  Student number
                  <input
                    required
                    maxLength={40}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </label>
              )}
              <p className="auth-hint">
                Your role is saved when you complete this step. Teachers manage
                the courses they create.
              </p>
              <button className="btn btn-primary auth-submit" disabled={busy}>
                {busy ? "Saving…" : "Open my workspace"}
                <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <>
              <button
                className="btn btn-primary auth-submit"
                onClick={login}
                disabled={busy}
              >
                <Wallet size={19} />
                {busy ? "Check MetaMask…" : "Continue with MetaMask"}
                <ArrowRight size={18} />
              </button>
              <p className="auth-hint">
                A login signature confirms your wallet. It does not send a
                transaction or charge gas.
              </p>
            </>
          )}
          <div className="auth-card-footer">
            Software Engineering · Group Project
          </div>
        </section>
      </div>
      <footer className="auth-footer">
        Learn with curiosity. Keep what matters.
      </footer>
    </main>
  );
}
