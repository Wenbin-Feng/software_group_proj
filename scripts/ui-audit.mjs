import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// Local-only visual regression fixture. It never loads private environment
// files or calls Google, OpenRouter, Langfuse, or production services.
async function fixtureServer() {
  const { buildApp } = await import("../apps/api/src/server.ts");
  const { hash } = await import("../apps/api/src/core/auth.ts");
  const { deckHtml } = await import("../apps/api/src/ai/deck.ts");
  const app = await buildApp({
    dataDir: process.env.DATA_DIR,
    publicUrl: "http://127.0.0.1:5173",
    secureCookies: false,
    seed: false,
    logger: false,
    originSecret: "",
    googleProvider: {
      authorizationUrl() {
        return "https://accounts.google.com/";
      },
      async exchange() {
        throw new Error("External OAuth disabled in UI audit");
      },
    },
  });
  const { db, put } = app.folio;
  const now = new Date().toISOString();
  const long =
    "超长课程名称与跨学科知识连接UnderstandingConcurrencyWithoutAnyWhitespace2026";
  for (const [id, role, name, complete] of [
    [
      "audit-student",
      "student",
      "王同学AlexandraWithoutAnyWhitespaceLongSurname",
      1,
    ],
    [
      "audit-teacher",
      "teacher",
      "Professor李老师LongUnbrokenInstructorSurname",
      1,
    ],
    ["audit-onboarding", null, "首次登录的同学FirstTimeStudent", 0],
  ]) {
    db.prepare(
      "INSERT INTO users(id,google_sub,google_email,name,student_id,role,profile_complete,created_at) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      id,
      id,
      `${id}LongEmailAddressWithoutWhitespaceForResponsiveChecks@example.invalid`,
      name,
      role === "student" ? "24000001LongStudentNumber" : "",
      role,
      complete,
      now,
    );
    db.prepare("INSERT INTO auth_sessions VALUES(?,?,?,?)").run(
      hash(`${id}-local-token`),
      id,
      Date.now() + 3600000,
      Date.now(),
    );
    db.prepare("INSERT INTO auth_session_methods VALUES(?,?)").run(
      hash(`${id}-local-token`),
      "google",
    );
  }
  for (const [id, name, code] of [
    ["audit-course", long, "COMP2026LONGCODE"],
    ["audit-second", "Software Engineering 软件工程", "COMP4342"],
  ]) {
    put("courses", {
      id,
      name,
      code,
      teacherId: "audit-teacher",
      instructor: "Professor李老师LongUnbrokenInstructorSurname",
      term: "2026 Fall Semester",
      description:
        "A course about concurrency, databases and learning. 这是包含中英文的课程介绍。".repeat(
          3,
        ),
      joinCode: "UIAUDIT",
      color: "#3156d3",
      createdAt: now,
    });
    put("enrollments", {
      id: `${id}-enrollment`,
      courseId: id,
      studentId: "audit-student",
      joinedAt: now,
    });
  }
  const materialText = `# Atomic inventory updates\n\nRead and update in the same protected operation. ${long}\n\n## 中文标题\n\nA long code example: \`LongUnbrokenMethodNameWithoutAnyWhitespaceThatWouldNormallyOverflowTheContentArea\`.\n\n- Inspect the shared state.\n- Commit once.\n\n\`\`\`js\nconst VeryLongUnbrokenVariableNameForAnOverflowTest = 'value';\n\`\`\``;
  for (let i = 0; i < 4; i++)
    put("materials", {
      id: `audit-material-${i}`,
      courseId: "audit-course",
      ownerId: i === 3 ? "audit-student" : null,
      name:
        i === 1
          ? "Transactions.md"
          : `${long}SourceMaterialWithoutSpaces-${i}.md`,
      text: materialText,
      type: "md",
      size: 2048,
      pages: [
        { page: 1, text: materialText },
        { page: 2, text: "More evidence." },
      ],
      uploadedAt: now,
      archivedAt: null,
      hasOriginal: false,
    });
  put("sessions", {
    id: "audit-session",
    courseId: "audit-course",
    studentId: "audit-student",
    title: `${long}学习讨论`,
    materialIds: ["audit-material-0"],
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: "audit-question",
        role: "user",
        content: `How can we protect ${long}?`,
        createdAt: now,
      },
      {
        id: "audit-answer",
        role: "assistant",
        content: materialText,
        createdAt: now,
        sources: [{ materialId: "audit-material-0", page: 1, label: "S1" }],
      },
    ],
  });
  for (let i = 0; i < 4; i++)
    put("notes", {
      id: `audit-note-${i}`,
      courseId: "audit-course",
      studentId: "audit-student",
      title: i ? `Connected note ${i}` : long,
      content: `${materialText}\n\n[[Connected note 1]]\n[[Connected note 2]]`,
      tags: ["Concurrency", "数据库事务长标签WithoutWhitespace"],
      createdAt: now,
      updatedAt: now,
      sourceSessionId: "audit-session",
      hasAnimation: false,
    });
  put("market", {
    id: "audit-market",
    courseId: "audit-course",
    studentId: "audit-student",
    title: long,
    description: `Course knowledge from ${long}.`,
    content: materialText,
    category: "数据库与事务Concurrency",
    author: "王同学AlexandraWithoutAnyWhitespaceLongSurname",
    initials: "WA",
    color: "#3156d3",
    tags: ["Concurrency", "长标签WithoutWhitespace"],
    pages: [
      {
        id: "audit-published-note",
        title: long,
        content: materialText,
        tags: ["Concurrency"],
      },
    ],
    updatedAt: now,
    createdAt: now,
    likes: 3,
    likedBy: [],
    bookmarkedBy: [],
    featured: true,
    version: 1,
  });
  put("threads", {
    id: "audit-thread",
    courseId: "audit-course",
    teacherId: "audit-teacher",
    studentId: "audit-student",
    subject: `事务理解的问题与反馈${long}`,
    status: "open",
    relatedSessionId: "audit-session",
    createdAt: now,
    updatedAt: now,
    lastReadAt: { student: now, teacher: null },
    messages: [
      {
        id: "audit-msg-1",
        senderRole: "student",
        senderId: "audit-student",
        body: `Could you explain ${long}?\n这是一个很长的中英文消息。`.repeat(
          3,
        ),
        createdAt: now,
      },
      {
        id: "audit-msg-2",
        senderRole: "teacher",
        senderId: "audit-teacher",
        body: "Keep the check and update atomic. 先检查再修改，确保它们在同一个原子操作中。",
        createdAt: now,
      },
    ],
  });
  const deck = {
    title: long,
    language: "English",
    slides: [
      {
        title: long,
        layout: "content",
        body: ["Understand atomic changes.", long],
        secondary: [],
        table: [],
        notes: "Teacher notes about concurrency.",
        sources: [],
      },
      {
        title: "Isolation",
        layout: "two-column",
        body: ["Serializable", long],
        secondary: ["Read committed", long],
        table: [],
        notes: "",
        sources: [],
      },
      {
        title: "A safe inventory change",
        layout: "process",
        body: ["Read and check", long, "Commit the protected change"],
        secondary: [],
        table: [],
        notes: "",
        sources: [],
      },
      {
        title: "Compare isolation guarantees",
        layout: "table",
        body: [],
        secondary: [],
        table: [
          ["Property", "Guarantee"],
          [long, "No lost update"],
          ["Read consistency", long],
        ],
        notes: "",
        sources: [],
      },
    ],
  };
  put("courseware", {
    id: "audit-courseware",
    courseId: "audit-course",
    teacherId: "audit-teacher",
    title: long,
    status: "draft",
    deck,
    html: deckHtml(deck),
    createdAt: now,
    updatedAt: now,
  });
  // A pre-fix saved snapshot deliberately restores fixed-ratio clipping. Both
  // teacher and student previews must repair its presentation without edits
  // to its slide content or original CSP.
  const legacyHtml = deckHtml(deck).replace(
    /<style data-folio-courseware-layout>[\s\S]*?<\/style>/,
    "<style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}section{position:relative;width:100%;aspect-ratio:16/9;padding:5% 6%;overflow:hidden;background:white;margin-bottom:18px}h1{font-size:clamp(20px,3vw,42px);margin:0 0 6%}ul{font-size:clamp(12px,2vw,26px)}.columns{display:grid;grid-template-columns:1fr 1fr;gap:7%}.process{display:flex;gap:18px}table{width:100%;border-collapse:collapse}td{padding:14px}footer{position:absolute;bottom:4%;left:6%;right:6%;display:flex;justify-content:space-between}</style>",
  );
  put("courseware", {
    id: "audit-courseware-legacy",
    courseId: "audit-course",
    teacherId: "audit-teacher",
    title: `Legacy saved ${long}`,
    status: "published",
    deck,
    html: legacyHtml,
    createdAt: now,
    updatedAt: now,
  });
  put("materials", {
    id: "audit-published-courseware",
    courseId: "audit-course",
    ownerId: null,
    name: "Published legacy courseware.pptx",
    type: "pptx",
    generatedCoursewareId: "audit-courseware-legacy",
    html: legacyHtml,
    text: "Saved courseware snapshot for local layout verification.",
    pages: [{ page: 1, text: "Saved courseware snapshot" }],
    size: 2048,
    hasOriginal: false,
    uploadedAt: now,
    archivedAt: null,
  });
  app.get("/api/test/ui-ready", async () => ({ fixture: "ui-audit" }));
  process.on("SIGTERM", () => app.close());
  process.on("SIGINT", () => app.close());
  await app.listen({ host: "127.0.0.1", port: 3001 });
}

if (process.argv.includes("--fixture")) {
  await fixtureServer();
} else {
  const root = process.cwd(),
    origin = "http://127.0.0.1:5173";
  const folder = await mkdtemp(resolve(tmpdir(), "folio-ui-audit-"));
  const output = resolve(root, "test-results/ui");
  await mkdir(output, { recursive: true });
  const children = [],
    results = [],
    pageErrors = [];
  let browser;
  function start(args, cwd, env = {}) {
    const child = spawn(process.execPath, args, {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: "test",
        LANGFUSE_ENABLED: "false",
        H2A_LLM_API_KEY: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        ORIGIN_SECRET: "",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.log = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on(
        "data",
        (data) => (child.log = (child.log + data).slice(-16000)),
      );
    children.push(child);
    return child;
  }
  async function wait(url, child) {
    for (let i = 0; i < 180; i++) {
      if (child.exitCode !== null)
        throw new Error(`Fixture exited: ${child.log}`);
      try {
        if ((await fetch(url)).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Fixture unavailable: ${url}\n${child.log}`);
  }
  async function actor(role) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    if (role != "login")
      await context.addCookies([
        {
          name: "folio_session",
          value: `audit-${role}-local-token`,
          domain: "127.0.0.1",
          path: "/api",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) =>
      pageErrors.push({ role, message: error.message }),
    );
    return { page, context };
  }
  async function inspect(page, name, width, height = 900) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      const finite = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        );
      await Promise.all(
        finite.map((animation) => animation.finished.catch(() => {})),
      );
      window.scrollTo(0, 0);
    });
    const metrics = await page.evaluate(() => {
      const visible = (e) => {
        const r = e.getBoundingClientRect(),
          s = getComputedStyle(e);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          s.display !== "none"
        );
      };
      const details = (e) => {
        const r = e.getBoundingClientRect();
        return {
          tag: e.tagName,
          class: String(e.className?.baseVal ?? e.className).slice(0, 180),
          label:
            e.getAttribute("aria-label") || e.textContent?.trim().slice(0, 65),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      };
      const clippedByPanel = (e) => {
        let p = e.parentElement;
        while (p && p !== document.body) {
          const s = getComputedStyle(p);
          if (["auto", "scroll", "hidden", "clip"].includes(s.overflowX)) {
            const r = p.getBoundingClientRect();
            if (r.left >= -2 && r.right <= innerWidth + 2) return true;
          }
          p = p.parentElement;
        }
        return false;
      };
      const escaped = [...document.querySelectorAll("body *")]
        .filter((e) => {
          if (!visible(e)) return false;
          const r = e.getBoundingClientRect();
          return (
            (r.right > innerWidth + 2 || r.left < -2) &&
            !clippedByPanel(e) &&
            !e.closest(".sidebar:not(.sidebar-open)")
          );
        })
        .map(details)
        .slice(0, 25);
      const distorted = [...document.querySelectorAll("svg.lucide")]
        .filter((e) => {
          if (!visible(e)) return false;
          const r = e.getBoundingClientRect();
          return r.width < r.height * 0.75 || r.height < r.width * 0.75;
        })
        .map(details)
        .slice(0, 15);
      const wrappedBreadcrumbs = [
        ...document.querySelectorAll(
          ".breadcrumb > .text-link,.breadcrumb > .course-back",
        ),
      ]
        .filter((button) => {
          if (!visible(button)) return false;
          const walker = document.createTreeWalker(
            button,
            NodeFilter.SHOW_TEXT,
          );
          let node;
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            if (range.getClientRects().length > 1) return true;
          }
          return button.scrollWidth > button.clientWidth + 2;
        })
        .map(details);
      const clippedControls = [
        ...document.querySelectorAll("button,input,select,textarea,a[href]"),
      ]
        .filter((e) => {
          if (
            !visible(e) ||
            (e.closest(".sidebar:not(.sidebar-open)") && innerWidth < 700)
          )
            return false;
          const r = e.getBoundingClientRect();
          let p = e.parentElement;
          while (p && p !== document.body) {
            const s = getComputedStyle(p),
              pr = p.getBoundingClientRect();
            if (["auto", "scroll"].includes(s.overflowX)) return false;
            if (
              ["hidden", "clip"].includes(s.overflowX) &&
              (r.left < pr.left - 2 || r.right > pr.right + 2)
            )
              return true;
            p = p.parentElement;
          }
          return false;
        })
        .map(details)
        .slice(0, 20);
      const footer = document.querySelector(".sidebar-bottom");
      const teacherTab = document.querySelector(
        '.tportal-tabs [aria-current="page"]',
      );
      const teacherNav = teacherTab?.closest(".tportal-tabs");
      const selectedTeacherTabClipped =
        teacherTab && teacherNav
          ? (() => {
              const selected = teacherTab.getBoundingClientRect(),
                nav = teacherNav.getBoundingClientRect();
              return (
                selected.left < nav.left - 2 || selected.right > nav.right + 2
              );
            })()
          : false;
      const footerOverflow =
        footer && visible(footer) && footer.getBoundingClientRect().left >= 0
          ? footer.scrollWidth > footer.clientWidth + 2
          : false;
      const dialogs = [...document.querySelectorAll('[role="dialog"]')]
        .filter(visible)
        .map((e) => ({
          ...details(e),
          tooTall:
            e.getBoundingClientRect().bottom > innerHeight + 2 ||
            e.getBoundingClientRect().top < -2,
        }));
      return {
        viewport: { width: innerWidth, height: innerHeight },
        pageWidth: document.documentElement.scrollWidth,
        escaped,
        distorted,
        wrappedBreadcrumbs,
        clippedControls,
        footerOverflow,
        selectedTeacherTabClipped,
        dialogs,
      };
    });
    const screenshot = resolve(output, `${name}-${width}x${height}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    if (metrics.dialogs.length) {
      metrics.dialogActionsReachable = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const body = dialog?.querySelector(".modal-body");
        const actions = [
          ...(body || dialog).querySelectorAll(
            "button,a[href],input,textarea,select",
          ),
        ].filter((e) => e.getBoundingClientRect().width > 0);
        const last = actions.at(-1);
        last?.scrollIntoView({ block: "nearest" });
        const close = dialog?.querySelector(
          'button[aria-label="Close dialog"]',
        );
        const onScreen = (e) => {
          if (!e) return true;
          const r = e.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight + 2 &&
            r.left >= 0 &&
            r.right <= innerWidth + 2
          );
        };
        const reachable = onScreen(last) && onScreen(close);
        if (body) body.scrollTop = 0;
        return reachable;
      });
    }
    const result = { name, ...metrics, screenshot };
    results.push(result);
    await writeFile(
      resolve(output, "results.json"),
      JSON.stringify(
        { capturedAt: new Date().toISOString(), results, pageErrors },
        null,
        2,
      ),
    );
    const issue =
      metrics.pageWidth > width + 2 ||
      metrics.escaped.length ||
      metrics.distorted.length ||
      metrics.wrappedBreadcrumbs.length ||
      metrics.clippedControls.length ||
      metrics.footerOverflow ||
      metrics.selectedTeacherTabClipped ||
      metrics.dialogs.some((d) => d.tooTall) ||
      metrics.dialogActionsReachable === false;
    if (issue) console.log(JSON.stringify({ name, width, height, ...metrics }));
    return result;
  }
  async function route(page, hash) {
    await page.goto(`${origin}/${hash}`);
    await page.locator(".topbar").waitFor();
    await page.waitForTimeout(160);
  }
  async function validateDeckPreview(page, selector, name, width) {
    const preview = await page
      .frameLocator(selector)
      .locator("body")
      .evaluate((body) => {
        const failures = [];
        for (const [index, section] of [
          ...body.querySelectorAll("section"),
        ].entries()) {
          const bounds = section.getBoundingClientRect();
          const footer = section.querySelector("footer");
          const content = [...section.children].filter(
            (element) => element !== footer,
          );
          const contentBottom = Math.max(
            ...content.map((element) => element.getBoundingClientRect().bottom),
          );
          if (footer && footer.getBoundingClientRect().top < contentBottom - 2)
            failures.push({
              slide: index + 1,
              issue: "Footer overlaps slide content",
            });
          for (const element of section.querySelectorAll(
            "h1,li,td,footer,footer span",
          )) {
            const rect = element.getBoundingClientRect();
            if (
              rect.left < bounds.left - 2 ||
              rect.right > bounds.right + 2 ||
              rect.top < bounds.top - 2 ||
              rect.bottom > bounds.bottom + 2
            )
              failures.push({
                slide: index + 1,
                element: element.tagName,
                issue: "Slide content is clipped",
              });
          }
        }
        return {
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          failures,
          slideCount: body.querySelectorAll("section").length,
          text: body.innerText,
        };
      });
    assert.ok(
      preview.documentWidth <= preview.width + 2,
      `Courseware preview horizontal overflow at ${width}px`,
    );
    assert.deepEqual(
      preview.failures,
      [],
      `Courseware title, content and footer must remain readable at ${width}px`,
    );

    assert.equal(
      preview.slideCount,
      4,
      "All four slide layouts must be retained",
    );
    for (const expected of [
      "Understand atomic changes.",
      "Serializable",
      "Read committed",
      "Read and check",
      "No lost update",
      "Guarantee",
    ])
      assert.ok(
        preview.text.includes(expected),
        `Courseware content must be retained: ${expected}`,
      );
    results.at(-1).coursewarePreview = { ...preview, text: undefined };
    await page
      .locator(selector)
      .screenshot({ path: resolve(output, `${name}-preview-${width}.png`) });
  }
  try {
    const api = start(
      ["--import", "tsx", resolve(root, "scripts/ui-audit.mjs"), "--fixture"],
      root,
      { DATA_DIR: folder },
    );
    const web = start(
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
    await Promise.all([
      wait("http://127.0.0.1:3001/api/test/ui-ready", api),
      wait(origin, web),
    ]);
    browser = await chromium.launch({
      headless: true,
      ...(!process.env.CI ? { channel: "chrome" } : {}),
    });
    const widths = process.env.UI_AUDIT_WIDTHS
      ? process.env.UI_AUDIT_WIDTHS.split(",").map(Number)
      : [320, 375, 768, 1024, 1440];
    const login = await actor("login");
    await login.page.goto(origin);
    await login.page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .waitFor();
    for (const width of widths)
      await inspect(login.page, "login", width, width <= 375 ? 667 : 900);
    const onboarding = await actor("onboarding");
    await onboarding.page.goto(origin);
    await onboarding.page.getByLabel("Display name").waitFor();
    for (const width of widths)
      await inspect(
        onboarding.page,
        "onboarding",
        width,
        width <= 375 ? 667 : 900,
      );
    for (const role of ["student", "teacher"]) {
      const { page } = await actor(role);
      const routes =
        role === "student"
          ? [
              ["courses", "#/courses"],
              ["chat", "#/courses/audit-course?session=audit-session"],
              ["materials", "#/courses/audit-course?panel=files"],
              ["wiki-library", "#/wiki"],
              ["wiki-note", "#/wiki?course=audit-course&note=audit-note-0"],
              ["market", "#/market?course=audit-course"],
              ["inbox", "#/inbox?course=audit-course&thread=audit-thread"],
            ]
          : [
              ["courses", "#/teacher/courses"],
              ["overview", "#/teacher/courses/audit-course/overview"],
              ["materials", "#/teacher/courses/audit-course/materials"],
              ["students", "#/teacher/courses/audit-course/students"],
              [
                "student",
                "#/teacher/courses/audit-course/students/audit-student",
              ],
              [
                "review",
                "#/teacher/courses/audit-course/students/audit-student/sessions/audit-session",
              ],
              ["courseware", "#/teacher/courses/audit-course/courseware"],
              ["market", "#/teacher/courses/audit-course/market"],
              ["inbox", "#/inbox?course=audit-course&thread=audit-thread"],
            ];
      for (const [name, hash] of routes) {
        await route(page, hash);
        for (const width of widths)
          await inspect(
            page,
            `${role}-${name}`,
            width,
            width <= 375 ? 667 : 900,
          );
        if (role === "student" && name === "chat") {
          for (const width of [320, 375, 768, 1440].filter((w) =>
            widths.includes(w),
          )) {
            await page.setViewportSize({ width, height: 667 });
            await page.locator(".studio-sources-toggle").click();
            await inspect(page, "student-sources-popover", width, 667);
            await page
              .getByRole("button", { name: "Close sources", exact: true })
              .click();
            await page.locator(".studio-session-switch").click();
            await inspect(page, "student-sessions-popover", width, 667);
            await page.locator(".studio-session-switch").click();
          }
        }
        if (name === "wiki-note") {
          await page
            .getByRole("button", { name: "Edit note", exact: true })
            .click();
          for (const width of widths)
            await inspect(
              page,
              "student-wiki-editor",
              width,
              width <= 375 ? 540 : 900,
            );
          await page
            .getByRole("button", { name: "Discard", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Open knowledge graph", exact: true })
            .first()
            .click();
          for (const width of [375, 768, 1440].filter((w) =>
            widths.includes(w),
          ))
            await inspect(
              page,
              "student-wiki-graph",
              width,
              width === 375 ? 540 : 900,
            );
        }
        if (name === "courseware") {
          await page.locator(".courseware-card").first().click();
          await page
            .frameLocator('iframe[title="Courseware preview"]')
            .getByRole("heading", { level: 1 })
            .first()
            .waitFor();
          for (const width of widths) {
            await inspect(
              page,
              "teacher-courseware-editor",
              width,
              width <= 375 ? 667 : 900,
            );
            await validateDeckPreview(
              page,
              'iframe[title="Courseware preview"]',
              "teacher-courseware",
              width,
            );
          }
          await page
            .getByRole("button", { name: "All courseware", exact: true })
            .click();
          await page.locator(".courseware-card").nth(1).click();
          for (const width of [320, 375]) {
            await inspect(page, "teacher-legacy-courseware", width, 667);
            await validateDeckPreview(
              page,
              'iframe[title="Courseware preview"]',
              "teacher-legacy-courseware",
              width,
            );
          }
        }
      }
      await route(page, role === "student" ? "#/courses" : "#/teacher/courses");
      await inspect(page, `${role}-wide-home`, 1920, 1080);
      await route(
        page,
        role === "student"
          ? "#/courses/audit-course?session=audit-session"
          : "#/teacher/courses/audit-course/courseware",
      );
      await inspect(page, `${role}-landscape-workspace`, 844, 390);
      if (role === "student") {
        const feedHeight = await page
          .locator(".studio-chat-feed")
          .evaluate((element) => element.getBoundingClientRect().height);
        assert.ok(
          feedHeight >= 90,
          `Landscape course conversation needs at least 90px for messages; got ${Math.round(feedHeight)}px`,
        );
        await page
          .locator("#studio-question")
          .fill("Local layout check; no model request is submitted.");
        await page
          .getByRole("button", { name: "Send question", exact: true })
          .click({ trial: true });
        const composerActionReachable = await page.evaluate(() =>
          [
            document.querySelector("#studio-question"),
            document.querySelector(".studio-send"),
          ].every((element) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return (
              rect.top >= 0 &&
              rect.bottom <= innerHeight + 2 &&
              rect.left >= 0 &&
              rect.right <= innerWidth + 2
            );
          }),
        );
        assert.ok(
          composerActionReachable,
          "Landscape question input and Send question must be visible and reachable",
        );
        results.at(-1).chatFeedHeight = Math.round(feedHeight);
        results.at(-1).composerActionReachable = composerActionReachable;
        await page.locator("#studio-question").fill("");
      }
      await route(page, "#/inbox?course=audit-course&thread=audit-thread");
      await inspect(page, `${role}-inbox-short`, 375, 540);
      const reply = page.locator("#inbox-reply-input");
      await reply.fill("Local UI fixture reply; no message is submitted.");
      await reply.scrollIntoViewIfNeeded();
      const sendReply = page.getByRole("button", {
        name: "Send reply",
        exact: true,
      });
      // A trial performs Playwright's real visibility, viewport, overlap and
      // enabled checks without submitting a message or changing persisted data.
      await sendReply.click({ trial: true });
      const replyActionReachable = await page.evaluate(() => {
        const elements = [
          document.querySelector("#inbox-reply-input"),
          document.querySelector('.inbox-reply button[type="submit"]'),
        ];
        return elements.every((element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          let top = 0,
            bottom = innerHeight,
            left = 0,
            right = innerWidth;
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            const style = getComputedStyle(parent),
              bounds = parent.getBoundingClientRect();
            if (
              ["auto", "scroll", "hidden", "clip"].includes(style.overflowY)
            ) {
              top = Math.max(top, bounds.top);
              bottom = Math.min(bottom, bounds.bottom);
            }
            if (
              ["auto", "scroll", "hidden", "clip"].includes(style.overflowX)
            ) {
              left = Math.max(left, bounds.left);
              right = Math.min(right, bounds.right);
            }
            parent = parent.parentElement;
          }
          return (
            rect.top >= top - 2 &&
            rect.bottom <= bottom + 2 &&
            rect.left >= left - 2 &&
            rect.right <= right + 2
          );
        });
      });
      assert.ok(
        replyActionReachable,
        `${role} Inbox reply and Send reply must be reachable at 375×540`,
      );
      results.at(-1).replyActionReachable = replyActionReachable;
      await page.screenshot({
        path: resolve(output, `${role}-inbox-reply-bottom-375x540.png`),
        fullPage: false,
      });
      await reply.fill("");
      if (role === "student") {
        await page
          .getByRole("button", { name: "New message", exact: true })
          .click();
        for (const width of [320, 375, 768])
          await inspect(page, "student-compose-message", width, 540);
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await route(page, "#/courses/audit-course?panel=files");
        await page
          .getByRole("button", {
            name: "Upload personal material",
            exact: true,
          })
          .click();
        for (const width of [320, 375, 768])
          await inspect(page, "student-upload-material", width, 540);
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await route(page, "#/courses/audit-course?panel=files");
        await page.locator(".workspace-tree-file").first().click();
        for (const width of widths) {
          await page.setViewportSize({ width, height: 667 });
          const mobilePreview = page
            .getByRole("navigation", { name: "Course workspace panels" })
            .getByRole("button", { name: /Preview/ });
          if (await mobilePreview.isVisible()) await mobilePreview.click();
          await inspect(page, "student-document-preview", width, 667);
        }
        await route(page, "#/courses/audit-course?panel=files");
        await page
          .getByRole("button", {
            name: "Published legacy courseware.pptx pptx",
            exact: true,
          })
          .click();
        for (const width of [320, 375, 768]) {
          await page.setViewportSize({ width, height: 667 });
          const previewTab = page
            .getByRole("navigation", { name: "Course workspace panels" })
            .getByRole("button", { name: /Preview/ });
          if (await previewTab.isVisible()) await previewTab.click();
          await inspect(page, "student-legacy-courseware", width, 667);
          await validateDeckPreview(
            page,
            'iframe[title="Published legacy courseware.pptx"]',
            "student-legacy-courseware",
            width,
          );
        }
      }
      await route(page, role === "teacher" ? "#/teacher/courses" : "#/courses");
      for (const width of [
        ...[320, 375, 768, 1440].filter((w) => widths.includes(w)),
        844,
      ]) {
        const height = width === 844 ? 390 : width === 320 ? 540 : 667;
        await page.setViewportSize({ width, height });
        await page
          .getByRole("button", { name: "Account settings", exact: true })
          .last()
          .click();
        await page
          .getByRole("dialog", { name: "Settings", exact: true })
          .waitFor();
        await inspect(page, `${role}-settings`, width, height);
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Search your workspace", exact: true })
          .click();
        await inspect(page, `${role}-search`, width, height);
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      }
      await page.setViewportSize({ width: 375, height: 540 });
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await inspect(page, `${role}-mobile-navigation`, 375, 540);
      await page.locator(".sidebar .profile").scrollIntoViewIfNeeded();
      await page.locator(".sidebar .profile").click();
      await inspect(page, `${role}-mobile-navigation-settings`, 375, 540);
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Help & about", exact: true })
        .click();
      await inspect(page, `${role}-help`, 375, 540);
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      const scrim = page.getByRole("button", {
        name: "Close navigation",
        exact: true,
      });
      if (await scrim.isVisible())
        await scrim.click({ position: { x: 370, y: 200 } });
      if (role === "teacher") {
        await page
          .getByRole("button", { name: "Create course", exact: true })
          .click();
        for (const width of widths)
          await inspect(page, "teacher-create-course", width, 667);
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      }
    }
    console.log(
      `UI audit captured ${results.length} views; runtime errors: ${pageErrors.length}`,
    );
    await writeFile(
      resolve(output, "results.json"),
      JSON.stringify(
        { capturedAt: new Date().toISOString(), results, pageErrors },
        null,
        2,
      ),
    );
    if (pageErrors.length)
      throw new Error(`UI runtime errors: ${JSON.stringify(pageErrors)}`);
    if (
      (process.argv.includes("--strict") ||
        process.env.UI_AUDIT_STRICT === "1") &&
      results.some(
        (r) =>
          r.pageWidth > r.viewport.width + 2 ||
          r.escaped.length ||
          r.distorted.length ||
          r.wrappedBreadcrumbs.length ||
          r.clippedControls.length ||
          r.footerOverflow ||
          r.selectedTeacherTabClipped ||
          r.dialogs.some((d) => d.tooTall) ||
          r.dialogActionsReachable === false,
      )
    )
      throw new Error(
        "UI geometry regressions detected; see test-results/ui/results.json",
      );
  } finally {
    await browser?.close();
    for (const child of children) child.kill("SIGTERM");
    await Promise.all(
      children.map(
        (child) =>
          new Promise((done) => {
            if (child.exitCode !== null) return done();
            child.once("exit", done);
            setTimeout(() => {
              child.kill("SIGKILL");
              done();
            }, 2000).unref();
          }),
      ),
    );
    await rm(folder, { recursive: true, force: true });
  }
}
