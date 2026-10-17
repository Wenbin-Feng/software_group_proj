import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import Fastify from "fastify";
import { registerAiRoutes } from "../src/ai/routes.js";
import {
  flushObservability,
  initializeObservability,
  shutdownObservability,
} from "../src/observability.js";

// This collector never sends the synthetic fixture or credentials to a cloud service.
test("workflow traces preserve hierarchy, suppress private content, and do not regenerate saved jobs", async () => {
  const spans: any[] = [];
  const env = {
    H2A_LLM_API_KEY: "mock-test-key",
    LANGFUSE_PUBLIC_KEY: "test-public",
    LANGFUSE_SECRET_KEY: "test-secret",
    LANGFUSE_BASE_URL: "https://example.invalid",
    LANGFUSE_TRACING_ENVIRONMENT: "test",
    LANGFUSE_ENABLED: "true",
  };
  const previous = new Map(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  const db = new Database(":memory:");
  const dataDir = await mkdtemp(path.join(tmpdir(), "folio-traces-"));
  const app = Fastify();
  let calls = 0;
  let rejectProvider = false;
  let releaseChat = () => {};
  const chatGate = new Promise<void>((resolve) => {
    releaseChat = resolve;
  });
  const teacher = {
    id: "teacher-internal-id",
    role: "teacher",
    name: "PRIVATE_PROFILE_NAME",
  };
  const student = {
    id: "student-internal-id",
    role: "student",
    name: "PRIVATE_STUDENT_NAME",
    studentNumber: "PRIVATE_STUDENT_NUMBER",
  };
  const slide = {
    title: "PRIVATE_MODEL_OUTPUT",
    body: ["PRIVATE_MATERIAL_TEXT"],
    layout: "content",
    secondary: [],
    table: [],
    notes: "PRIVATE_TEACHER_NOTES",
    sources: [{ materialId: "material-internal-id", page: 3 }],
  };
  const deck = { title: "PRIVATE_DECK_TITLE", language: "en", slides: [slide] };
  const visual = {
    title: "PRIVATE_VISUALIZATION_TITLE",
    summary: "PRIVATE_EXPLANATION",
    steps: [
      {
        title: "Read",
        explanation: "Read the current value.",
        cards: [{ label: "Stock", value: "1", active: true }],
      },
      {
        title: "Update",
        explanation: "Perform an atomic update.",
        cards: [{ label: "Stock", value: "0", active: true }],
      },
    ],
    quiz: {
      question: "What preserves stock?",
      options: ["Atomic update", "Independent reads"],
      correctIndex: 0,
      explanation: "The condition and update execute together.",
    },
  };
  const records: Record<string, any[]> = {
    materials: [
      {
        id: "material-internal-id",
        courseId: "course-internal-id",
        name: "PRIVATE_MATERIAL_NAME.pdf",
        ownerId: null,
        pages: [{ page: 3, text: "PRIVATE_MATERIAL_TEXT atomic update" }],
      },
    ],
    sessions: [
      {
        id: "session-internal-id",
        courseId: "course-internal-id",
        studentId: student.id,
        messages: [],
      },
    ],
    courseware: [],
    visualizations: [],
  };
  (app as any).folio = {
    db,
    dataDir,
    requireUser: (request: any) =>
      request.headers["x-role"] === "teacher" ? teacher : student,
    userById: (id: string) => (id === teacher.id ? teacher : student),
    canReadCourse: (_user: any, id: string) => id === "course-internal-id",
    canTeach: (user: any, id: string) =>
      user.role === "teacher" && id === "course-internal-id",
    canReadMaterial: (user: any, material: any) =>
      !material.ownerId || material.ownerId === user.id,
    canReadSession: (user: any, session: any) =>
      user.role === "teacher" || session.studentId === user.id,
    canReadNote: (user: any, note: any) => note.studentId === user.id,
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
  const until = async (condition: () => boolean) => {
    const deadline = Date.now() + 6000;
    while (!condition()) {
      assert.ok(
        Date.now() < deadline,
        "Expected workflow progress before timeout",
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const waitForJob = async (id: string) => {
    await until(() => {
      const row = db
        .prepare("SELECT status FROM ai_jobs WHERE id=?")
        .get(id) as any;
      return row?.status === "succeeded" || row?.status === "failed";
    });
    const row = db
      .prepare("SELECT status,error FROM ai_jobs WHERE id=?")
      .get(id) as any;
    assert.equal(row.status, "succeeded", row.error);
  };
  try {
    assert.equal(
      initializeObservability({
        exporter: {
          export(batch, callback) {
            spans.push(...batch);
            callback({ code: 0 });
          },
          async shutdown() {},
        },
      }),
      true,
    );
    globalThis.fetch = (async (url, init) => {
      if (String(url).endsWith("/models"))
        return new Response(JSON.stringify({ data: [] }));
      calls++;
      if (rejectProvider)
        return new Response("PRIVATE_PROVIDER_ERROR_PAYLOAD", { status: 500 });
      const body = JSON.parse(String(init?.body));
      if (body.stream) {
        await chatGate;
        return new Response(
          'data: {"model":"qwen/qwen3.6-plus","choices":[{"delta":{"content":"PRIVATE_CHAT_ANSWER [S1]"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":40,"completion_tokens":10,"total_tokens":50,"cost":0.0001}}\n\ndata: [DONE]\n\n',
        );
      }
      return new Response(
        JSON.stringify({
          model: "qwen/qwen3.6-plus",
          choices: [
            {
              message: {
                content: JSON.stringify(
                  body.response_format.json_schema.schema.properties.slides
                    ? deck
                    : visual,
                ),
              },
            },
          ],
          usage: {
            prompt_tokens: 40,
            completion_tokens: 10,
            total_tokens: 50,
            cost: 0.0001,
          },
        }),
      );
    }) as typeof fetch;
    await registerAiRoutes(app);
    await app.ready();
    const chatPayload = {
      sessionId: "session-internal-id",
      courseId: "course-internal-id",
      message: "PRIVATE_CHAT_REQUEST",
      materialIds: ["material-internal-id"],
    };
    const firstChat = app.inject({
      method: "POST",
      url: "/api/chat",
      payload: chatPayload,
    });
    await until(() => calls === 1);
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: chatPayload,
    });
    assert.equal(duplicate.statusCode, 409);
    releaseChat();
    assert.match((await firstChat).body, /event: done/);

    const start = await app.inject({
      method: "POST",
      url: "/api/courseware",
      headers: { "x-role": "teacher" },
      payload: {
        courseId: "course-internal-id",
        materialIds: ["material-internal-id"],
        topic: "PRIVATE_COURSEWARE_REQUEST",
        slideCount: 1,
      },
    });
    assert.equal(start.statusCode, 202);
    const coursewareId = start.json().jobId;
    await waitForJob(coursewareId);
    assert.equal(calls, 2);

    // Simulate recovery after output persistence but before marking a job complete.
    db.prepare("UPDATE ai_jobs SET status='queued',attempts=0 WHERE id=?").run(
      coursewareId,
    );
    await waitForJob(coursewareId);
    assert.equal(
      calls,
      2,
      "Recovered saved output must not charge another model call",
    );

    const visualization = await app.inject({
      method: "POST",
      url: "/api/visualizations",
      payload: {
        courseId: "course-internal-id",
        sessionId: "session-internal-id",
        messageId: records.sessions[0].messages[1].id,
        prompt: "PRIVATE_VISUALIZATION_REQUEST",
        materialIds: ["material-internal-id"],
      },
    });
    assert.equal(visualization.statusCode, 202);
    await waitForJob(visualization.json().jobId);
    assert.equal(calls, 3);

    rejectProvider = true;
    const failedChat = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: chatPayload,
    });
    assert.match(failedChat.body, /event: error/);
    assert.doesNotMatch(failedChat.body, /PRIVATE_PROVIDER_ERROR_PAYLOAD/);
    await flushObservability();

    const roots = spans.filter((span) => !span.parentSpanContext?.spanId);
    const sameTrace = (root: any) =>
      spans.filter(
        (span) => span.spanContext().traceId === root.spanContext().traceId,
      );
    const rootNames = roots.map((span) => span.name);
    assert.equal(rootNames.filter((name) => name === "Course Chat").length, 2);
    assert.equal(
      rootNames.filter((name) => name === "Courseware Generation").length,
      2,
    );
    assert.equal(
      rootNames.filter((name) => name === "Visual Explanation").length,
      1,
    );
    const generated = roots.find(
      (root) =>
        root.name === "Courseware Generation" &&
        sameTrace(root).some((span) => span.name === "Model Call"),
    );
    assert.ok(
      generated,
      "Queued provider generation belongs to its business trace",
    );
    for (const name of [
      "Retrieve Materials",
      "Model Call",
      "Validate Courseware",
      "Render Courseware HTML",
    ]) {
      const child = sameTrace(generated).find((span) => span.name === name);
      assert.ok(child, `Missing ${name} child`);
      assert.equal(
        child.parentSpanContext?.spanId,
        generated.spanContext().spanId,
      );
    }
    const recovered = roots.find(
      (root) => root.name === "Courseware Generation" && root !== generated,
    );
    assert.deepEqual(
      sameTrace(recovered).map((span) => span.name),
      ["Courseware Generation"],
    );
    assert.ok(
      roots.some(
        (root) =>
          root.name === "Course Chat" &&
          root.attributes["langfuse.observation.level"] === "ERROR",
      ),
      "Internally handled SSE failure must mark the business trace as failed",
    );
    const exported = JSON.stringify(
      spans.map((span) => ({
        name: span.name,
        attributes: span.attributes,
        events: span.events,
      })),
    );
    assert.doesNotMatch(
      exported,
      /PRIVATE_|mock-test-key|test-secret|teacher-internal-id|student-internal-id|session-internal-id/,
    );
  } finally {
    releaseChat();
    await app.close();
    db.close();
    await shutdownObservability();
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
