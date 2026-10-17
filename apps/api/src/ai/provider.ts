import { withObservation, observabilityEnabled } from "../observability.js";
import { createPricingResolver, summarizeAccounting } from "./accounting.js";

const pricingResolver = createPricingResolver({ timeoutMs: 5000 });
type CallReport = {
  usage?: unknown;
  model?: string;
  provider?: string;
  id?: string;
  finishReason?: string;
  httpStatus?: number;
  firstTokenMs?: number;
  requestedAt: number;
};

function reportResponse(report: CallReport, result: any) {
  if (!result || typeof result !== "object") return;
  if (result.usage && typeof result.usage === "object")
    report.usage = result.usage;
  if (typeof result.model === "string") report.model = result.model;
  if (typeof result.provider === "string") report.provider = result.provider;
  if (typeof result.id === "string") report.id = result.id;
  if (typeof result.choices?.[0]?.finish_reason === "string")
    report.finishReason = result.choices[0].finish_reason;
}

async function modelCall(
  messages: ChatMessage[],
  streaming: boolean,
  structuredOutput: boolean,
  run: (report: CallReport) => Promise<string>,
) {
  return withObservation(
    "Model Call",
    {
      type: "generation",
      metadata: {
        streaming,
        structuredOutput,
        messageCount: messages.length,
        inputCharacters: messages.reduce(
          (n, message) => n + message.content.length,
          0,
        ),
        promptVersion: structuredOutput
          ? "folio-structured-v1"
          : "folio-chat-v1",
        reasoningEffort: process.env.H2A_REASONING_EFFORT || "none",
      },
    },
    async (observation) => {
      const report: CallReport = {
        requestedAt: Date.now(),
        model: process.env.H2A_LLM_MODEL || "qwen/qwen3.6-plus",
      };
      // Fetch the public catalog while Qwen generates, rather than delaying streamed delivery.
      const pricingInput = {
        baseUrl: process.env.H2A_LLM_BASE_URL || "https://openrouter.ai/api/v1",
        model: report.model!,
      };
      const initialPricing = observabilityEnabled()
        ? pricingResolver.resolve(pricingInput)
        : undefined;
      let outputCharacters = 0;
      try {
        const output = await run(report);
        outputCharacters = output.length;
        return output;
      } finally {
        const providerLatencyMs = Date.now() - report.requestedAt;
        // Cost/pricing failures must never turn a successful paid call into a retry.
        if (observabilityEnabled()) {
          try {
            const snapshot =
              report.model === pricingInput.model
                ? await initialPricing
                : await pricingResolver.resolve({
                    ...pricingInput,
                    model: report.model!,
                  });
            const pricing = snapshot
              ? { ...snapshot, provider: report.provider }
              : undefined;
            const accounting = summarizeAccounting({
              usage: report.usage,
              pricing,
              requestedAt: report.requestedAt,
            });
            observation.update({
              model: report.model,
              usageDetails: accounting.usageDetails,
              costDetails: accounting.costDetails,
              metadata: {
                ...accounting.metadata,
                provider: report.provider,
                providerRequestId: report.id,
                finishReason: report.finishReason,
                httpStatus: report.httpStatus,
                firstTokenMs: report.firstTokenMs,
                providerLatencyMs,
                outputCharacters,
              },
            });
          } catch {
            observation.update({
              model: report.model,
              metadata: {
                costSource: "unknown",
                usageStatus: "missing",
                errorCode: "accounting_unavailable",
              },
            });
          }
        }
      }
    },
  );
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
export class ProviderError extends Error {
  statusCode = 502;
}

function config() {
  const key = process.env.H2A_LLM_API_KEY;
  if (!key) {
    const error = new Error("AI generation is not configured on this server.");
    (error as any).statusCode = 503;
    throw error;
  }
  const base = (
    process.env.H2A_LLM_BASE_URL || "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");
  const requestedEffort = process.env.H2A_REASONING_EFFORT || "none";
  const effort = ["none", "minimal", "low", "medium", "high"].includes(
    requestedEffort,
  )
    ? requestedEffort
    : "none";
  return {
    key,
    base,
    model: process.env.H2A_LLM_MODEL || "qwen/qwen3.6-plus",
    effort,
  };
}

async function request(
  body: Record<string, unknown>,
  timeout = 90000,
  report?: CallReport,
) {
  const { key, base, model, effort } = config();
  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(timeout),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Folio learning workspace",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 7000,
        reasoning: { effort, exclude: true },
        ...body,
      }),
    });
  } catch {
    throw new ProviderError(
      "The AI provider could not be reached. Please retry.",
    );
  }
  if (report) report.httpStatus = response.status;
  if (!response.ok) {
    // Provider error payloads can contain prompt excerpts. Never send them to logs or the browser.
    await response.body?.cancel();
    throw new ProviderError(
      response.status === 429
        ? "The AI provider is busy. Please retry shortly."
        : "The AI provider could not complete this request.",
    );
  }
  return response;
}

export async function complete(
  messages: ChatMessage[],
  schema?: object,
  maxTokens = 7000,
): Promise<string> {
  // Some Qwen routes accept response_format while enforcing it softly. Give the model the
  // exact contract as well, then independently validate every generated field on the server.
  const example = (schema as any)?.properties?.slides
    ? {
        title: "Example lesson",
        language: "en",
        slides: [
          {
            title: "A specific teaching point",
            body: ["One concise explanation."],
            layout: "content",
            secondary: [],
            table: [],
            notes: "A brief teaching note.",
            sources: [],
          },
        ],
      }
    : null;
  const formattedMessages: ChatMessage[] = schema
    ? [
        {
          role: "system",
          content: `Return one JSON object matching this exact JSON Schema. Include every required key, use the exact property names, and respect all length and item limits. Do not use aliases or omit empty arrays. No markdown fences or surrounding commentary.\n${JSON.stringify(schema)}${example ? `\nOne-slide example illustrating the shape only (replace all example content and use the requested slide count, language, and supplied sources):\n${JSON.stringify(example)}\nUse sources, never references. If layout is table, supply a non-empty rectangular table array of rows. Other layouts still require table: [].` : ""}`,
        },
        ...messages,
      ]
    : messages;
  return modelCall(
    formattedMessages,
    false,
    Boolean(schema),
    async (report) => {
      const response = await request(
        {
          messages: formattedMessages,
          ...(schema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: { name: "folio_output", strict: true, schema },
                },
                provider: { require_parameters: true },
              }
            : {}),
          max_tokens: Math.min(16000, Math.max(1000, maxTokens)),
        },
        180000,
        report,
      );
      let result: any;
      try {
        result = await response.json();
      } catch {
        throw new ProviderError(
          "The AI provider returned an invalid response. Please retry.",
        );
      }
      reportResponse(report, result);
      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim())
        throw new ProviderError(
          "The AI provider returned an empty result. Please retry.",
        );
      return content;
    },
  );
}

export async function streamCompletion(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
): Promise<string> {
  return modelCall(messages, true, false, async (report) => {
    const response = await request({ messages, stream: true }, 90000, report);
    if (!response.body)
      throw new ProviderError("The AI provider returned no response.");
    let pending = "",
      output = "",
      finished = false;
    const decoder = new TextDecoder();
    const readLine = (line: string) => {
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (!data) return;
      if (data === "[DONE]") {
        finished = true;
        return;
      }
      let event: any;
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      reportResponse(report, event);
      if (event.error)
        throw new ProviderError(
          "The AI provider stopped generating. Please retry.",
        );
      const delta = event.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        report.firstTokenMs ??= Date.now() - report.requestedAt;
        output += delta;
        if (output.length > 100000)
          throw new ProviderError("The answer exceeded the size limit.");
        onDelta(delta);
      }
    };
    for await (const part of response.body as any) {
      pending += decoder.decode(part, { stream: true });
      if (pending.length > 2_000_000)
        throw new ProviderError(
          "The AI provider response exceeded the size limit.",
        );
      let end;
      while ((end = pending.indexOf("\n")) >= 0) {
        readLine(pending.slice(0, end).replace(/\r$/, ""));
        pending = pending.slice(end + 1);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) readLine(pending.replace(/\r$/, ""));
    if (!finished)
      throw new ProviderError(
        "The AI connection was interrupted. Please retry your question.",
      );
    if (!output.trim())
      throw new ProviderError("The AI provider returned an empty answer.");
    return output;
  });
}
