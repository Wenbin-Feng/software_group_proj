import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Explicit opt-in: this script makes two real, billable model requests. It is never
// part of npm test, browser tests, CI, or deployment verification.
const verificationTrace = process.argv
  .find((arg) => arg.startsWith("--trace-id="))
  ?.slice(11);
if (verificationTrace && !/^[0-9a-f]{32}$/.test(verificationTrace))
  throw new Error("Invalid test trace ID.");
if (!process.argv.includes("--run") && !verificationTrace) {
  console.log(
    "Opt-in live smoke test (two short, billable Qwen requests):\n" +
      "node --env-file=.env --import tsx scripts/test-langfuse.mjs --run\n" +
      "Read back an existing test without another paid call: add --trace-id=<ID> instead of --run",
  );
  process.exit(0);
}

class SmokeError extends Error {}
const check = (condition, message) => {
  if (!condition) throw new SmokeError(message);
};
const required = [
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_BASE_URL",
  ...(!verificationTrace ? ["H2A_LLM_API_KEY"] : []),
];
for (const key of required)
  check(
    process.env[key]?.trim(),
    `Missing required environment variable: ${key}`,
  );

// Force isolation even when the supplied env file is a production env file.
process.env.LANGFUSE_TRACING_ENVIRONMENT = "test";
process.env.LANGFUSE_ENABLED = "true";

let base;
try {
  base = new URL(process.env.LANGFUSE_BASE_URL);
} catch {
  throw new SmokeError("LANGFUSE_BASE_URL must be an absolute HTTPS URL.");
}
check(
  base.protocol === "https:" && !base.username && !base.password,
  "LANGFUSE_BASE_URL must use HTTPS without credentials in the URL.",
);
const expectedModel = process.env.H2A_LLM_MODEL || "qwen/qwen3.6-plus";
check(
  expectedModel.startsWith("qwen/"),
  "Live smoke test requires a Qwen model.",
);

const runId = randomUUID();
const startedAt = new Date(
  Date.now() - (verificationTrace ? 3_600_000 : 30_000),
).toISOString();
const inputMarker = `FOLIO_PRIVATE_INPUT_${runId}`;
const outputMarker = `FOLIO_PRIVATE_OUTPUT_${runId}`;
const prompts = [
  {
    role: "system",
    content:
      "This is a synthetic connectivity test. Follow the reply instruction exactly.",
  },
  {
    role: "user",
    content: `${inputMarker}. Reply with exactly this text, with no explanation: ${outputMarker}`,
  },
];
let phase = "initialization";
let observability;
let traceId = verificationTrace;
const deadline = setTimeout(() => {
  console.error(`Langfuse smoke test timed out during ${phase}.`);
  process.exit(1);
}, 240_000);

async function langfuseGet(path, parameters = {}) {
  const url = new URL(path, base.origin);
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`,
          ).toString("base64")}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status >= 500 && attempt < 2) {
          await delay(500);
          continue;
        }
        throw new SmokeError(
          `Langfuse read API returned HTTP ${response.status}.`,
        );
      }
      return response.json();
    } catch (error) {
      if (error instanceof SmokeError) throw error;
      if (attempt === 2)
        throw new SmokeError(
          "Langfuse read API was unreachable after bounded retries.",
        );
      await delay(500);
    }
  }
}

function metadataOf(row) {
  if (row.metadata && typeof row.metadata === "object") return row.metadata;
  try {
    return JSON.parse(row.metadata || "{}");
  } catch {
    throw new SmokeError("Langfuse returned invalid observation metadata.");
  }
}

function validateGeneration(row) {
  const metadata = metadataOf(row);
  check(
    row.name === "Model Call",
    "Generation has an unexpected display name.",
  );
  check(
    row.model === expectedModel,
    "Generation lost the configured model identifier.",
  );
  check(row.level !== "ERROR", "A real model request was marked as failed.");
  check(row.endTime, "Generation did not finish before export.");
  check(
    metadata.currency === "USD",
    "Generation cost currency was not recorded.",
  );
  check(
    metadata.usageStatus === "reported",
    "Provider token usage was not reported.",
  );
  check(
    metadata.costSource === "provider_reported",
    "Live OpenRouter request did not report its actual provider cost.",
  );
  const usage = row.usageDetails;
  check(
    usage && typeof usage === "object",
    "Generation token usage is missing.",
  );
  for (const count of Object.values(usage))
    check(
      Number.isSafeInteger(count) && count >= 0,
      "A token count is invalid.",
    );
  check(
    usage.total > 0,
    "Total token usage must be positive for a real request.",
  );
  const exclusiveTotal = Object.entries(usage).reduce(
    (sum, [key, value]) => sum + (key === "total" ? 0 : value),
    0,
  );
  check(
    exclusiveTotal === usage.total,
    "Token detail buckets double-count or omit reported tokens.",
  );
  if (typeof row.totalUsage === "number")
    check(
      row.totalUsage === usage.total,
      "Langfuse total usage disagrees with provider usage.",
    );
  const cost = row.costDetails?.total;
  check(
    Number.isFinite(cost) && cost > 0,
    "Actual provider cost was not ingested.",
  );
  if (typeof row.totalCost === "number")
    check(
      Math.abs(row.totalCost - cost) < Math.max(1e-12, cost * 1e-8),
      "Langfuse total cost disagrees with the ingested provider cost.",
    );
  // Langfuse v4's read API flattens nested metadata into dotted keys.
  const pricing =
    metadata.pricing ??
    Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => key.startsWith("pricing."))
        .map(([key, value]) => [key.slice(8), value]),
    );
  check(
    pricing?.model === row.model,
    "Unit pricing is missing its exact model identifier.",
  );
  check(pricing.currency === "USD", "Unit pricing is missing its currency.");
  check(
    pricing.source === "openrouter_models",
    "Unit pricing source was not recorded.",
  );
  check(
    Number.isFinite(Date.parse(pricing.capturedAt)),
    "Unit price snapshot time is missing.",
  );
  check(
    Number.isFinite(pricing.inputUsdPerMillion) &&
      pricing.inputUsdPerMillion > 0 &&
      Number.isFinite(pricing.outputUsdPerMillion) &&
      pricing.outputUsdPerMillion > 0,
    "Positive input/output prices per million tokens were not recorded.",
  );
  return {
    streaming: metadata.streaming === true,
    model: row.model,
    tokens: usage.total,
    actualCostUsd: cost,
    inputUsdPerMillion: pricing.inputUsdPerMillion,
    outputUsdPerMillion: pricing.outputUsdPerMillion,
  };
}

try {
  // Verify credentials/read permission before making either paid request.
  phase = "Langfuse API preflight";
  const projects = await langfuseGet("/api/public/projects");
  check(
    projects.data?.length > 0,
    "Langfuse credentials did not identify a project.",
  );
  await langfuseGet("/api/public/v2/observations", {
    traceId: "00000000000000000000000000000001",
    fromStartTime: startedAt,
    toStartTime: new Date(Date.now() + 30_000).toISOString(),
    fields: "core,basic",
    limit: 1,
  });

  if (!verificationTrace) {
    phase = "tracing initialization";
    observability = await import("../apps/api/src/observability.ts");
    check(
      observability.initializeObservability(),
      "Langfuse tracing did not initialize.",
    );
    const { complete, streamCompletion } =
      await import("../apps/api/src/ai/provider.ts");
    let streamed = "";
    await observability.withObservation(
      "Langfuse Integration Test",
      {
        userId: `synthetic-user-${runId}`,
        sessionId: `synthetic-session-${runId}`,
        metadata: { workflow: "integration_test", testRunId: runId },
      },
      async (root) => {
        traceId = root.traceId;
        check(
          /^[0-9a-f]{32}$/.test(traceId || ""),
          "SDK did not provide an active trace ID.",
        );
        phase = "non-streaming model request";
        const result = await observability.withObservation(
          "Nonstream Request",
          { metadata: { streaming: false } },
          () => complete(prompts, undefined, 1000),
        );
        check(
          result.includes(outputMarker),
          "Non-streaming Qwen response failed its synthetic check.",
        );
        phase = "streaming model request";
        const resultStream = await observability.withObservation(
          "Streaming Request",
          { metadata: { streaming: true } },
          () =>
            streamCompletion(prompts, (delta) => {
              streamed += delta;
            }),
        );
        check(
          resultStream === streamed,
          "Streaming callback lost or duplicated response text.",
        );
        check(
          resultStream.includes(outputMarker),
          "Streaming Qwen response failed its synthetic check.",
        );
      },
    );

    phase = "trace flush";
    check(
      await observability.flushObservability(),
      "Langfuse trace export failed.",
    );
  }
  phase = "Langfuse observation readback";
  const readbackDeadline = Date.now() + 90_000;
  let rows = [];
  // Flush confirms delivery; v4 read visibility can lag ingestion by several seconds.
  while (Date.now() < readbackDeadline) {
    const result = await langfuseGet("/api/public/v2/observations", {
      traceId,
      fromStartTime: startedAt,
      toStartTime: new Date(Date.now() + 30_000).toISOString(),
      fields: "core,basic,time,io,metadata,model,usage,trace_context",
      limit: 100,
    });
    rows = result.data || [];
    if (
      rows.length >= 5 &&
      rows.filter((row) => row.type === "GENERATION").length === 2
    )
      break;
    await delay(3000);
  }
  const roots = rows.filter((row) => !row.parentObservationId);
  check(roots.length === 1, "Readback did not contain exactly one trace root.");
  check(
    roots[0].name === "Langfuse Integration Test",
    "Trace root name was not preserved.",
  );
  check(
    rows.every((row) => row.traceId === traceId),
    "Observations escaped the expected trace.",
  );
  check(
    rows.every((row) => row.environment === "test"),
    "Live test escaped the test environment.",
  );
  check(
    rows.every((row) => row.input == null && row.output == null),
    "Prompt/output content was uploaded.",
  );
  check(
    !JSON.stringify(rows).includes(inputMarker) &&
      !JSON.stringify(rows).includes(outputMarker),
    "A synthetic private prompt/output marker leaked into trace metadata.",
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of rows) {
    const visited = new Set();
    let current = row;
    while (current.parentObservationId) {
      check(!visited.has(current.id), "Trace hierarchy contains a cycle.");
      visited.add(current.id);
      current = byId.get(current.parentObservationId);
      check(current, "Trace hierarchy contains an orphan observation.");
    }
    check(
      current.id === roots[0].id,
      "Observation is not nested beneath the test root.",
    );
  }
  const generations = rows.filter((row) => row.type === "GENERATION");
  check(generations.length === 2, "Both real model calls were not ingested.");
  const report = generations.map(validateGeneration);
  check(
    report.some((entry) => entry.streaming),
    "Streaming generation metadata is missing.",
  );
  check(
    report.some((entry) => !entry.streaming),
    "Non-streaming generation metadata is missing.",
  );
  console.log(
    JSON.stringify(
      {
        result: "passed",
        environment: "test",
        traceId,
        observations: rows.length,
        calls: report,
        totalActualCostUsd: report.reduce(
          (sum, entry) => sum + entry.actualCostUsd,
          0,
        ),
        promptAndOutputRecorded: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (traceId) console.error(`Test trace ID: ${traceId}`);
  console.error(
    error instanceof SmokeError
      ? `Langfuse smoke test failed during ${phase}: ${error.message}`
      : `Langfuse smoke test failed during ${phase}; inspect connectivity and configuration.`,
  );
  process.exitCode = 1;
} finally {
  phase = "tracing shutdown";
  try {
    await observability?.shutdownObservability();
  } catch {
    console.error("Langfuse tracing shutdown failed.");
    process.exitCode = 1;
  }
  clearTimeout(deadline);
}
