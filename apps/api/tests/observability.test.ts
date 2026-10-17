import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeObservability,
  withObservation,
  flushObservability,
  shutdownObservability,
  safeMetadata,
} from "../src/observability.js";
import { complete, streamCompletion } from "../src/ai/provider.js";

test("optional tracing preserves privacy, nests async model calls, and accounts for streamed failures", async () => {
  const savedEnv = { ...process.env },
    originalFetch = globalThis.fetch;
  const spans: any[] = [];
  let failExport = false;
  try {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    assert.equal(initializeObservability(), false);
    assert.equal(await withObservation("Disabled", {}, () => 42), 42);
    process.env.LANGFUSE_PUBLIC_KEY = "synthetic-public-key";
    process.env.LANGFUSE_SECRET_KEY = "synthetic-secret-key";
    process.env.LANGFUSE_TRACING_ENVIRONMENT = "test";
    delete process.env.LANGFUSE_ENABLED;
    process.env.H2A_LLM_API_KEY = "synthetic-model-key";
    process.env.H2A_LLM_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.H2A_LLM_MODEL = "qwen/test-accounting";
    assert.equal(
      initializeObservability({
        exporter: {
          export(batch, callback) {
            if (failExport)
              return callback({
                code: 1,
                error: new Error("synthetic export outage"),
              });
            spans.push(...batch);
            callback({ code: 0 });
          },
          async shutdown() {},
        },
      }),
      true,
    );
    const secretText = "PRIVATE raw student dialogue sk-should-never-appear";
    let mode = "complete",
      requests = 0;
    globalThis.fetch = (async (url, options) => {
      if (String(url).endsWith("/models"))
        return Response.json({
          data: [
            {
              id: "qwen/test-accounting",
              pricing: { prompt: "0.000001", completion: "0.000002" },
            },
          ],
        });
      assert.equal(
        String(url),
        "https://openrouter.ai/api/v1/chat/completions",
      );
      requests++;
      assert.match(String(options?.body), /PRIVATE raw student dialogue/);
      if (mode === "complete")
        return Response.json({
          id: "gen-test-complete",
          model: "qwen/test-accounting",
          provider: "Synthetic",
          choices: [
            { message: { content: secretText }, finish_reason: "stop" },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
            prompt_tokens_details: { cached_tokens: 60 },
            completion_tokens_details: { reasoning_tokens: 5 },
            cost: 0.00123,
          },
        });
      if (mode === "failure")
        return new Response("PRIVATE provider rejection", { status: 500 });
      const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
      return new Response(
        event({
          model: "qwen/test-accounting",
          choices: [{ delta: { content: "Synthetic answer" } }],
        }) +
          (mode === "interrupted"
            ? ""
            : event({
                choices: [],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 3,
                  total_tokens: 13,
                  cost: mode === "stream" ? 0 : 0.0001,
                },
                ...(mode === "streamError"
                  ? { error: { message: secretText } }
                  : {}),
              })) +
          (mode === "stream" ? "data: [DONE]" : ""),
      );
    }) as typeof fetch;
    let rootTraceId: string | undefined;
    await withObservation(
      "Course Chat",
      {
        userId: "internal-user-id",
        sessionId: "internal-session",
        metadata: { courseId: "course-test", rawPrompt: secretText },
      },
      async (root) => {
        rootTraceId = root.traceId;
        root.update({
          input: secretText,
          output: secretText,
          metadata: { wallet: secretText },
        });
        await withObservation(
          "Retrieve Materials",
          { type: "retriever", metadata: { evidenceCount: 2 } },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 1));
          },
        );
        assert.equal(
          await complete([{ role: "user", content: secretText }]),
          secretText,
        );
        mode = "stream";
        assert.equal(
          await streamCompletion(
            [{ role: "user", content: secretText }],
            () => {},
          ),
          "Synthetic answer",
        );
        mode = "streamError";
        await assert.rejects(
          streamCompletion([{ role: "user", content: secretText }], () => {}),
          /stopped generating/,
        );
        mode = "interrupted";
        await assert.rejects(
          streamCompletion([{ role: "user", content: secretText }], () => {}),
          /interrupted/,
        );
        mode = "failure";
        await assert.rejects(
          complete([{ role: "user", content: secretText }]),
          /could not complete/,
        );
        const sensitiveError = new Error(secretText);
        await assert.rejects(
          withObservation("Validation", {}, () => {
            throw sensitiveError;
          }),
          (e) => e === sensitiveError,
        );
      },
    );
    assert.equal(requests, 5, "Tracing must never repeat a paid call");
    assert.equal(await flushObservability(), true);
    const generation = spans.filter((span) => span.name === "Model Call");
    assert.equal(generation.length, 5);
    const root = spans.find((span) => span.name === "Course Chat");
    for (const span of spans)
      assert.equal(span.spanContext().traceId, rootTraceId);
    for (const span of generation)
      assert.equal(span.parentSpanContext.spanId, root.spanContext().spanId);
    const attributes = generation[0].attributes;
    const usage = JSON.parse(attributes["langfuse.observation.usage_details"]);
    assert.deepEqual(usage, {
      input: 40,
      input_cached_tokens: 60,
      output: 15,
      output_reasoning_tokens: 5,
      total: 120,
    });
    assert.deepEqual(
      JSON.parse(attributes["langfuse.observation.cost_details"]),
      { total: 0.00123 },
    );
    assert.equal(
      JSON.parse(attributes["langfuse.observation.metadata.pricing"]).model,
      "qwen/test-accounting",
    );
    assert.equal(
      attributes["langfuse.observation.model.name"],
      "qwen/test-accounting",
    );
    assert.deepEqual(
      JSON.parse(generation[1].attributes["langfuse.observation.cost_details"]),
      { total: 0 },
    );
    assert.equal(
      generation[2].attributes["langfuse.observation.level"],
      "ERROR",
    );
    assert.deepEqual(
      JSON.parse(generation[2].attributes["langfuse.observation.cost_details"]),
      { total: 0.0001 },
    );
    assert.equal(
      generation[3].attributes["langfuse.observation.metadata.costSource"],
      '"unknown"',
    );
    assert.equal(
      generation[3].attributes["langfuse.observation.cost_details"],
      undefined,
    );
    assert.equal(
      generation[4].attributes["langfuse.observation.level"],
      "ERROR",
    );
    const payload = JSON.stringify(
      spans.map((span) => ({
        attributes: span.attributes,
        events: span.events,
        status: span.status,
      })),
    );
    assert.doesNotMatch(
      payload,
      /PRIVATE|should-never-appear|synthetic-model-key|internal-user-id|internal-session/,
    );
    assert.deepEqual(
      safeMetadata({
        inputCharacters: 12,
        studentNumber: "1234",
        wallet: "0xabc",
        pricing: { model: "qwen/test", apiKey: secretText },
      }),
      { inputCharacters: 12, pricing: { model: "qwen/test" } },
    );
    failExport = true;
    assert.equal(
      await withObservation(
        "Outage Check",
        {},
        () => "application still works",
      ),
      "application still works",
    );
    assert.equal(await flushObservability(), false);
  } finally {
    globalThis.fetch = originalFetch;
    await shutdownObservability();
    for (const key of Object.keys(process.env))
      if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});
