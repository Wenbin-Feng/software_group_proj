import { chromium } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const root = process.cwd(),
  origin = "http://127.0.0.1:5173";
const folder = await mkdtemp(resolve(tmpdir(), "folio-e2e-"));
const screenshots = resolve(root, "test-results/screenshots");
await mkdir(screenshots, { recursive: true });
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const part of req) raw += part;
  const body = JSON.parse(raw);
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const text of [
      "An atomic operation protects the check and update together. ",
      "This keeps concurrent requests from selling the same item. [S1]",
    ])
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
      );
    res.end("data: [DONE]\n\n");
    return;
  }
  const visual = body.response_format?.json_schema.schema.properties.steps;
  const wiki = body.response_format?.json_schema.schema.properties.worthSaving;
  const count = Number(
    body.messages.at(-1).content.match(/Exactly (\d+) slides/)?.[1] || 3,
  );
  const content = wiki
    ? {
        worthSaving: true,
        reason: "The explanation defines an atomic inventory update.",
        takeaways: "An atomic update protects the inventory check.",
        pages: [
          {
            action: "create",
            matchTitle: "",
            type: "concept",
            title: "Atomic inventory update",
            summary: "An atomic update protects the check and the write.",
            tags: ["database", "concurrency"],
            claims: [
              {
                text: "An atomic update protects the check and the write.",
                provenance: "extracted",
              },
              {
                text: "A transaction alone does not define isolation.",
                provenance: "inferred",
              },
            ],
            openQuestions: [],
            links: [],
            relationships: [],
          },
        ],
      }
    : visual
    ? {
        title: "Atomic inventory updates",
        summary: "Follow a protected inventory change.",
        steps: [
          {
            title: "Read and check",
            explanation: "Inspect stock inside one protected change.",
            cards: [{ label: "Stock", value: "1", active: true }],
          },
          {
            title: "Commit",
            explanation: "The winning request reserves the last item.",
            cards: [{ label: "Stock", value: "0", active: true }],
          },
        ],
        quiz: {
          question: "What must be protected?",
          options: ["The check and update", "Only the display"],
          correctIndex: 0,
          explanation: "The check and change must happen together.",
        },
      }
    : {
        title: "并发事务教学",
        language: "zh-CN",
        slides: Array.from({ length: count }, (_, i) => ({
          title: `事务与并发 ${i + 1}`,
          body: ["保护检查与更新", "用真实案例理解原子操作"],
          layout: "content",
          secondary: [],
          table: [],
          notes: "Teacher notes",
          sources: [],
        })),
      };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const children = [];
let browser;
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => {
    log += d;
  });
  child.stderr.on("data", (d) => {
    log += d;
  });
  child.on("exit", (code) => {
    if (code) console.error(log);
  });
  children.push(child);
  return child;
}
async function wait(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server unavailable: ${url}`);
}
async function walletPage(key, role, name) {
  const account = privateKeyToAccount(key);
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  await page.exposeFunction("folioTestSign", (hex) =>
    account.signMessage({ message: { raw: hex } }),
  );
  await page.addInitScript(
    ({ address }) => {
      window.ethereum = {
        isMetaMask: true,
        on() {},
        removeListener() {},
        async request({ method, params }) {
          if (method === "eth_requestAccounts") return [address];
          if (method === "eth_chainId") return "0x1";
          if (method === "personal_sign")
            return window.folioTestSign(params[0]);
          throw new Error(method);
        },
      };
    },
    { address: account.address },
  );
  context.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", { name: "Continue with MetaMask" }).click();
  await page.getByLabel("Display name").fill(name);
  await page
    .getByRole("radio", {
      name: role === "teacher" ? "Teacher" : "Student",
      exact: true,
    })
    .check();
  if (role === "student")
    await page.getByLabel("Student number").fill("24000001");
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await page.getByRole("heading", { name: "Courses.", exact: true }).waitFor();
  return { page, context };
}
async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const r = await fetch(path, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(body));
      return body;
    },
    { path, options },
  );
}
async function switchRole(page, role) {
  await page
    .getByRole("button", { name: "Account settings", exact: true })
    .last()
    .click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings
    .getByRole("radio", {
      name: role === "teacher" ? "Teacher" : "Student",
      exact: true,
    })
    .check();
  await settings
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await settings.waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: "Courses.", exact: true }).waitFor();
  const result = await api(page, "/api/auth/me");
  assert.equal(result.user.role, role);
  assert.equal(result.user.authMethod, "wallet");
  return result.user;
}
const errors = [];
try {
  start(["apps/api/dist/server.js"], root, {
    LANGFUSE_ENABLED: "false",
    DATA_DIR: folder,
    APP_PUBLIC_URL: origin,
    ORIGIN_SECRET: "",
    PORT: "3001",
    H2A_LLM_API_KEY: "test-only-mock-key",
    H2A_LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    NODE_ENV: "test",
  });
  start(
    [
      "../../node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ],
    resolve(root, "apps/web"),
    {},
  );
  await Promise.all([wait("http://127.0.0.1:3001/api/health"), wait(origin)]);
  browser = await chromium.launch({
    headless: true,
    ...(!process.env.CI ? { channel: "chrome" } : {}),
  });
  const { page: teacher } = await walletPage(
    `0x${"1".repeat(64)}`,
    "teacher",
    "Test Teacher",
  );
  await teacher
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await teacher.getByLabel("Course name").fill("Concurrency lab");
  await teacher.getByLabel("Course code", { exact: true }).fill("COMP2026");
  await teacher
    .getByLabel("Description", { exact: true })
    .fill("A course for real API integration checks.");
  await teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  await teacher.getByText("Student join code:").waitFor();
  const teacherData = await api(teacher, "/api/workspace");
  const course = teacherData.courses.find((c) => c.name === "Concurrency lab");
  assert.ok(course?.joinCode);
  await teacher
    .getByRole("button", { name: "Courseware", exact: true })
    .click();
  await teacher.screenshot({
    path: resolve(screenshots, "teacher-courseware.png"),
    fullPage: true,
  });
  await teacher.getByLabel("Topic", { exact: true }).fill("事务与并发");
  await teacher.getByLabel("Slides", { exact: true }).fill("3");
  await teacher.locator("#courseware-language").selectOption("zh-CN");
  console.log("E2E: teacher course creation passed; generating courseware");
  await teacher
    .getByRole("button", { name: "Generate courseware", exact: true })
    .click();
  await teacher
    .getByText("Private draft", { exact: true })
    .waitFor({ timeout: 15000 });
  await teacher.getByLabel("Deck title").fill("可编辑事务课件");
  await teacher
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const downloadWait = teacher.waitForEvent("download");
  await teacher
    .getByRole("link", { name: "Editable PPTX", exact: true })
    .click();
  const download = await downloadWait;
  assert.match(download.suggestedFilename(), /\.pptx$/);
  await download.saveAs(resolve("test-results", "courseware.pptx"));
  await teacher
    .getByRole("button", { name: "Publish to course", exact: true })
    .click();
  await teacher.getByText("Published", { exact: true }).first().waitFor();
  const { page: student } = await walletPage(
    `0x${"2".repeat(64)}`,
    "student",
    "Test Student",
  );
  await student.getByLabel("Course join code").fill(course.joinCode);
  await student
    .getByRole("button", { name: "Join course", exact: true })
    .click();
  await student.getByLabel("Ask about your course materials").waitFor();
  await student
    .getByRole("button", { name: "Upload personal material", exact: true })
    .click();
  await student.locator("input[type=file]").setInputFiles({
    name: "transactions.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Atomic operations\nA conditional inventory update protects the check and write together. A transaction alone does not define isolation. Concurrency needs a protected invariant.",
    ),
  });
  await student
    .getByRole("dialog")
    .getByRole("button", {
      name: /Add .*learning space|Add .*document|Add .*material|Upload/i,
    })
    .last()
    .click();
  await student.getByRole("dialog").waitFor({ state: "hidden" });
  await student
    .getByLabel("Ask about your course materials")
    .fill("Explain an atomic inventory update.");
  await student.getByRole("button", { name: "Send question" }).click();
  await student
    .getByText("An atomic operation protects the check and update together.", {
      exact: false,
    })
    .first()
    .waitFor({ timeout: 15000 });
  await student
    .getByRole("button", { name: "Save to Wiki", exact: true })
    .first()
    .click();
  await student.getByText(/Saved to:/).waitFor({ timeout: 20000 });
  await student.getByRole("button", { name: "Visualize", exact: true }).click();
  await student
    .locator('iframe[title="Visual explanation"]')
    .waitFor({ timeout: 15000 });
  const frame = student.frameLocator('iframe[title="Visual explanation"]');
  await frame.getByRole("button", { name: "Next step" }).click();
  await frame.getByRole("heading", { name: "Commit", exact: true }).waitFor();
  const state = await api(student, "/api/workspace");
  const savedPage = state.notes.find(
    (note) => note.title === "Atomic inventory update",
  );
  assert.ok(savedPage);
  assert.equal(state.sessions.length, 1);
  assert.ok(state.sessions[0].messages[1].visualizationHtml);
  await student.reload();
  await student.getByLabel("Ask about your course materials").waitFor();
  const persisted = await api(student, "/api/workspace");
  assert.equal(
    persisted.notes.find((note) => note.id === savedPage.id)?.id,
    savedPage.id,
  );
  assert.equal(persisted.materials.filter((m) => m.ownerId).length, 1);
  const studentAccount = (await api(student, "/api/auth/me")).user;
  assert.equal((await switchRole(student, "teacher")).id, studentAccount.id);
  assert.equal((await api(student, "/api/workspace")).notes.length, 0);
  assert.equal((await switchRole(student, "student")).id, studentAccount.id);
  await student.reload();
  await student
    .getByRole("button", { name: "Account settings", exact: true })
    .last()
    .waitFor();
  const afterRoleSwitch = await api(student, "/api/workspace");
  assert.equal(
    afterRoleSwitch.notes.find((note) => note.id === savedPage.id)?.id,
    savedPage.id,
  );
  assert.equal(afterRoleSwitch.sessions[0].id, state.sessions[0].id);
  assert.ok(afterRoleSwitch.sessions[0].messages[1].visualizationHtml);
  assert.equal(afterRoleSwitch.materials.filter((m) => m.ownerId).length, 1);
  assert.ok(afterRoleSwitch.courses.some((item) => item.id === course.id));
  await teacher.reload();
  const view = await api(teacher, "/api/workspace");
  assert.equal(view.notes.length, 0);
  assert.equal(view.sessions.length, 1);
  assert.equal(view.materials.filter((m) => m.ownerId).length, 1);
  for (const width of [375, 768, 1024, 1440]) {
    await teacher.setViewportSize({ width, height: 1000 });
    await teacher.goto(`${origin}/#/teacher/courses/${course.id}/courseware`);
    await teacher
      .getByRole("heading", { name: "Courseware", exact: true })
      .waitFor();
    await teacher.evaluate(() => document.fonts.ready);
    const overflow = await teacher.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width && r.right > innerWidth + 1;
        })
        .slice(0, 12)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          left: e.getBoundingClientRect().left,
          right: e.getBoundingClientRect().right,
        })),
    }));
    if (overflow.scroll > width) console.log(JSON.stringify(overflow));
    assert.ok(overflow.scroll <= width, `Teacher overflow ${width}`);
    await teacher.screenshot({
      path: resolve(screenshots, `courseware-${width}.png`),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser E2E passed: real SIWE onboarding, teacher creation, student join, upload, streamed AI, private Wiki, dynamic HTML, editable PPTX, publication, reversible account roles, reload persistence and responsive courseware.",
  );
} catch (error) {
  if (browser)
    for (const context of browser.contexts())
      for (const [i, page] of context.pages().entries())
        await page
          .screenshot({
            path: resolve(screenshots, `failure-${Date.now()}-${i}.png`),
            fullPage: true,
          })
          .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  for (const child of children) child.kill("SIGTERM");
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(folder, { recursive: true, force: true });
}
