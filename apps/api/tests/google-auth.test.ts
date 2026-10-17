import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "../src/server.js";
import { openDatabase } from "../src/core/db.js";
import { hash, requestUser } from "../src/core/auth.js";
import type {
  GoogleIdentity,
  GoogleOidcProvider,
} from "../src/core/google-oidc.js";

const origin = "https://folio.example";
const account = privateKeyToAccount(`0x${"55".repeat(32)}`);
const cookie = (response: any, name: string) => {
  const values = response.headers["set-cookie"];
  return (
    (Array.isArray(values) ? values : [values])
      .filter(Boolean)
      .map((value: string) => value.split(";")[0])
      .find((value: string) => value.startsWith(`${name}=`)) || ""
  );
};
const redirectValue = (response: any, name: string) => {
  assert.equal(response.statusCode, 303, response.body);
  const url = new URL(response.headers.location);
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, "/");
  return url.searchParams.get(name);
};
function fakeProvider() {
  const fake = {
    identity: {
      subject: "google-subject-a",
      email: "student@example.com",
      emailVerified: true,
      name: "Google Student",
    } as GoogleIdentity,
    authorizationCalls: [] as any[],
    exchangeCalls: [] as any[],
    exchangeHook: undefined as undefined | (() => Promise<void>),
    fail: false,
    authorizationFail: false,
    provider: null as unknown as GoogleOidcProvider,
  };
  fake.provider = {
    async authorizationUrl(input) {
      fake.authorizationCalls.push(input);
      if (fake.authorizationFail) throw new Error("synthetic-sensitive-secret");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("state", input.state);
      return url.href;
    },
    async exchange(input) {
      fake.exchangeCalls.push(input);
      await fake.exchangeHook?.();
      if (fake.fail) throw new Error("synthetic-sensitive-token-body");
      return { ...fake.identity };
    },
  };
  return fake;
}
async function fixture(t: any, enabled = true) {
  const dir = mkdtempSync(join(tmpdir(), "folio-google-"));
  const fake = fakeProvider();
  let timestamp = Date.now();
  const app = await buildApp({
    dataDir: dir,
    publicUrl: origin,
    secureCookies: true,
    seed: false,
    registerAi: false,
    now: () => timestamp,
    googleProvider: enabled ? fake.provider : null,
  });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const begin = async (mode: "login" | "link" = "login", session = "") => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/google/start",
      headers: { origin, cookie: session },
      payload: { mode },
    });
    assert.equal(response.statusCode, 200, response.body);
    const url = new URL(response.json().url);
    return {
      response,
      state: url.searchParams.get("state")!,
      browser: cookie(response, "folio_google"),
    };
  };
  const callback = (
    flow: { state: string; browser: string },
    session = "",
    query = "code=synthetic-code",
  ) =>
    app.inject({
      url: `/api/auth/google/callback?state=${encodeURIComponent(flow.state)}&${query}`,
      headers: { cookie: [flow.browser, session].filter(Boolean).join("; ") },
    });
  const wallet = async () => {
    const challenge = await app.inject({
      method: "POST",
      url: "/api/auth/challenge",
      headers: { origin },
      payload: { address: account.address, chainId: 1 },
    });
    const message = challenge.json().message;
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
      headers: { origin, cookie: cookie(challenge, "folio_login") },
      payload: { message, signature: await account.signMessage({ message }) },
    });
    assert.equal(response.statusCode, 200, response.body);
    return {
      user: response.json().user,
      session: cookie(response, "folio_session"),
    };
  };
  const me = async (session: string) =>
    (
      await app.inject({ url: "/api/auth/me", headers: { cookie: session } })
    ).json().user;
  return {
    app,
    fake,
    begin,
    callback,
    wallet,
    me,
    advance: (ms: number) => (timestamp += ms),
  };
}

test("Google providers are optional; start requires same origin and links require an existing session", async (t) => {
  const { app } = await fixture(t, false);
  assert.deepEqual((await app.inject({ url: "/api/auth/providers" })).json(), {
    google: false,
    wallet: true,
  });
  const disabled = await app.inject({
    method: "POST",
    url: "/api/auth/google/start",
    headers: { origin },
    payload: {},
  });
  assert.equal(disabled.statusCode, 503);
  assert.equal(
    redirectValue(
      await app.inject({ url: "/api/auth/google/callback?code=secret" }),
      "auth_error",
    ),
    "google_unavailable",
  );
  const enabled = await fixture(t);
  assert.equal(
    (
      await enabled.app.inject({
        method: "POST",
        url: "/api/auth/google/start",
        headers: { origin: "https://attacker.example" },
        payload: {},
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await enabled.app.inject({
        method: "POST",
        url: "/api/auth/google/start",
        headers: { origin },
        payload: { mode: "link" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await enabled.app.inject({
        method: "POST",
        url: "/api/auth/google/start",
        headers: { origin },
        payload: { returnTo: "https://attacker.example" },
      })
    ).statusCode,
    400,
  );
  enabled.fake.authorizationFail = true;
  const failed = await enabled.app.inject({
    method: "POST",
    url: "/api/auth/google/start",
    headers: { origin },
    payload: {},
  });
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.includes("sensitive"), false);
});

test("Google creates a wallet-free student account, keeps its identity across email changes and uses common secure sessions", async (t) => {
  const f = await fixture(t);
  const flow = await f.begin();
  const authorization = f.fake.authorizationCalls[0];
  assert.equal(authorization.redirectUri, `${origin}/api/auth/google/callback`);
  assert.ok(
    authorization.nonce.length >= 43 && authorization.codeVerifier.length >= 43,
  );
  const completed = await f.callback(flow);
  assert.equal(redirectValue(completed, "auth"), "success");
  assert.match(String(completed.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(completed.headers["set-cookie"]), /Secure/);
  assert.match(String(completed.headers["set-cookie"]), /SameSite=Lax/);
  const session = cookie(completed, "folio_session");
  const user = await f.me(session);
  assert.equal(user.walletAddress, null);
  assert.equal(user.googleLinked, true);
  assert.equal(user.googleEmail, "student@example.com");
  assert.equal(user.authMethod, "google");
  assert.equal(user.profileComplete, false);
  const badProfile = await f.app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: { name: "Student", role: "student", studentId: "" },
  });
  assert.equal(badProfile.statusCode, 400);
  const profile = await f.app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: { name: "Student", role: "student", studentId: "26001234" },
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().user.authMethod, "google");
  assert.equal(
    (
      await f.app.inject({
        method: "POST",
        url: "/api/auth/profile",
        headers: { origin, cookie: session },
        payload: { name: "Teacher", role: "teacher", studentId: "" },
      })
    ).statusCode,
    409,
  );
  f.fake.identity.email = "renamed@example.com";
  const returning = await f.callback(await f.begin(), session);
  const returningUser = await f.me(cookie(returning, "folio_session"));
  assert.equal(returningUser.id, user.id);
  assert.equal(returningUser.name, "Student");
  assert.equal(returningUser.googleEmail, "renamed@example.com");
  assert.equal(await f.me(session), null);
  assert.equal(f.fake.exchangeCalls[0].nonce, authorization.nonce);
  assert.equal(
    f.fake.exchangeCalls[0].codeVerifier,
    authorization.codeVerifier,
  );
  assert.equal(f.fake.exchangeCalls[0].state, flow.state);
});

test("Google first-login teachers self-select their role without requiring a wallet", async (t) => {
  const f = await fixture(t);
  const completed = await f.callback(await f.begin());
  const session = cookie(completed, "folio_session");
  const profile = await f.app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: { name: "Teacher", role: "teacher", studentId: "" },
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().user.role, "teacher");
  const room = await f.app.inject({
    method: "POST",
    url: "/api/courses",
    headers: { origin, cookie: session },
    payload: { name: "Google teacher course", code: "COMP1", description: "" },
  });
  assert.equal(room.statusCode, 200, room.body);
});

test("Course peers cannot read Google emails, linked identities or sign-in methods", async (t) => {
  const f = await fixture(t);
  const teacherLogin = await f.callback(await f.begin());
  const teacherSession = cookie(teacherLogin, "folio_session");
  await f.app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: teacherSession },
    payload: { name: "Teacher", studentId: "", role: "teacher" },
  });
  const room = await f.app.inject({
    method: "POST",
    url: "/api/courses",
    headers: { origin, cookie: teacherSession },
    payload: { name: "Course privacy", code: "COMP2", description: "" },
  });
  assert.equal(room.statusCode, 200, room.body);
  f.fake.identity = {
    subject: "peer-student-google-sub",
    email: "private-student-email@example.com",
    emailVerified: true,
    name: "Student",
  };
  const studentLogin = await f.callback(await f.begin());
  const studentSession = cookie(studentLogin, "folio_session");
  await f.app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: studentSession },
    payload: { name: "Student", studentId: "26007890", role: "student" },
  });
  const joined = await f.app.inject({
    method: "POST",
    url: "/api/courses/join",
    headers: { origin, cookie: studentSession },
    payload: { code: room.json().course.joinCode },
  });
  assert.equal(joined.statusCode, 200, joined.body);
  for (const session of [teacherSession, studentSession]) {
    const workspace = await f.app.inject({
      url: "/api/workspace",
      headers: { cookie: session },
    });
    assert.equal(workspace.statusCode, 200);
    assert.equal(workspace.body.includes("@example.com"), false);
    for (const person of [
      ...workspace.json().students,
      ...workspace.json().teachers,
    ]) {
      assert.equal(person.googleEmail, undefined);
      assert.equal(person.googleLinked, undefined);
      assert.equal(person.authMethod, undefined);
      assert.equal(person.walletAddress, undefined);
    }
  }
});

test("OAuth state is browser-bound, expires after ten minutes and is consumed on cancellation", async (t) => {
  const f = await fixture(t);
  const flow = await f.begin();
  assert.equal(
    redirectValue(
      await f.callback({ ...flow, browser: "folio_google=wrong-browser" }),
      "auth_error",
    ),
    "google_invalid_state",
  );
  assert.equal(
    redirectValue(await f.callback({ ...flow, browser: "" }), "auth_error"),
    "google_invalid_state",
  );
  assert.equal(f.fake.exchangeCalls.length, 0);
  assert.equal(
    redirectValue(
      await f.callback(
        flow,
        "",
        "error=access_denied&error_description=sensitive",
      ),
      "auth_error",
    ),
    "google_cancelled",
  );
  assert.equal(
    redirectValue(await f.callback(flow), "auth_error"),
    "google_invalid_state",
  );
  const expired = await f.begin();
  f.advance(600_000);
  assert.equal(
    redirectValue(await f.callback(expired), "auth_error"),
    "google_invalid_state",
  );
  assert.equal(f.fake.exchangeCalls.length, 0);
});

test("OAuth consumes state before token exchange, preventing simultaneous callbacks and retry after provider failure", async (t) => {
  const f = await fixture(t);
  const flow = await f.begin();
  let release!: () => void;
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  f.fake.exchangeHook = () => {
    reached();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const first = f.callback(flow);
  await started;
  assert.equal(
    redirectValue(await f.callback(flow), "auth_error"),
    "google_invalid_state",
  );
  release();
  assert.equal(redirectValue(await first, "auth"), "success");
  assert.equal(f.fake.exchangeCalls.length, 1);
  f.fake.exchangeHook = undefined;
  f.fake.fail = true;
  const failedFlow = await f.begin();
  const failed = await f.callback(failedFlow);
  assert.equal(redirectValue(failed, "auth_error"), "google_failed");
  assert.equal(failed.body.includes("sensitive"), false);
  assert.equal(
    redirectValue(await f.callback(failedFlow), "auth_error"),
    "google_invalid_state",
  );
});

test("Google never merges by email, and rejects unverified identities", async (t) => {
  const f = await fixture(t);
  const first = await f.callback(await f.begin());
  const a = await f.me(cookie(first, "folio_session"));
  f.fake.identity.subject = "same-email-distinct-google-sub";
  const second = await f.callback(await f.begin());
  const b = await f.me(cookie(second, "folio_session"));
  assert.notEqual(a.id, b.id);
  assert.equal(a.googleEmail, b.googleEmail);
  f.fake.identity.subject = "unverified-sub";
  f.fake.identity.emailVerified = false;
  assert.equal(
    redirectValue(await f.callback(await f.begin()), "auth_error"),
    "google_failed",
  );
  assert.equal(
    (f.app.folio.db.prepare("SELECT count(*) AS n FROM users").get() as any).n,
    2,
  );
});

test("Another browser starting Google sign-in does not revoke an in-flight callback", async (t) => {
  const f = await fixture(t);
  const firstBrowser = await f.begin();
  let release!: () => void;
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  f.fake.exchangeHook = () => {
    reached();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const completion = f.callback(firstBrowser);
  await started;
  const secondBrowser = await f.begin();
  assert.notEqual(secondBrowser.browser, firstBrowser.browser);
  release();
  const completed = await completion;
  assert.equal(redirectValue(completed, "auth"), "success");
  assert.equal(
    (await f.me(cookie(completed, "folio_session"))).googleLinked,
    true,
  );
});

test("Explicit Google linking preserves wallet user IDs and private records, and future Google login reaches that account", async (t) => {
  const f = await fixture(t);
  const wallet = await f.wallet();
  f.app.folio.put("notes", {
    id: "private-wiki",
    studentId: wallet.user.id,
    content: "Private note remains attached",
  });
  const linked = await f.callback(
    await f.begin("link", wallet.session),
    wallet.session,
  );
  assert.equal(redirectValue(linked, "auth"), "linked");
  const session = cookie(linked, "folio_session");
  const user = await f.me(session);
  assert.equal(user.id, wallet.user.id);
  assert.equal(user.walletAddress, account.address);
  assert.equal(user.authMethod, "google");
  assert.equal(user.googleLinked, true);
  const profile = await f.app.inject({
    method: "POST",
    url: "/api/auth/profile",
    headers: { origin, cookie: session },
    payload: { name: "Linked Student", studentId: "26004567", role: "student" },
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().user.authMethod, "google");
  assert.equal(await f.me(wallet.session), null);
  assert.equal(
    f.app.folio.get("notes", "private-wiki")!.studentId,
    wallet.user.id,
  );
  const future = await f.callback(await f.begin());
  assert.equal(
    (await f.me(cookie(future, "folio_session"))).id,
    wallet.user.id,
  );
  const walletAgain = await f.wallet();
  assert.equal(walletAgain.user.id, wallet.user.id);
  assert.equal(walletAgain.user.googleLinked, true);
  assert.equal(walletAgain.user.authMethod, "wallet");
});

test("Linking rejects an identity owned by another account and does not replace either account", async (t) => {
  const f = await fixture(t);
  const google = await f.callback(await f.begin());
  const googleUser = await f.me(cookie(google, "folio_session"));
  const wallet = await f.wallet();
  const conflict = await f.callback(
    await f.begin("link", wallet.session),
    wallet.session,
  );
  assert.equal(
    redirectValue(conflict, "auth_error"),
    "google_account_conflict",
  );
  assert.equal((await f.me(wallet.session)).googleLinked, false);
  assert.equal(
    (
      f.app.folio.db
        .prepare("SELECT id FROM users WHERE google_sub=?")
        .get(f.fake.identity.subject) as any
    ).id,
    googleUser.id,
  );
  f.fake.identity.subject = "wallet-linked-sub";
  const linked = await f.callback(
    await f.begin("link", wallet.session),
    wallet.session,
  );
  const linkedSession = cookie(linked, "folio_session");
  f.fake.identity.subject = "replacement-sub";
  const replacement = await f.callback(
    await f.begin("link", linkedSession),
    linkedSession,
  );
  assert.equal(
    redirectValue(replacement, "auth_error"),
    "google_account_conflict",
  );
  assert.equal(
    (
      f.app.folio.db
        .prepare("SELECT google_sub FROM users WHERE id=?")
        .get(wallet.user.id) as any
    ).google_sub,
    "wallet-linked-sub",
  );
});

test("Linking binds the original browser session and rechecks logout during token exchange", async (t) => {
  const f = await fixture(t);
  const wallet = await f.wallet();
  const flow = await f.begin("link", wallet.session);
  assert.equal(
    redirectValue(await f.callback(flow), "auth_error"),
    "google_link_session_expired",
  );
  const second = await f.begin("link", wallet.session);
  let release!: () => void;
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  f.fake.exchangeHook = () => {
    reached();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const completion = f.callback(second, wallet.session);
  await started;
  await f.app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { origin, cookie: `${wallet.session}; ${second.browser}` },
  });
  release();
  assert.equal(
    redirectValue(await completion, "auth_error"),
    "google_link_session_expired",
  );
  assert.equal(
    (
      f.app.folio.db
        .prepare("SELECT google_sub FROM users WHERE id=?")
        .get(wallet.user.id) as any
    ).google_sub,
    null,
  );
});

test("Logout clears OAuth cookies and revokes pending login challenges even without an account", async (t) => {
  const f = await fixture(t);
  const flow = await f.begin();
  const logout = await f.app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { origin, cookie: flow.browser },
  });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers["set-cookie"]), /folio_google=;/);
  assert.equal(
    redirectValue(await f.callback(flow), "auth_error"),
    "google_invalid_state",
  );
});

test("Google session methods are stored separately and deleted with the session on logout", async (t) => {
  const f = await fixture(t);
  const login = await f.callback(await f.begin());
  const session = cookie(login, "folio_session");
  assert.equal((await f.me(session)).authMethod, "google");
  assert.equal(
    (
      f.app.folio.db
        .prepare("SELECT method FROM auth_session_methods")
        .get() as any
    ).method,
    "google",
  );
  const logout = await f.app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { origin, cookie: session },
  });
  assert.equal(logout.statusCode, 200);
  assert.equal(
    (
      f.app.folio.db
        .prepare("SELECT count(*) AS n FROM auth_session_methods")
        .get() as any
    ).n,
    0,
  );
  assert.equal(await f.me(session), null);
});

test("Logout while a login token exchange is pending prevents a later session from being issued", async (t) => {
  const f = await fixture(t);
  const flow = await f.begin();
  let release!: () => void;
  let reached!: () => void;
  const started = new Promise<void>((resolve) => {
    reached = resolve;
  });
  f.fake.exchangeHook = () => {
    reached();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  };
  const completion = f.callback(flow);
  await started;
  await f.app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { origin, cookie: flow.browser },
  });
  release();
  assert.equal(
    redirectValue(await completion, "auth_error"),
    "google_invalid_state",
  );
  assert.equal(
    (f.app.folio.db.prepare("SELECT count(*) AS n FROM users").get() as any).n,
    0,
  );
  assert.equal(
    (
      f.app.folio.db
        .prepare("SELECT count(*) AS n FROM auth_sessions")
        .get() as any
    ).n,
    0,
  );
});

function legacyDatabase(t: any, corrupt = false) {
  const dir = mkdtempSync(join(tmpdir(), "folio-google-migrate-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = new Database(join(dir, "folio.sqlite"));
  db.pragma("foreign_keys = OFF");
  db.exec(
    "CREATE TABLE __folio_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,applied_at TEXT NOT NULL)",
  );
  for (const name of [
    "0000_init.sql",
    "0001_ai_jobs.sql",
    "0002_ai_usage.sql",
    "0003_file_jobs.sql",
  ]) {
    const sql = readFileSync(
      new URL(`../drizzle/${name}`, import.meta.url),
      "utf8",
    );
    db.exec(sql);
    db.prepare("INSERT INTO __folio_migrations VALUES(?,?,?)").run(
      name,
      createHash("sha256").update(sql).digest("hex"),
      new Date().toISOString(),
    );
  }
  db.prepare(
    "INSERT INTO users(id,wallet_address,name,role,profile_complete,created_at) VALUES(?,?,?,?,?,?)",
  ).run(
    "old-user",
    account.address,
    "Existing User",
    "student",
    1,
    "2026-10-01",
  );
  db.prepare("INSERT INTO auth_sessions VALUES(?,?,?,?)").run(
    hash("existing-session"),
    "old-user",
    Date.now() + 86400_000,
    Date.now(),
  );
  db.prepare("INSERT INTO originals VALUES(?,?,?,?,?,?)").run(
    "old-file",
    "old-user",
    "old-course",
    "/data/original",
    "{}",
    1,
  );
  db.prepare(
    "INSERT INTO file_jobs(id,material_id,user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  ).run("old-file-job", "old-file", "old-user", "queued", 1, 1);
  db.prepare("INSERT INTO records VALUES(?,?,?)").run(
    "notes",
    "old-private-note",
    JSON.stringify({
      id: "old-private-note",
      studentId: "old-user",
      content: "Existing private content",
    }),
  );
  if (corrupt)
    db.prepare("INSERT INTO auth_sessions VALUES(?,?,?,?)").run(
      "orphan",
      "missing-user",
      Date.now() + 86400_000,
      Date.now(),
    );
  db.close();
  return dir;
}

test("Google migration preserves every legacy user ID, session, original, job and private record with foreign keys enforced", (t) => {
  const dir = legacyDatabase(t);
  const { db } = openDatabase(dir);
  t.after(() => db.close());
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(
    (
      db
        .prepare(
          "SELECT COALESCE(m.method,'wallet') AS auth_method FROM auth_sessions s LEFT JOIN auth_session_methods m ON m.token_hash=s.token_hash WHERE s.user_id='old-user'",
        )
        .get() as any
    ).auth_method,
    "wallet",
  );
  // The deployment script retains migrations when restoring the previous
  // image. That image used a four-value INSERT without naming columns.
  assert.equal((db.pragma("table_info(auth_sessions)") as any[]).length, 4);
  db.prepare("INSERT INTO auth_sessions VALUES(?,?,?,?)").run(
    hash("rollback-wallet-session"),
    "old-user",
    Date.now() + 86400_000,
    Date.now(),
  );
  const legacyUser = requestUser(
    { folio: { db, now: Date.now } } as any,
    { cookies: { folio_session: "rollback-wallet-session" } } as any,
  );
  assert.equal(legacyUser?.id, "old-user");
  assert.equal(legacyUser?.authMethod, "wallet");
  assert.equal(
    (db.prepare("SELECT count(*) AS n FROM originals").get() as any).n,
    1,
  );
  assert.equal(
    (db.prepare("SELECT count(*) AS n FROM file_jobs").get() as any).n,
    1,
  );
  assert.equal(
    JSON.parse(
      (
        db
          .prepare("SELECT json FROM records WHERE id='old-private-note'")
          .get() as any
      ).json,
    ).studentId,
    "old-user",
  );
  db.prepare(
    "INSERT INTO users(id,google_sub,google_email,created_at) VALUES(?,?,?,?)",
  ).run("new-google", "stable-sub", "first@example.com", "2026-10-17");
  assert.throws(
    () =>
      db
        .prepare("INSERT INTO users(id,google_sub,created_at) VALUES(?,?,?)")
        .run("duplicate-google", "stable-sub", "2026-10-17"),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO users(id,wallet_address,created_at) VALUES(?,?,?)",
        )
        .run("duplicate-wallet", account.address.toLowerCase(), "2026-10-17"),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      db
        .prepare("INSERT INTO users(id,created_at) VALUES(?,?)")
        .run("no-identity", "2026-10-17"),
    /CHECK/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
        )
        .run("orphan", "missing-user", 1, 1),
    /FOREIGN KEY/,
  );
});

test("Google table rebuild rolls back completely when a legacy foreign-key violation is found", (t) => {
  const dir = legacyDatabase(t, true);
  assert.throws(() => openDatabase(dir), /Foreign key validation failed/);
  const db = new Database(join(dir, "folio.sqlite"));
  t.after(() => db.close());
  const columns = db.pragma("table_info(users)") as any[];
  assert.equal(
    columns.find((column) => column.name === "wallet_address").notnull,
    1,
  );
  assert.equal(
    columns.some((column) => column.name === "google_sub"),
    false,
  );
  assert.equal(
    (db.prepare("SELECT count(*) AS n FROM auth_sessions").get() as any).n,
    2,
  );
  assert.equal(
    (db.prepare("SELECT count(*) AS n FROM __folio_migrations").get() as any).n,
    4,
  );
});
