import { chromium } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// This fixture implements only the provider boundary. The application still
// exercises its real state cookies, callback, sessions, migrations, and UI.
// No Google, model, Langfuse, or production database credentials are used.
async function fixtureServer() {
  const { buildApp } = await import("./apps/api/src/server.ts");
  const { randomUUID } = await import("node:crypto");
  const origin = "http://127.0.0.1:5173";
  const accounts = {
    student: {
      subject: "100000000001",
      email: "student@example.invalid",
      emailVerified: true,
      name: "Google Student",
    },
    teacher: {
      subject: "100000000002",
      email: "teacher@example.invalid",
      emailVerified: true,
      name: "Google Teacher",
    },
    wallet: {
      subject: "100000000003",
      email: "wallet@example.invalid",
      emailVerified: true,
      name: "Google Wallet Owner",
    },
  };
  const transactions = new Map();
  const codes = new Map();
  const googleProvider = {
    authorizationUrl(input) {
      transactions.set(input.state, input);
      return `${origin}/api/test/google/authorize?state=${encodeURIComponent(input.state)}`;
    },
    async exchange(input) {
      const callback = new URL(input.callbackUrl);
      const original = transactions.get(input.state);
      const code = codes.get(callback.searchParams.get("code"));
      if (
        !original ||
        !code ||
        code.state !== input.state ||
        callback.searchParams.get("state") !== input.state ||
        original.nonce !== input.nonce ||
        original.codeVerifier !== input.codeVerifier ||
        original.redirectUri !== input.redirectUri
      )
        throw new Error("Synthetic provider exchange rejected");
      transactions.delete(input.state);
      codes.delete(callback.searchParams.get("code"));
      return accounts[code.account];
    },
  };
  const app = await buildApp({
    dataDir: process.env.DATA_DIR,
    publicUrl: origin,
    secureCookies: false,
    originSecret: "",
    registerAi: false,
    seed: false,
    googleProvider,
  });
  app.get("/api/test/google/ready", async () => ({
    fixture: "google-browser-fixture",
  }));
  app.get("/api/test/google/authorize", async (request, reply) => {
    const state = request.query.state;
    if (!transactions.has(state)) return reply.code(400).send("Unknown state");
    return reply
      .type("text/html")
      .send(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixture Google sign-in</title></head><body>' +
          "<h1>Fixture Google sign-in</h1><p>Local synthetic accounts only.</p>" +
          '<form action="/api/test/google/complete" method="get">' +
          '<input type="hidden" name="state" value="' +
          state +
          '">' +
          '<button name="account" value="student">Use Google Student</button> ' +
          '<button name="account" value="teacher">Use Google Teacher</button> ' +
          '<button name="account" value="wallet">Use Google Wallet Owner</button> ' +
          '<button name="account" value="cancel">Cancel Google sign-in</button>' +
          "</form></body></html>",
      );
  });
  app.get("/api/test/google/complete", async (request, reply) => {
    const { state, account } = request.query;
    const original = transactions.get(state);
    if (!original || (account !== "cancel" && !accounts[account]))
      return reply.code(400).send("Unknown synthetic account");
    const callback = new URL(original.redirectUri);
    callback.searchParams.set("state", state);
    if (account === "cancel")
      callback.searchParams.set("error", "access_denied");
    else {
      const code = randomUUID();
      codes.set(code, { state, account });
      callback.searchParams.set("code", code);
    }
    return reply.redirect(callback.href);
  });
  process.on("SIGTERM", () => app.close());
  process.on("SIGINT", () => app.close());
  await app.listen({ host: "127.0.0.1", port: 3001 });
}

const root = process.cwd();
const origin = "http://127.0.0.1:5173";
const folder = await mkdtemp(resolve(tmpdir(), "folio-google-e2e-"));
const screenshots = resolve(root, "test-results/google");
await mkdir(screenshots, { recursive: true });
const children = [];
const errors = [];
let browser;

function start(args, cwd, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      LANGFUSE_ENABLED: "false",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      H2A_LLM_API_KEY: "",
      NODE_ENV: "test",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.log = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (data) => {
      child.log = (child.log + data).slice(-32000);
    });
  child.on("error", (error) => {
    child.log += error.message;
  });
  children.push(child);
  return child;
}

async function wait(url, child) {
  for (let i = 0; i < 160; i++) {
    if (child.exitCode !== null)
      throw new Error(`Fixture child exited: ${child.log}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error(`Server unavailable: ${url}\n${child.log}`);
}

async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const response = await fetch(path, {
        method: options.method || "GET",
        headers: options.body ? { "content-type": "application/json" } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return { status: response.status, body: await response.json() };
    },
    { path, options },
  );
}

async function newPage(key = `0x${"4".repeat(64)}`) {
  const account = privateKeyToAccount(key);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.exposeFunction("folioTestSign", (hex) =>
    account.signMessage({ message: { raw: hex } }),
  );
  await page.addInitScript(
    ({ address }) => {
      const listeners = new Map();
      window.ethereum = {
        isMetaMask: true,
        on(event, callback) {
          const callbacks = listeners.get(event) || new Set();
          callbacks.add(callback);
          listeners.set(event, callbacks);
        },
        removeListener(event, callback) {
          listeners.get(event)?.delete(callback);
        },
        async request({ method, params }) {
          if (method === "eth_requestAccounts") return [address];
          if (method === "eth_chainId") return "0x1";
          if (method === "personal_sign")
            return window.folioTestSign(params[0]);
          throw new Error(`Unsupported synthetic wallet method: ${method}`);
        },
      };
      window.folioTestAccountsChanged = (accounts) => {
        for (const callback of listeners.get("accountsChanged") || [])
          callback(accounts);
      };
    },
    { address: account.address },
  );
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .waitFor();
  return { page, context, account };
}

async function googleLogin(page, accountName) {
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Fixture Google sign-in", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: `Use ${accountName}`, exact: true })
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/api/"));
  await page.locator(".auth-loading").waitFor({ state: "hidden" });
}

async function finishProfile(page, role, name) {
  assert.equal(await page.getByLabel("Display name").inputValue(), name);
  await page.getByRole("radio", { name: "Student", exact: true }).waitFor();
  await page.getByRole("radio", { name: "Teacher", exact: true }).waitFor();
  await page
    .getByRole("radio", {
      name: role === "teacher" ? "Teacher" : "Student",
      exact: true,
    })
    .check();
  if (role === "student")
    await page.getByLabel("Student number").fill("24000002");
  else await page.getByLabel("Student number").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Open my workspace", exact: true })
    .click();
  await page.getByRole("heading", { name: "Courses.", exact: true }).waitFor();
  const result = await api(page, "/api/auth/me");
  assert.equal(result.status, 200);
  assert.equal(result.body.user.role, role);
  assert.equal(result.body.user.profileComplete, true);
  return result.body.user;
}

async function signOut(page) {
  await page
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .waitFor();
}

try {
  const backend = start(
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `(${fixtureServer.toString()})().catch(error => { console.error(error); process.exitCode = 1; })`,
    ],
    root,
    { DATA_DIR: folder, APP_PUBLIC_URL: origin, ORIGIN_SECRET: "" },
  );
  const frontend = start(
    [
      "../../node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ],
    resolve(root, "apps/web"),
  );
  const [ready] = await Promise.all([
    wait("http://127.0.0.1:3001/api/test/google/ready", backend),
    wait(origin, frontend),
  ]);
  assert.equal((await ready.json()).fixture, "google-browser-fixture");
  browser = await chromium.launch({
    headless: true,
    ...(!process.env.CI ? { channel: "chrome" } : {}),
  });

  const { page: teacher } = await newPage();
  for (const width of [375, 1440]) {
    await teacher.setViewportSize({ width, height: 1000 });
    await teacher.evaluate(() => document.fonts.ready);
    const google = teacher.getByRole("button", {
      name: "Continue with Google",
      exact: true,
    });
    const wallet = teacher.getByRole("button", {
      name: "Continue with MetaMask",
      exact: true,
    });
    await google.focus();
    assert.equal(
      await google.evaluate((button) => document.activeElement === button),
      true,
    );
    const googleBounds = await google.boundingBox();
    const walletBounds = await wallet.boundingBox();
    assert.ok(
      googleBounds.height >= 44,
      `Google touch target is ${googleBounds.height}px at ${width}px`,
    );
    assert.ok(
      walletBounds.height >= 44,
      `Wallet touch target is ${walletBounds.height}px at ${width}px`,
    );
    assert.equal(
      (await teacher.locator("h1").innerText()).replace(/\s+/g, " ").trim(),
      "Make room for your next understanding.",
    );
    const scroll = await teacher.evaluate(
      () => document.documentElement.scrollWidth,
    );
    assert.ok(
      scroll <= width,
      `Google login overflow at ${width}px: ${scroll}`,
    );
    await teacher.evaluate(() => {
      window.scrollTo(0, 0);
      return new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    });
    await teacher.screenshot({
      path: resolve(screenshots, `login-${width}.png`),
      fullPage: true,
    });
  }
  await teacher.setViewportSize({ width: 1440, height: 1000 });
  await googleLogin(teacher, "Google Teacher");
  const teacherBefore = (await api(teacher, "/api/auth/me")).body.user;
  assert.equal(teacherBefore.walletAddress, null);
  assert.equal(teacherBefore.authMethod, "google");
  assert.equal(teacherBefore.googleEmail, "teacher@example.invalid");
  assert.equal(teacherBefore.profileComplete, false);
  const teacherUser = await finishProfile(teacher, "teacher", "Google Teacher");
  await teacher
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await teacher.getByLabel("Course name").fill("Google account course");
  await teacher.getByLabel("Course code", { exact: true }).fill("GOOGLE2026");
  await teacher
    .getByLabel("Description", { exact: true })
    .fill("Synthetic OAuth browser integration.");
  await teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await teacher.getByText("Student join code:").waitFor();
  const course = (await api(teacher, "/api/workspace")).body.courses.find(
    (item) => item.code === "GOOGLE2026",
  );
  assert.ok(course?.joinCode);
  const roleChange = await api(teacher, "/api/auth/profile", {
    method: "POST",
    body: { name: "Google Teacher", role: "student", studentId: "fake-number" },
  });
  assert.equal(roleChange.status, 409);
  await teacher.evaluate(() => window.folioTestAccountsChanged([]));
  await teacher.reload();
  await teacher
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .waitFor();
  assert.equal(
    (await api(teacher, "/api/auth/me")).body.user.id,
    teacherUser.id,
  );
  await signOut(teacher);
  await googleLogin(teacher, "Google Teacher");
  await teacher
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .waitFor();
  assert.equal(
    (await api(teacher, "/api/auth/me")).body.user.id,
    teacherUser.id,
  );
  assert.equal(
    (await api(teacher, "/api/workspace")).body.courses.find(
      (item) => item.id === course.id,
    )?.teacherId,
    teacherUser.id,
  );
  assert.equal(await teacher.getByLabel("Display name").count(), 0);
  console.log(
    "Google E2E: no-wallet teacher onboarding, immutable role, account changes, and relogin persistence passed.",
  );

  const { page: student } = await newPage();
  await googleLogin(student, "Google Student");
  const studentUser = await finishProfile(student, "student", "Google Student");
  assert.equal(studentUser.walletAddress, null);
  assert.notEqual(studentUser.id, teacherUser.id);
  await student.getByLabel("Course join code").fill(course.joinCode);
  await student
    .getByRole("button", { name: "Join course", exact: true })
    .click();
  await student.getByLabel("Ask about your course materials").waitFor();
  const note = {
    id: "google-private-note",
    courseId: course.id,
    studentId: studentUser.id,
    title: "Student private OAuth note",
    content: "Private learning remains private across login methods.",
    category: "Concepts",
    tags: [],
    links: [],
  };
  assert.equal(
    (
      await api(student, `/api/notes/${note.id}`, {
        method: "PUT",
        body: { record: note },
      })
    ).status,
    200,
  );
  const studentView = (await api(student, "/api/workspace")).body;
  assert.equal(
    studentView.notes.find((item) => item.id === note.id)?.content,
    note.content,
  );
  const teacherView = (await api(teacher, "/api/workspace")).body;
  assert.equal(teacherView.notes.length, 0);
  assert.ok(!JSON.stringify(teacherView).includes(note.title));
  for (const person of [...teacherView.students, ...studentView.teachers])
    for (const field of [
      "googleEmail",
      "googleLinked",
      "authMethod",
      "walletAddress",
    ])
      assert.equal(
        Object.hasOwn(person, field),
        false,
        `${field} leaked through a course profile`,
      );
  assert.equal(
    (await api(teacher, `/api/notes/${note.id}`, { method: "DELETE" })).status,
    403,
  );
  await signOut(student);
  await googleLogin(student, "Google Student");
  await student
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .waitFor();
  assert.equal(
    (await api(student, "/api/auth/me")).body.user.id,
    studentUser.id,
  );
  assert.equal(
    (await api(student, "/api/workspace")).body.notes[0].id,
    note.id,
  );
  await student.screenshot({
    path: resolve(screenshots, "google-student-workspace.png"),
    fullPage: true,
  });
  console.log(
    "Google E2E: student onboarding, course join, private notes, and account isolation passed.",
  );

  const { page: wallet, account } = await newPage(`0x${"5".repeat(64)}`);
  await wallet
    .getByRole("button", { name: "Continue with MetaMask", exact: true })
    .click();
  await wallet.getByLabel("Display name").fill("Existing Wallet Teacher");
  await wallet.getByRole("radio", { name: "Teacher", exact: true }).check();
  await wallet
    .getByRole("button", { name: "Open my workspace", exact: true })
    .click();
  await wallet
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .waitFor();
  const walletUser = (await api(wallet, "/api/auth/me")).body.user;
  assert.equal(
    walletUser.walletAddress.toLowerCase(),
    account.address.toLowerCase(),
  );
  assert.equal(walletUser.googleLinked, false);
  await wallet
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .click();
  await wallet
    .getByRole("dialog")
    .getByRole("button", { name: "Connect Google", exact: true })
    .click();
  await wallet
    .getByRole("heading", { name: "Fixture Google sign-in", exact: true })
    .waitFor();
  await wallet
    .getByRole("button", { name: "Use Google Wallet Owner", exact: true })
    .click();
  await wallet
    .getByRole("dialog")
    .getByText("Google connected", { exact: true })
    .waitFor();
  assert.equal((await api(wallet, "/api/auth/me")).body.user.id, walletUser.id);
  await wallet
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await googleLogin(wallet, "Google Wallet Owner");
  await wallet
    .getByRole("button", { name: "Account settings", exact: true })
    .first()
    .waitFor();
  const linked = (await api(wallet, "/api/auth/me")).body.user;
  assert.equal(linked.id, walletUser.id);
  assert.equal(linked.name, "Existing Wallet Teacher");
  assert.equal(linked.role, "teacher");
  assert.equal(linked.authMethod, "google");
  assert.equal(
    linked.walletAddress.toLowerCase(),
    account.address.toLowerCase(),
  );
  console.log(
    "Google E2E: MetaMask fallback and explicit same-account Google linking passed.",
  );

  const { page: cancelled } = await newPage();
  await cancelled
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await cancelled
    .getByRole("button", { name: "Cancel Google sign-in", exact: true })
    .click();
  await cancelled
    .getByRole("alert")
    .getByText(/Google sign-in was cancelled/)
    .waitFor();
  assert.equal((await api(cancelled, "/api/auth/me")).body.user, null);
  assert.equal(new URL(cancelled.url()).search, "");
  await cancelled.goto(
    `${origin}/api/auth/google/callback?state=invalid&code=invalid`,
  );
  await cancelled
    .getByRole("alert")
    .getByText(/expired|start again/)
    .waitFor();
  assert.equal((await api(cancelled, "/api/auth/me")).body.user, null);
  for (const code of ["__proto__", "untrusted-provider-error"]) {
    await cancelled.goto(
      `${origin}/?auth_error=${encodeURIComponent(code)}&keep=1#/courses`,
    );
    await cancelled
      .getByRole("alert")
      .getByText("We could not verify your Google account. Please try again.", {
        exact: true,
      })
      .waitFor();
    assert.ok(!(await cancelled.getByRole("alert").innerText()).includes(code));
    const safeUrl = new URL(cancelled.url());
    assert.equal(safeUrl.searchParams.get("auth_error"), null);
    assert.equal(safeUrl.searchParams.get("keep"), "1");
    assert.equal(safeUrl.hash, "#/courses");
  }
  assert.deepEqual(errors, []);
  console.log(
    "Google browser E2E passed: local provider boundary, real OAuth callback and cookies, Student/Teacher onboarding, durable identity, role lock, private Wiki isolation, wallet linking, cancellation, and responsive accessible login.",
  );
} catch (error) {
  if (browser)
    for (const [index, context] of browser.contexts().entries())
      for (const [pageIndex, page] of context.pages().entries())
        await page
          .screenshot({
            path: resolve(screenshots, `failure-${index}-${pageIndex}.png`),
            fullPage: true,
          })
          .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null) return;
      const exited = new Promise((done) => child.once("exit", done));
      child.kill("SIGTERM");
      let timeout;
      await Promise.race([
        exited,
        new Promise((done) => {
          timeout = setTimeout(() => {
            child.kill("SIGKILL");
            done();
          }, 5000);
        }),
      ]);
      clearTimeout(timeout);
    }),
  );
  await rm(folder, { recursive: true, force: true });
}
