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

const googleErrors = {
  google_unavailable:
    "Google sign-in is unavailable right now. Try MetaMask or come back later.",
  google_invalid_state:
    "This Google sign-in request has expired. Please start again.",
  google_cancelled:
    "Google sign-in was cancelled. You can try again when ready.",
  google_failed: "We could not verify your Google account. Please try again.",
  google_link_session_expired:
    "Your Folio session expired. Sign in again before connecting Google.",
  google_account_conflict:
    "This Google account is already connected to another Folio account. Use that account to sign in, or connect a different Google account.",
};

function callbackFeedback() {
  const url = new URL(window.location.href);
  const errorCode = url.searchParams.get("auth_error");
  const result = url.searchParams.get("auth");
  const feedback = errorCode
    ? {
        error: true,
        message: Object.hasOwn(googleErrors, errorCode)
          ? googleErrors[errorCode]
          : googleErrors.google_failed,
      }
    : result === "linked"
      ? {
          linked: true,
          message:
            "Google is connected. You can now use it to sign in to this account.",
        }
      : result === "success"
        ? { message: "You're signed in with Google." }
        : null;
  return feedback;
}

function GoogleMark() {
  return (
    <img
      className="google-mark"
      src="/google-g.png"
      width="20"
      height="20"
      alt=""
      aria-hidden="true"
    />
  );
}

export default function Auth() {
  const [feedback] = useState(callbackFeedback);
  const [user, setUser] = useState(null),
    [workspace, setWorkspace] = useState(null);
  const [providers, setProviders] = useState({ google: false, wallet: true });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [busyProvider, setBusyProvider] = useState(null);
  const [name, setName] = useState(""),
    [studentId, setStudentId] = useState(""),
    [role, setRole] = useState("student");
  const provider = useRef(null);
  const userRef = useRef(user);
  userRef.current = user;
  const acceptUser = (next) => {
    userRef.current = next;
    setUser(next);
    if (next && !next.profileComplete) {
      setName(next.name || "");
      setStudentId(next.studentId || "");
      setRole("student");
    }
  };
  const refresh = async () => {
    const result = await api("/api/workspace");
    setWorkspace(result.data || result);
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth") || url.searchParams.has("auth_error")) {
      url.searchParams.delete("auth");
      url.searchParams.delete("auth_error");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    Promise.all([
      api("/api/auth/me"),
      api("/api/auth/providers").catch(() => ({ google: false, wallet: true })),
    ])
      .then(async ([{ user: next }, available]) => {
        setProviders(available);
        acceptUser(next);
        if (next?.profileComplete) await refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    let wallet;
    const changed = (accounts) => {
      const current = userRef.current;
      if (!current || current.authMethod !== "wallet") return;
      if (
        Array.isArray(accounts) &&
        accounts.some(
          (address) =>
            address.toLowerCase() === current.walletAddress?.toLowerCase(),
        )
      )
        return;
      userRef.current = null;
      setWorkspace(null);
      setUser(null);
      api("/api/auth/logout", { method: "POST" }).catch(() => {});
    };
    const observe = (next) => {
      if (next === wallet) return;
      wallet?.removeListener?.("accountsChanged", changed);
      wallet = next;
      provider.current = next;
      wallet?.on?.("accountsChanged", changed);
    };
    const onProvider = (event) => {
      if (event.detail?.info?.rdns === "io.metamask")
        observe(event.detail.provider);
    };
    window.addEventListener("eip6963:announceProvider", onProvider);
    observe(
      window.ethereum?.providers?.find((p) => p.isMetaMask) || window.ethereum,
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      window.removeEventListener("eip6963:announceProvider", onProvider);
      wallet?.removeListener?.("accountsChanged", changed);
    };
  }, []);
  async function login() {
    setBusy(true);
    setBusyProvider("wallet");
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
      acceptUser(result.user);
      if (result.user.profileComplete) await refresh();
    } catch (e) {
      setError(
        e.code === 4001
          ? "Signature cancelled. You can connect again when ready."
          : e.message,
      );
    } finally {
      setBusy(false);
      setBusyProvider(null);
    }
  }
  async function google(mode = "login") {
    setBusy(true);
    setBusyProvider("google");
    setError("");
    try {
      const { url } = await api("/api/auth/google/start", {
        method: "POST",
        body: { mode },
      });
      window.location.assign(url);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setBusyProvider(null);
      throw e;
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
      acceptUser(result.user);
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
    acceptUser(null);
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
      <App
        authenticatedUser={user}
        initialData={workspace}
        onLogout={logout}
        googleEnabled={providers.google}
        onConnectGoogle={() => google("link")}
        authFeedback={feedback}
      />
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
            for your next <br />
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
        <section className="auth-card" aria-busy={busy}>
          <span className="auth-icon">
            {user ? <GraduationCap size={27} /> : <BookOpen size={27} />}
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
                : providers.google
                  ? "Continue with your Google account to learn or create your teaching space. You can also use a wallet."
                  : "Connect MetaMask to continue learning or create your teaching space."}
          </p>
          {feedback && !error && (
            <div
              className={feedback.error ? "auth-error" : "auth-success"}
              role={feedback.error ? "alert" : "status"}
            >
              {feedback.message}
            </div>
          )}
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
              <button
                className="btn btn-outline auth-submit"
                type="button"
                onClick={logout}
                disabled={busy}
              >
                Use a different account
              </button>
            </form>
          ) : (
            <>
              {providers.google && (
                <>
                  <button
                    className="btn auth-google auth-submit"
                    onClick={() => google().catch(() => {})}
                    disabled={busy}
                  >
                    <GoogleMark />
                    {busyProvider === "google"
                      ? "Opening Google…"
                      : "Continue with Google"}
                  </button>
                  <p className="auth-hint">
                    No wallet needed. Choose Student or Teacher after your first
                    sign-in.
                  </p>
                  <div className="auth-divider">
                    <span>or use a wallet</span>
                  </div>
                </>
              )}
              <button
                className={`btn ${providers.google ? "btn-outline auth-wallet" : "btn-primary"} auth-submit`}
                onClick={login}
                disabled={busy}
              >
                <Wallet size={19} />
                {busyProvider === "wallet"
                  ? "Check MetaMask…"
                  : "Continue with MetaMask"}
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
