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
    assert.equal(sent.model, process.env.H2A_LLM_MODEL || "qwen/qwen3.6-plus");
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

test("durable AI budgets isolate accounts and reset on the next UTC day", () => {
  const db = new Database(":memory:"),
    oldLimit = process.env.H2A_DAILY_CHAT_LIMIT;
  process.env.H2A_DAILY_CHAT_LIMIT = "1";
  let clock = Date.parse("2026-10-17T23:59:59Z");
  try {
    const first = createUsageMeter(db, () => clock);
    first.consume("student-a", "chat");
    const resumed = createUsageMeter(db, () => clock);
    assert.throws(
      () => resumed.consume("student-a", "chat"),
      (error: any) => error.statusCode === 429,
    );
    resumed.consume("student-b", "chat");
    resumed.consume("student-a", "generation");
    clock += 2000;
    resumed.consume("student-a", "chat");
    assert.equal(
      (db.prepare("SELECT SUM(count) AS n FROM ai_usage").get() as any).n,
      4,
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

test("daily quota rejection happens before paid provider calls or new jobs", async () => {
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
    const limited = await f.app.inject({
      method: "POST",
      url: "/api/chat",
      payload: chat,
    });
    assert.equal(limited.statusCode, 429);
    assert.equal(calls, 1);
    assert.equal(f.records.sessions[0].messages.length, 2);
    const courseware = {
      method: "POST",
      url: "/api/courseware",
      headers: { "x-role": "teacher" },
      payload: { courseId: "course", topic: "Atomic transactions" },
    } as const;
    assert.equal((await f.app.inject(courseware)).statusCode, 202);
    assert.equal((await f.app.inject(courseware)).statusCode, 429);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) AS n FROM ai_jobs").get() as any).n,
      1,
    );
    assert.equal(calls, 1);
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
        ? deck()
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
        slideCount: 2,
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
    assert.equal(f.records.materials.length, 2);
    assert.equal(
      (await f.app.inject(`/api/courseware/${draft.id}`)).statusCode,
      404,
    );
    f.records.materials[0].archivedAt = new Date().toISOString();
    const edited = deck();
    edited.title = "Edited title";
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
