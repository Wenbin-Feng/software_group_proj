import { createHash } from "node:crypto";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  LangfuseSpanProcessor,
  type LangfuseSpanProcessorParams,
} from "@langfuse/otel";
import {
  startActiveObservation,
  propagateAttributes,
  type LangfuseGeneration,
  type LangfuseRetriever,
  type LangfuseSpan,
  type LangfuseGenerationAttributes,
} from "@langfuse/tracing";

export type Observation = {
  traceId?: string;
  update: (attributes: LangfuseGenerationAttributes) => void;
};
type ObservationOptions = {
  type?: "span" | "retriever" | "generation";
  metadata?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
};
type TracedObservation = LangfuseSpan | LangfuseRetriever | LangfuseGeneration;

let sdk: NodeSDK | undefined;
let processor: LangfuseSpanProcessor | undefined;
let stopped = false;
const noop: Observation = { update() {} };

const scalarKeys = new Set([
  "workflow",
  "courseId",
  "sessionId",
  "jobId",
  "attempt",
  "jobKind",
  "requestId",
  "materialCount",
  "evidenceCount",
  "slideCount",
  "language",
  "messageCount",
  "inputCharacters",
  "outputCharacters",
  "streaming",
  "structuredOutput",
  "provider",
  "providerRequestId",
  "finishReason",
  "costSource",
  "usageStatus",
  "httpStatus",
  "errorCode",
  "status",
  "promptVersion",
  "schemaVersion",
  "cacheHit",
  "published",
  "sourceCount",
  "stepCount",
  "testRunId",
  "currency",
  "reasoningEffort",
  "costStatus",
  "jobType",
  "outputReused",
  "requestedSlideCount",
  "outputBytes",
  "firstTokenMs",
  "providerLatencyMs",
  "upstreamInferenceCostUsd",
]);

function safeScalar(value: unknown): string | number | boolean | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (
    typeof value === "string" &&
    value.length <= 180 &&
    /^[\w ./:@+,;\-]+$/.test(value) &&
    !/(?:sk-|pk-lf-|sb_secret_|bearer|0x[\da-f]{40}|@[^ ]+\.)/i.test(value)
  )
    return value;
}

/** Explicitly allow metadata: never serialize prompts, documents, profiles, or error objects. */
export function safeMetadata(metadata: Record<string, unknown> = {}) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (scalarKeys.has(key)) {
      const safe = safeScalar(value);
      if (safe !== undefined) result[key] = safe;
    } else if (key === "pricing" && value && typeof value === "object") {
      const pricing: Record<string, unknown> = {};
      for (const [field, entry] of Object.entries(value)) {
        // These are rates/snapshot facts, never arbitrary provider response fields.
        if (
          [
            "model",
            "provider",
            "source",
            "currency",
            "capturedAt",
            "inputUsdPerMillion",
            "outputUsdPerMillion",
            "inputCachedUsdPerMillion",
            "inputCacheWriteUsdPerMillion",
            "reasoningUsdPerMillion",
            "requestUsd",
          ].includes(field)
        ) {
          const safe = safeScalar(entry);
          if (safe !== undefined) pricing[field] = safe;
        } else if (
          ["appliedOverrideIndexes", "limitations"].includes(field) &&
          Array.isArray(entry)
        ) {
          pricing[field] = entry
            .slice(0, 16)
            .map(safeScalar)
            .filter((v) => v !== undefined);
        }
      }
      result.pricing = pricing;
    } else if (key === "accountingIssues" && Array.isArray(value)) {
      result[key] = value
        .slice(0, 12)
        .map(safeScalar)
        .filter((v) => v !== undefined);
    }
  }
  return result;
}

function finiteDetails(value?: Record<string, unknown>) {
  if (!value) return undefined;
  const details = Object.fromEntries(
    Object.entries(value).filter(
      ([key, entry]) =>
        /^[a-z_]+$/.test(key) &&
        typeof entry === "number" &&
        Number.isFinite(entry) &&
        entry >= 0,
    ),
  );
  return Object.keys(details).length
    ? (details as Record<string, number>)
    : undefined;
}

function safeUpdate(
  raw: TracedObservation,
  attributes: LangfuseGenerationAttributes,
) {
  // Deliberately ignore input/output, raw exceptions, prompt objects, and arbitrary parameters.
  try {
    const model = safeScalar(attributes.model);
    const safe: LangfuseGenerationAttributes = {
      metadata: safeMetadata(attributes.metadata),
      ...(typeof model === "string" ? { model } : {}),
      ...(attributes.level === "ERROR"
        ? { level: "ERROR", statusMessage: "operation_failed" }
        : {}),
      ...(attributes.usageDetails
        ? {
            usageDetails: finiteDetails(
              attributes.usageDetails as Record<string, unknown>,
            ),
          }
        : {}),
      ...(attributes.costDetails
        ? { costDetails: finiteDetails(attributes.costDetails) }
        : {}),
    };
    raw.update(safe);
  } catch {
    // An instrumentation failure must never repeat or fail a paid operation.
  }
}

export function observabilityEnabled() {
  return Boolean(sdk) && !stopped;
}

/** One SDK per API process. Tests opt in explicitly, never by importing provider modules. */
export function initializeObservability(
  options: { exporter?: LangfuseSpanProcessorParams["exporter"] } = {},
) {
  if (sdk) return !stopped;
  if (
    process.env.LANGFUSE_ENABLED === "false" ||
    !process.env.LANGFUSE_PUBLIC_KEY ||
    !process.env.LANGFUSE_SECRET_KEY
  )
    return false;
  try {
    const baseUrl = new URL(
      process.env.LANGFUSE_BASE_URL || "https://jp.cloud.langfuse.com",
    );
    if (baseUrl.protocol !== "https:" && !options.exporter)
      throw new Error("invalid_endpoint");
    processor = new LangfuseSpanProcessor({
      baseUrl: baseUrl.origin,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      environment:
        process.env.LANGFUSE_TRACING_ENVIRONMENT ||
        (process.env.NODE_ENV === "production" ? "production" : "development"),
      release: process.env.APP_VERSION || "development",
      timeout: 5,
      flushInterval: 5,
      mediaUploadEnabled: false,
      // No HTTP/DB auto-instrumentation; only our explicit, metadata-only observations.
      shouldExportSpan: ({ otelSpan }) =>
        otelSpan.instrumentationScope.name === "langfuse-sdk",
      ...(options.exporter ? { exporter: options.exporter } : {}),
    });
    sdk = new NodeSDK({
      serviceName: "folio-api",
      autoDetectResources: false,
      instrumentations: [],
      metricReaders: [],
      logRecordProcessors: [],
      spanProcessors: [processor],
    });
    sdk.start();
    return true;
  } catch {
    sdk = undefined;
    processor = undefined;
    console.warn(
      "Folio observability initialization failed; continuing without tracing.",
    );
    return false;
  }
}

export async function withObservation<T>(
  name: string,
  options: ObservationOptions,
  callback: (observation: Observation) => Promise<T> | T,
): Promise<T> {
  if (!observabilityEnabled()) return callback(noop);
  // Catch inside the SDK callback: SDK exception handling otherwise serializes error.message,
  // which can contain a model response or document fragment from a validator.
  const invoke = async (raw: TracedObservation) => {
    const observation: Observation = {
      traceId: raw.traceId,
      update: (attributes) => safeUpdate(raw, attributes),
    };
    observation.update({ metadata: options.metadata });
    try {
      return { ok: true as const, value: await callback(observation) };
    } catch (error) {
      observation.update({
        level: "ERROR",
        metadata: { errorCode: "operation_failed" },
      });
      return { ok: false as const, error };
    }
  };
  const run = () =>
    options.type === "generation"
      ? startActiveObservation(name, invoke, { asType: "generation" })
      : options.type === "retriever"
        ? startActiveObservation(name, invoke, { asType: "retriever" })
        : startActiveObservation(name, invoke);
  const pseudonym = (id: string) =>
    `folio-${createHash("sha256").update(id).digest("hex").slice(0, 32)}`;
  const result = await propagateAttributes(
    {
      ...(options.userId ? { userId: pseudonym(options.userId) } : {}),
      ...(options.sessionId ? { sessionId: pseudonym(options.sessionId) } : {}),
      // Trace name is established by the root span; children inherit it.
    },
    run,
  );
  if (!result.ok) throw result.error;
  return result.value;
}

export async function flushObservability(): Promise<boolean> {
  if (!processor || stopped) return true;
  try {
    await processor.forceFlush();
    return true;
  } catch {
    console.warn("Folio trace export failed; application data is unaffected.");
    return false;
  }
}

export async function shutdownObservability() {
  if (!sdk || stopped) return;
  stopped = true;
  try {
    await sdk.shutdown();
  } catch {
    console.warn(
      "Folio trace shutdown failed; application data is unaffected.",
    );
  }
}
