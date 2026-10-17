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

async function request(body: Record<string, unknown>, timeout = 90000) {
  const { key, base, model, effort } = config();
  const response = await fetch(`${base}/chat/completions`, {
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
  );
  const result = (await response.json()) as any;
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new ProviderError(
      "The AI provider returned an empty result. Please retry.",
    );
  return content;
}

export async function streamCompletion(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
): Promise<string> {
  const response = await request({ messages, stream: true });
  if (!response.body)
    throw new ProviderError("The AI provider returned no response.");
  let pending = "",
    output = "",
    finished = false;
  const decoder = new TextDecoder();
  for await (const part of response.body as any) {
    pending += decoder.decode(part, { stream: true });
    if (pending.length > 2_000_000)
      throw new ProviderError(
        "The AI provider response exceeded the size limit.",
      );
    let end;
    while ((end = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, end).replace(/\r$/, "");
      pending = pending.slice(end + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") {
        finished = true;
        continue;
      }
      let event: any;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.error)
        throw new ProviderError(
          "The AI provider stopped generating. Please retry.",
        );
      const delta = event.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        output += delta;
        if (output.length > 100000)
          throw new ProviderError("The answer exceeded the size limit.");
        onDelta(delta);
      }
    }
  }
  if (!finished)
    throw new ProviderError(
      "The AI connection was interrupted. Please retry your question.",
    );
  if (!output.trim())
    throw new ProviderError("The AI provider returned an empty answer.");
  return output;
}
