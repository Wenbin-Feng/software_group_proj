import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import Fastify from "fastify";
import { retrieveEvidence, citedSources } from "../src/ai/retrieval.js";
import { deckHtml, deckPptx, validateDeck } from "../src/ai/deck.js";
import {
  visualizationHtml,
  validateVisualization,
} from "../src/ai/visualization.js";
import { createJobQueue } from "../src/ai/jobs.js";
import { complete, streamCompletion } from "../src/ai/provider.js";
import { registerAiRoutes } from "../src/ai/routes.js";
import { createUsageMeter } from "../src/ai/usage.js";
import { slideDeck } from "./slide-deck.js";

const slide = (title = "事务隔离") => ({
  title,
  body: ["两个请求同时读取库存", "原子更新保持库存约束"],
  layout: "content",
  secondary: [],
  table: [],
  notes: "Discuss the losing request.",
  sources: [{ materialId: "public", page: 3 }],
});
const deck = () =>
  validateDeck({
    title: "数据库并发",
    language: "zh-CN",
    slides: [
      slide(),
      {
        ...slide("比较更新策略"),
        layout: "table",
        table: [
          ["策略", "行为"],
          ["条件更新", "检查影响行数"],
        ],
      },
    ],
  });
const visual = () => ({
  title: "Race <script>alert(1)</script>",
  summary: "Two requests, one last item.",
  steps: [
    {
      title: "Read",
      explanation: "Both requests see one item.",
      cards: [{ label: "Stock", value: "1", active: true }],
    },
    {
      title: "Update",
      explanation: "One atomic update succeeds.",
      cards: [{ label: "Stock", value: "0", active: true }],
    },
  ],
  quiz: {
    question: "What preserves stock?",
    options: ["Atomic update", "Independent reads"],
    correctIndex: 0,
    explanation: "The condition and update execute together.",
  },
});

function unzip(buffer: Buffer, wanted: string): string {
  // Read ZIP central directory so the test has no office or unzip dependency.
  for (let i = 0; i < buffer.length - 46; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    const size = buffer.readUInt32LE(i + 20),
      nameLength = buffer.readUInt16LE(i + 28),
      extraLength = buffer.readUInt16LE(i + 30),
      commentLength = buffer.readUInt16LE(i + 32);
    const name = buffer.subarray(i + 46, i + 46 + nameLength).toString();
    if (name === wanted) {
      const offset = buffer.readUInt32LE(i + 42),
        method = buffer.readUInt16LE(i + 10);
      const start =
        offset +
        30 +
        buffer.readUInt16LE(offset + 26) +
        buffer.readUInt16LE(offset + 28);
      const content = buffer.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(content) : content).toString();
    }
    i += 45 + nameLength + extraLength + commentLength;
  }
  throw new Error(`Missing ZIP entry: ${wanted}`);
}

test("retrieval preserves real pages and strips nonexistent citations", () => {
  const evidence = retrieveEvidence(
    [
      {
        id: "public",
        name: "Database.pdf",
        pages: [
          { page: 2, text: "General introduction" },
          { page: 9, text: "Atomic transaction prevents overselling" },
        ],
      },
    ],
    "atomic transaction",
  );
  assert.equal(evidence[0].page, 9);
  const answer = citedSources(
    "Use an atomic update [S1]. Another claim [S99]. Repeated [S1].",
    evidence,
  );
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.sources[0].page, 9);
  assert.match(answer.content, /unverified source/);
  assert.doesNotMatch(answer.content, /S99/);
});

test("editable PPTX contains native Chinese text, shapes and tables in widescreen", async () => {
  const buffer = await deckPptx(deck());
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  const content = unzip(buffer, "ppt/slides/slide1.xml");
  assert.match(content, /<a:t>事务隔离<\/a:t>/);
  assert.match(content, /<p:sp>/);
  assert.doesNotMatch(content, /<p:pic>/);
  assert.match(unzip(buffer, "ppt/slides/slide2.xml"), /<a:tbl>/);
  assert.match(
    unzip(buffer, "ppt/presentation.xml"),
    /cx="12192000" cy="6858000"/,
  );
});

test("deck HTML escapes authored text and malformed table or excessive points are rejected", () => {
  const value = deck();
  value.slides[0].title = "<img src=x onerror=alert(1)>";
  const html = deckHtml(value);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /connect-src 'none'/);
  assert.throws(() =>
    validateDeck({
      ...value,
      slides: [{ ...slide(), body: Array(7).fill("point") }],
    }),
  );
  assert.throws(() =>
    validateDeck({
      ...value,
      slides: [{ ...slide(), layout: "table", table: [["a"], ["a", "b"]] }],
    }),
  );
});

test("visualization renderer runs only trusted code and escapes model content", () => {
  const html = visualizationHtml(visual());
  assert.match(html, /id="timeline"/);
  assert.match(html, /CHECK YOUR UNDERSTANDING/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /\\u003cscript/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(
    html,
    /fetch\(|XMLHttpRequest|window\.location|<iframe|<form/,
  );
  assert.throws(() =>
    validateVisualization({
      ...visual(),
      quiz: { ...visual().quiz, correctIndex: 9 },
    }),
  );
});

test("SQLite queue resumes interrupted jobs, persists success, bounds retries and keeps one worker", async () => {
  const db = new Database(":memory:");
  let count = 0,
    active = 0,
    max = 0;
  const queue = createJobQueue(db, async () => {
    count++;
    active++;
    max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return { coursewareId: "draft" };
  });
  const one = queue.enqueue("teacher", "course", "courseware", { topic: "A" });
  queue.enqueue("teacher", "course", "courseware", { topic: "B" });
  assert.throws(
    () => queue.enqueue("teacher", "course", "courseware", {}),
    /two generation/,
  );
  await Promise.all([queue.tick(), queue.tick()]);
  assert.equal(count, 1);
  assert.equal(max, 1);
  assert.equal(queue.get(one.id)?.status, "succeeded");
  await queue.close();
  db.prepare("UPDATE ai_jobs SET status='running' WHERE id=?").run(one.id);
  const resumed = createJobQueue(db, async () => {
    throw new Error("Provider temporarily unavailable");
  });
  assert.equal(resumed.get(one.id)?.status, "queued");
  await resumed.tick();
  assert.equal(resumed.get(one.id)?.status, "failed");
  resumed.retry(one.id);
  await resumed.tick();
  assert.throws(() => resumed.retry(one.id), /three attempts/);
  await resumed.close();
  db.close();
});

test("provider JSON and streaming use Qwen without exposing provider error details", async () => {
  const original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  let sent: any;
  try {
    globalThis.fetch = (async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
      );
    }) as typeof fetch;
    assert.equal(
      await complete([{ role: "user", content: "test" }], { type: "object" }),
      '{"ok":true}',
    );
    assert.equal(sent.model, process.env.H2A_LLM_MODEL || "deepseek/deepseek-v4.1-flash-1017");
    assert.equal(sent.provider.require_parameters, true);
    assert.equal(
      sent.reasoning.effort,
      process.env.H2A_REASONING_EFFORT || "none",
    );
    assert.match(sent.messages[0].content, /exact JSON Schema/);
    assert.match(sent.messages[0].content, /"type":"object"/);
    const encoder = new TextEncoder();
    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
              ),
            );
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n',
              ),
            );
            controller.close();
          },
        }),
      )) as typeof fetch;
    const deltas: string[] = [];
    assert.equal(
      await streamCompletion([{ role: "user", content: "test" }], (s) =>
        deltas.push(s),
      ),
      "Hello world",
    );
    assert.deepEqual(deltas, ["Hello ", "world"]);
    globalThis.fetch = (async () =>
      new Response(
        'data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n',
      )) as typeof fetch;
    await assert.rejects(
      () => streamCompletion([{ role: "user", content: "test" }], () => {}),
      /interrupted/,
    );
    globalThis.fetch = (async () =>
      new Response("SECRET_PROVIDER_PAYLOAD", { status: 500 })) as typeof fetch;
    await assert.rejects(
      () => complete([{ role: "user", content: "test" }]),
      (error: any) => !error.message.includes("SECRET_PROVIDER_PAYLOAD"),
    );
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
  }
});

test("AI usage remains durable by account and UTC day without daily limits", () => {
  const db = new Database(":memory:"),
    oldLimit = process.env.H2A_DAILY_CHAT_LIMIT;
  process.env.H2A_DAILY_CHAT_LIMIT = "1";
  let clock = Date.parse("2026-10-17T23:59:59Z");
  try {
    const first = createUsageMeter(db, () => clock);
    first.consume("student-a", "chat");
    const resumed = createUsageMeter(db, () => clock);
    resumed.consume("student-a", "chat");
    for (let i = 0; i < 65; i++) resumed.consume("student-a", "chat");
    for (let i = 0; i < 12; i++) resumed.consume("student-a", "generation");
    resumed.consume("student-b", "chat");
    resumed.consume("student-a", "generation");
    clock += 2000;
    resumed.consume("student-a", "chat");
    assert.equal(
      (db.prepare("SELECT SUM(count) AS n FROM ai_usage").get() as any).n,
      82,
    );
  } finally {
    db.close();
    if (oldLimit === undefined) delete process.env.H2A_DAILY_CHAT_LIMIT;
    else process.env.H2A_DAILY_CHAT_LIMIT = oldLimit;
  }
});

async function fixture() {
  const app = Fastify(),
    db = new Database(":memory:");
  const dataDir = await mkdtemp(path.join(tmpdir(), "folio-ai-"));
  const teacher = { id: "teacher", role: "teacher", name: "Teacher" },
    student = { id: "student", role: "student", name: "Student" };
  const records: Record<string, any[]> = {
    materials: [
      {
        id: "public",
        courseId: "course",
        name: "Database.pdf",
        ownerId: null,
        pages: [{ page: 3, text: "Atomic update prevents overselling." }],
      },
      {
        id: "private",
        courseId: "course",
        ownerId: "other",
        name: "private.txt",
        pages: [{ page: 1, text: "Private text" }],
      },
    ],
    sessions: [
      { id: "session", courseId: "course", studentId: "student", messages: [] },
    ],
    courseware: [],
    visualizations: [],
  };
  (app as any).folio = {
    db,
    dataDir,
    requireUser: (request: any) =>
      request.headers["x-role"] === "teacher" ? teacher : student,
    userById: (id: string) => (id === "teacher" ? teacher : student),
    canReadCourse: (_u: any, id: string) => id === "course",
    canTeach: (u: any, id: string) => u.role === "teacher" && id === "course",
    canReadMaterial: (u: any, m: any) => !m.ownerId || m.ownerId === u.id,
    canReadSession: (u: any, s: any) =>
      u.role === "teacher" || s.studentId === u.id,
    canReadNote: (u: any, n: any) =>
      u.role === "student" && n.studentId === u.id,
    get: (collection: string, id: string) =>
      records[collection]?.find((record) => record.id === id),
    all: (collection: string) => records[collection] || [],
    put: (collection: string, record: any) => {
      records[collection] ||= [];
      const at = records[collection].findIndex((item) => item.id === record.id);
      if (at < 0) records[collection].push(record);
      else records[collection][at] = record;
    },
    remove: (collection: string, id: string) => {
      records[collection] = (records[collection] || []).filter((item) => item.id !== id);
    },
  };
  await registerAiRoutes(app);
  await app.ready();
  return {
    app,
    db,
    records,
    async close() {
      await app.close();
      db.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

test("AI routes enforce teacher/private-material boundaries and persist verified chat", async () => {
  const f = await fixture(),
    original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  try {
    const forbidden = await f.app.inject({
      method: "POST",
      url: "/api/courseware",
      payload: { courseId: "course", topic: "Topic" },
    });
    assert.equal(forbidden.statusCode, 403);
    const privateSource = await f.app.inject({
      method: "POST",
      url: "/api/courseware",
      headers: { "x-role": "teacher" },
      payload: { courseId: "course", topic: "Topic", materialIds: ["private"] },
    });
    assert.equal(privateSource.statusCode, 403);
    const teacherChat = await f.app.inject({
      method: "POST",
      url: "/api/chat",
      headers: { "x-role": "teacher" },
      payload: {},
    });
    assert.equal(teacherChat.statusCode, 403);
    globalThis.fetch = (async () =>
      new Response(
        'data: {"choices":[{"delta":{"content":"Atomic update [S1]. Invalid [S20]."}}]}\n\ndata: [DONE]\n\n',
      )) as typeof fetch;
    const answer = await f.app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        sessionId: "session",
        courseId: "course",
        message: "Explain atomic update",
        materialIds: ["public"],
      },
    });
    assert.equal(answer.statusCode, 200);
    assert.match(answer.body, /event: done/);
    const stored = f.records.sessions[0].messages;
    assert.equal(stored.length, 2);
    assert.equal(stored[1].sources[0].page, 3);
    assert.match(stored[1].content, /unverified source/);
    f.records.courseware.push({
      id: "draft",
      courseId: "course",
      teacherId: "teacher",
      deck: deck(),
      html: deckHtml(deck()),
      materialIds: ["public"],
    });
    const studentRead = await f.app.inject("/api/courseware/draft");
    assert.equal(studentRead.statusCode, 404);
    const invalidEdit = await f.app.inject({
      method: "PATCH",
      url: "/api/courseware/draft",
      headers: { "x-role": "teacher" },
      payload: {
        deck: {
          ...deck(),
          slides: [
            { ...slide(), sources: [{ materialId: "private", page: 1 }] },
          ],
        },
      },
    });
    assert.equal(invalidEdit.statusCode, 400);
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
    await f.close();
  }
});

test("chat and generation accept repeat requests despite legacy quota settings", async () => {
  const f = await fixture(),
    original = globalThis.fetch;
  const old = {
    key: process.env.H2A_LLM_API_KEY,
    chat: process.env.H2A_DAILY_CHAT_LIMIT,
    generation: process.env.H2A_DAILY_GENERATION_LIMIT,
  };
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  process.env.H2A_DAILY_CHAT_LIMIT = "1";
  process.env.H2A_DAILY_GENERATION_LIMIT = "1";
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return new Response(
        'data: {"choices":[{"delta":{"content":"Answer [S1]."}}]}\n\ndata: [DONE]\n\n',
      );
    }) as typeof fetch;
    const chat = {
      sessionId: "session",
      courseId: "course",
      message: "Explain update",
      materialIds: ["public"],
    };
    assert.equal(
      (await f.app.inject({ method: "POST", url: "/api/chat", payload: chat }))
        .statusCode,
      200,
    );
    const repeated = await f.app.inject({
      method: "POST",
      url: "/api/chat",
      payload: chat,
    });
    assert.equal(repeated.statusCode, 200);
    assert.equal(calls, 2);
    assert.equal(f.records.sessions[0].messages.length, 4);
    const courseware = {
      method: "POST",
      url: "/api/courseware",
      headers: { "x-role": "teacher" },
      payload: { courseId: "course", topic: "Atomic transactions" },
    } as const;
    assert.equal((await f.app.inject(courseware)).statusCode, 202);
    assert.equal((await f.app.inject(courseware)).statusCode, 202);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) AS n FROM ai_jobs").get() as any).n,
      2,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
    for (const [env, value] of [
      ["H2A_LLM_API_KEY", old.key],
      ["H2A_DAILY_CHAT_LIMIT", old.chat],
      ["H2A_DAILY_GENERATION_LIMIT", old.generation],
    ]) {
      if (value === undefined) delete process.env[env!];
      else process.env[env!] = value;
    }
    await f.close();
  }
});

test("queued courseware generates a private editable draft, publishes a real file, and visualization persists with its message", async () => {
  const f = await fixture(),
    original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  let providerCalls = 0;
  const teacher = { "x-role": "teacher" };
  try {
    globalThis.fetch = (async (_url, init) => {
      providerCalls++;
      const input = JSON.parse(String(init?.body));
      const result = input.response_format.json_schema.schema.properties.slides
        ? slideDeck(3, {
            lang: "zh",
            title: "数据库并发",
            text: "两个请求同时读取库存",
            notes: "提问：哪一步丢失了更新？",
          })
        : visual();
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(result) } }],
        }),
      );
    }) as typeof fetch;
    const start = await f.app.inject({
      method: "POST",
      url: "/api/courseware",
      headers: teacher,
      payload: {
        courseId: "course",
        materialIds: ["public"],
        topic: "Atomic transactions",
        language: "zh-CN",
        style: "genspark_college",
        slideCount: 3,
      },
    });
    assert.equal(start.statusCode, 202);
    const jobId = start.json().jobId;
    assert.equal((await f.app.inject(`/api/jobs/${jobId}`)).statusCode, 404);
    const waitFor = async (
      id: string,
      headers: Record<string, string> = {},
    ) => {
      const until = Date.now() + 5000;
      while (Date.now() < until) {
        const response = await f.app.inject({
          url: `/api/jobs/${id}`,
          headers,
        });
        const job = response.json().job;
        if (job.status === "succeeded" || job.status === "failed") return job;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error("Job did not complete");
    };
    const job = await waitFor(jobId, teacher);
    assert.equal(job.status, "succeeded", job.error);
    const draft = f.records.courseware[0];
    assert.equal(draft.status, "draft");
    assert.equal(draft.deck.format, "slidemaker");
    assert.equal(draft.deck.style, "genspark_college");
    assert.equal(draft.deck.lang, "zh");
    assert.deepEqual(draft.deck.slides[1].sources, [
      { materialId: "public", page: 3 },
    ]);
    assert.match(draft.html, /Content-Security-Policy/);
    assert.doesNotMatch(draft.html, /@font-face/);
    assert.equal(f.records.materials.length, 2);
    assert.equal(
      (await f.app.inject(`/api/courseware/${draft.id}`)).statusCode,
      404,
    );
    f.records.materials[0].archivedAt = new Date().toISOString();
    const legacyEdit = await f.app.inject({
      method: "PATCH",
      url: `/api/courseware/${draft.id}`,
      headers: teacher,
      payload: { deck: deck() },
    });
    assert.equal(legacyEdit.statusCode, 400);
    const tooLong = structuredClone(draft.deck);
    tooLong.slides[1].fields.items[0].body = "x".repeat(400);
    const overflow = await f.app.inject({
      method: "PATCH",
      url: `/api/courseware/${draft.id}`,
      headers: teacher,
      payload: { deck: tooLong },
    });
    assert.equal(overflow.statusCode, 400);
    assert.match(overflow.json().message, /too long|max|chars/i);
    const edited = structuredClone(draft.deck);
    edited.title = "Edited title";
    edited.style = "default";
    const save = await f.app.inject({
      method: "PATCH",
      url: `/api/courseware/${draft.id}`,
      headers: teacher,
      payload: { deck: edited },
    });
    assert.equal(save.statusCode, 200, save.body);
    const exportFile = await f.app.inject({
      url: `/api/courseware/${draft.id}/pptx`,
      headers: teacher,
    });
    assert.equal(exportFile.statusCode, 200);
    assert.match(exportFile.headers["content-type"]!, /presentationml/);
    assert.equal(exportFile.rawPayload.subarray(0, 2).toString(), "PK");
    const published = await f.app.inject({
      method: "POST",
      url: `/api/courseware/${draft.id}/publish`,
      headers: teacher,
    });
    assert.equal(published.statusCode, 200, published.body);
    const material = published.json().material;
    assert.equal(material.ownerId, null);
    assert.equal(material.type, "pptx");
    assert.equal(material.hasOriginal, true);
    assert.equal(material.filePath, undefined);
    assert.equal(
      (
        await readFile(
          f.records.materials.find((item) => item.id === material.id).filePath,
        )
      )
        .subarray(0, 2)
        .toString(),
      "PK",
    );
    await f.app.inject({
      method: "POST",
      url: `/api/courseware/${draft.id}/publish`,
      headers: teacher,
    });
    assert.equal(f.records.materials.length, 3);
    assert.equal(providerCalls, 1);
    f.records.materials[0].archivedAt = null;
    f.records.sessions[0].messages = [
      {
        id: "answer",
        role: "assistant",
        content: "Use an atomic transaction.",
      },
    ];
    f.records.notes = [
      {
        id: "saved-note",
        courseId: "course",
        studentId: "student",
        sourceSessionId: "session",
        sourceMessageId: "answer",
        title: "My existing note",
        content: "My own explanation.",
      },
    ];
    f.records.market = [
      {
        id: "published-snapshot",
        sourceSessionId: "session",
        sourceMessageId: "answer",
        content: "Published version.",
      },
    ];
    const visualization = await f.app.inject({
      method: "POST",
      url: "/api/visualizations",
      payload: {
        courseId: "course",
        sessionId: "session",
        messageId: "answer",
        prompt: "Show the stock update",
        materialIds: ["public"],
      },
    });
    assert.equal(visualization.statusCode, 202);
    const visualJob = await waitFor(visualization.json().jobId);
    assert.equal(visualJob.status, "succeeded", visualJob.error);
    assert.match(visualJob.result.html, /id="timeline"/);
    assert.equal(visualJob.result.messageId, "answer");
    assert.equal(
      f.records.sessions[0].messages[0].visualizationHtml,
      visualJob.result.html,
    );
    assert.equal(providerCalls, 2);
    assert.equal(f.records.notes[0].visualizationHtml, visualJob.result.html);
    assert.equal(f.records.notes[0].animation, "html");
    assert.equal(f.records.notes[0].hasAnimation, true);
    assert.equal(f.records.notes[0].content, "My own explanation.");
    assert.equal(f.records.market[0].visualizationHtml, undefined);
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
    await f.close();
  }
});

test("course board summarizes only sessions the teacher may still read", async () => {
  const f = await fixture(),
    original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  const teacher = { "x-role": "teacher" };
  const prompts: string[] = [];
  f.records.sessions = [
    {
      id: "session",
      courseId: "course",
      studentId: "student",
      messages: [{ role: "user", content: "How does an atomic update work?" }],
    },
    {
      id: "dropped",
      courseId: "course",
      studentId: "former",
      messages: [{ role: "user", content: "Former student question" }],
    },
  ];
  (f.app as any).folio.canReadSession = (_u: any, s: any) =>
    s.studentId === "student";
  try {
    globalThis.fetch = (async (_url, init) => {
      const input = JSON.parse(String(init?.body));
      prompts.push(input.messages.map((m: any) => m.content).join("\n"));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  quiet: true,
                  summary: "Nothing recurs yet.",
                  themes: [],
                }),
              },
            },
          ],
        }),
      );
    }) as typeof fetch;
    const start = await f.app.inject({
      method: "POST",
      url: "/api/courses/course/board",
      headers: teacher,
      payload: {},
    });
    assert.equal(start.statusCode, 202, start.body);
    const until = Date.now() + 5000;
    let job: any;
    while (Date.now() < until) {
      job = (
        await f.app.inject({
          url: `/api/jobs/${start.json().jobId}`,
          headers: teacher,
        })
      ).json().job;
      if (job.status === "succeeded" || job.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(job.status, "succeeded", job.error);
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /atomic update/);
    assert.doesNotMatch(prompts[0], /Former student/);
    assert.equal(job.result.board.sessionCount, 1);
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
    await f.close();
  }
});

test("knowledge cards come from the student's own notes and stay private", async () => {
  const f = await fixture(),
    original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  const prompts: string[] = [];
  try {
    globalThis.fetch = (async (_url, init) => {
      const input = JSON.parse(String(init?.body));
      prompts.push(input.messages.map((m: any) => m.content).join("\n"));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  cards: [
                    { term: "Race condition", meaning: "Timing changes the result.", example: "Two shoppers grab the last cake.", source: "N1" },
                    { term: "Mutex", meaning: "One worker enters at a time.", example: "One key for one room.", source: "N1" },
                    { term: "Atomic update", meaning: "Check and change happen together.", example: "A vending machine drops one can.", source: "N1" },
                  ],
                }),
              },
            },
          ],
        }),
      );
    }) as typeof fetch;
    const teacher = await f.app.inject({
      method: "POST",
      url: "/api/cards",
      headers: { "x-role": "teacher" },
    });
    assert.equal(teacher.statusCode, 403);
    f.records.notes = [];
    assert.equal(
      (await f.app.inject({ method: "POST", url: "/api/cards" })).statusCode,
      409,
    );
    f.records.notes = [
      {
        id: "mine",
        courseId: "course",
        studentId: "student",
        title: "Race conditions",
        content: "Two requests read stock 1 before either one writes it back.",
      },
      {
        id: "theirs",
        courseId: "course",
        studentId: "other",
        title: "Someone else",
        content: "Another student's private explanation of deadlocks.",
      },
    ];
    assert.deepEqual(
      (await f.app.inject("/api/cards")).json(),
      { deck: null },
    );
    const start = await f.app.inject({ method: "POST", url: "/api/cards" });
    assert.equal(start.statusCode, 202, start.body);
    const until = Date.now() + 5000;
    let job: any;
    while (Date.now() < until) {
      job = (await f.app.inject(`/api/jobs/${start.json().jobId}`)).json().job;
      if (job?.status === "succeeded" || job?.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(job.status, "succeeded", job.error);
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /Two requests read stock/);
    assert.doesNotMatch(prompts[0], /deadlocks/);
    const deck = (await f.app.inject("/api/cards")).json().deck;
    assert.deepEqual(
      deck.cards.map((card: any) => [card.term, card.noteId]),
      [
        ["Race condition", "mine"],
        ["Mutex", "mine"],
        ["Atomic update", "mine"],
      ],
    );
    assert.equal(deck.recentTerms, undefined);
    assert.equal(
      (
        await f.app.inject({
          url: `/api/jobs/${start.json().jobId}`,
          headers: { "x-role": "teacher" },
        })
      ).statusCode,
      404,
    );
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
    await f.close();
  }
});

test("courseware generation repairs slides that overflow their layout", async () => {
  const f = await fixture(),
    original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  const prompts: string[] = [];
  try {
    globalThis.fetch = (async (_url, init) => {
      const input = JSON.parse(String(init?.body));
      prompts.push(input.messages.at(-1).content);
      const result =
        prompts.length === 1 ? slideDeck(4, { text: "x".repeat(400) }) : slideDeck(4);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }),
      );
    }) as typeof fetch;
    const start = await f.app.inject({
      method: "POST",
      url: "/api/courseware",
      headers: { "x-role": "teacher" },
      payload: { courseId: "course", materialIds: ["public"], topic: "Atomicity", slideCount: 4 },
    });
    assert.equal(start.statusCode, 202, start.body);
    const until = Date.now() + 5000;
    let job: any;
    while (Date.now() < until) {
      job = (
        await f.app.inject({ url: `/api/jobs/${start.json().jobId}`, headers: { "x-role": "teacher" } })
      ).json().job;
      if (job.status === "succeeded" || job.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(job.status, "succeeded", job.error);
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /Repair the previous response/);
    assert.match(prompts[1], /400 chars, too long/);
    assert.equal(f.records.courseware[0].deck.slides.length, 4);
    assert.equal(f.records.courseware[0].deck.style, "default");
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
    await f.close();
  }
});

test("course ingest writes linked pages and an overview, fills a thin wiki, and rebuild replaces only generated pages", async () => {
  const f = await fixture(),
    original = globalThis.fetch,
    oldKey = process.env.H2A_LLM_API_KEY;
  process.env.H2A_LLM_API_KEY = "mock-test-key";
  const prompts: string[] = [];
  let titles = ["Atomic update", "Lost update"];
  try {
    globalThis.fetch = (async (_url, init) => {
      const input = JSON.parse(String(init?.body));
      const prompt = input.messages.map((m: any) => m.content).join("\n");
      prompts.push(prompt);
      const [a, b] = titles;
      const page = (title: string, other: string, extra = "") => ({
        action: "create",
        matchTitle: "",
        type: "concept",
        title,
        summary: `${title} in one line.`,
        tags: ["database", "concurrency"],
        body: `${title} is explained here. It is the answer to a [[${other}]].${extra}\n\n## Example\n\n| Step | Stock |\n| --- | --- |\n| Read | 1 |`,
        openQuestions: [],
        links: [other],
        relationships: [],
      });
      const second = /second pass of a whole-course ingest/.test(prompt);
      const plan = second
        ? {
            worthSaving: true,
            reason: "More concepts.",
            takeaways: "",
            overview: "",
            pages: [
              page("Row lock", a),
              page(a, b),
              { ...page("Mutex", a), action: "update", matchTitle: a },
            ],
          }
        : {
            worthSaving: true,
            reason: "The course defines both ideas.",
            takeaways: "Two connected database pages.",
            overview: `The course is about safe updates.\n\n## Core ideas\n\n- [[${a}]]\n- [[${b}]]`,
            pages: [page(a, b, " A [[Row lock]] is the other option."), page(b, a)],
          };
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }),
      );
    }) as typeof fetch;
    f.records.notes = [
      { id: "wiki-root", wikiRoot: true, courseId: "course", studentId: "student", title: "Databases", content: "# Databases\n\n", tags: [], links: [] },
    ];
    const run = async (body: Record<string, unknown>) => {
      const start = await f.app.inject({ method: "POST", url: "/api/wiki/ingest", payload: { courseId: "course", wikiId: "wiki-root", ...body } });
      assert.equal(start.statusCode, 202, start.body);
      const until = Date.now() + 5000;
      let job: any;
      while (Date.now() < until) {
        job = (await f.app.inject(`/api/jobs/${start.json().jobId}`)).json().job;
        if (job?.status === "succeeded" || job?.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.equal(job.status, "succeeded", job.error);
      return job.result;
    };
    const teacher = await f.app.inject({ method: "POST", url: "/api/wiki/ingest", headers: { "x-role": "teacher" }, payload: { courseId: "course", wikiId: "wiki-root" } });
    assert.equal(teacher.statusCode, 403);

    const first = await run({});
    // Two pages is too thin, so a second pass writes the linked "Row lock".
    assert.equal(prompts.length, 2);
    assert.match(prompts[0], /\(page 3\) Atomic update prevents overselling/);
    assert.match(prompts[0], /plan 8 to 12 pages/);
    assert.doesNotMatch(prompts[0], /Private text/);
    assert.match(prompts[1], /titled exactly: Row lock/);
    assert.match(prompts[1], /Pages already written: Atomic update; Lost update/);
    assert.equal(first.created, 3);
    const pages = () => f.records.notes.filter((note) => !note.ledger && !note.wikiRoot);
    assert.deepEqual(pages().map((note) => note.title).sort(), ["Atomic update", "Lost update", "Row lock"]);
    const atomic = pages().find((note) => note.title === "Atomic update");
    const lost = pages().find((note) => note.title === "Lost update");
    const lock = pages().find((note) => note.title === "Row lock");
    assert.match(atomic.content, /answer to a \[\[Lost update\]\]\. A \[\[Row lock\]\] is the other option/);
    assert.match(atomic.content, /\| Step \| Stock \|/);
    assert.deepEqual(new Set(atomic.links), new Set([lost.id, lock.id]));
    const root = f.records.notes.find((note) => note.id === "wiki-root");
    assert.match(root.content, /^# Databases\n\nThe course is about safe updates\./);
    assert.match(root.content, /## More pages\n- \[\[Row lock\]\]/);
    assert.deepEqual(new Set(root.links), new Set([atomic.id, lost.id, lock.id]));

    // A repeat ingest reuses the result without another paid call.
    assert.equal((await run({})).already, true);
    assert.equal(prompts.length, 2);

    // A saved chat answer also fed "Lost update", so a rebuild keeps it.
    lost.wiki.sourceKeys = [...lost.wiki.sourceKeys, "agent:folio/session/m1"];
    titles = ["Optimistic lock", "Lost update"];
    const rebuilt = await run({ rebuild: true });
    assert.equal(prompts.length, 4);
    assert.equal(rebuilt.created, 2);
    assert.equal(rebuilt.updated, 1);
    assert.deepEqual(pages().map((note) => note.title).sort(), ["Lost update", "Optimistic lock", "Row lock"]);
    assert.equal(f.records.notes.some((note) => note.id === atomic.id || note.id === lock.id), false);
    assert.equal(pages().find((note) => note.title === "Lost update").id, lost.id);
    const manifest = f.records.notes.find((note) => note.ledger === "manifest");
    assert.deepEqual(
      manifest.manifest.sources["agent:folio/ingest/wiki-root"].pages_produced.sort(),
      ["concepts/lost-update.md", "concepts/optimistic-lock.md", "concepts/row-lock.md"],
    );
    assert.match(f.records.notes.find((note) => note.id === "wiki-root").content, /\[\[Optimistic lock\]\]/);
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.H2A_LLM_API_KEY;
    else process.env.H2A_LLM_API_KEY = oldKey;
    await f.close();
  }
});
