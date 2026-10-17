/** OpenRouter usage is a provider report; catalog prices are a dated estimate only. */
export type UsageDetails = Record<string, number>;
type JsonRecord = Record<string, unknown>;

export type NormalizedUsage = {
  usageDetails?: UsageDetails;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  inputAudioTokens?: number;
  outputAudioTokens?: number;
  providerCostUsd?: number;
  upstreamInferenceCostUsd?: number;
  issues: string[];
};

type Rates = {
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  inputCachedUsdPerMillion?: number;
  inputCacheWriteUsdPerMillion?: number;
  reasoningUsdPerMillion?: number;
  requestUsd?: number;
};
type PriceOverride = {
  minPromptTokens?: number;
  utcStart?: number;
  utcEnd?: number;
  utcDays?: string[];
  rates: Rates;
};
export type PricingSnapshot = {
  source: "openrouter_models";
  currency: "USD";
  model: string;
  provider?: string;
  capturedAt: string;
  rates: Rates;
  overrides: PriceOverride[];
  unsupportedConditions: boolean;
};
export type PricingMetadata = Rates & {
  source: "openrouter_models";
  currency: "USD";
  model: string;
  provider?: string;
  capturedAt: string;
  appliedOverrideIndexes: number[];
  limitations: string[];
};
export type AccountingSummary = {
  usageDetails?: UsageDetails;
  costDetails?: Record<string, number>;
  metadata: {
    currency: "USD";
    costSource: "provider_reported" | "catalog_estimate" | "unknown";
    usageStatus: "reported" | "missing";
    accountingIssues: string[];
    upstreamInferenceCostUsd?: number;
    pricing?: PricingMetadata;
  };
};

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}
function money(value: unknown): number | undefined {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value))
  )
    return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

/** Detail buckets are subtracted from totals so Langfuse never counts tokens twice. */
export function normalizeUsage(value: unknown): NormalizedUsage {
  const usage = record(value);
  const prompt = count(usage.prompt_tokens);
  const completion = count(usage.completion_tokens);
  const promptDetails = record(usage.prompt_tokens_details);
  const completionDetails = record(usage.completion_tokens_details);
  const cached = count(promptDetails.cached_tokens);
  const cacheWrite = count(promptDetails.cache_write_tokens);
  const reasoning = count(completionDetails.reasoning_tokens);
  const inputAudio = count(promptDetails.audio_tokens);
  const outputAudio = count(completionDetails.audio_tokens);
  const details: UsageDetails = {};
  const issues: string[] = [];

  function split(
    total: number | undefined,
    baseKey: string,
    buckets: [string, number | undefined][],
    hasInvalidDetails: boolean,
  ) {
    if (total === undefined) return;
    const subset = buckets.reduce((sum, [, n]) => sum + (n ?? 0), 0);
    if (hasInvalidDetails || subset > total || !Number.isSafeInteger(subset)) {
      // A malformed provider detail must not invent negative or clamped token counts.
      details[baseKey] = total;
      issues.push(`invalid_${baseKey}_token_details`);
      return;
    }
    details[baseKey] = total - subset;
    for (const [key, n] of buckets) if (n !== undefined) details[key] = n;
  }
  split(
    prompt,
    "input",
    [
      ["input_cached_tokens", cached],
      ["input_cache_write_tokens", cacheWrite],
      ["input_audio_tokens", inputAudio],
    ],
    ["cached_tokens", "cache_write_tokens", "audio_tokens"].some(
      (key) => key in promptDetails && count(promptDetails[key]) === undefined,
    ),
  );
  split(
    completion,
    "output",
    [
      ["output_reasoning_tokens", reasoning],
      ["output_audio_tokens", outputAudio],
    ],
    ["reasoning_tokens", "audio_tokens"].some(
      (key) =>
        key in completionDetails && count(completionDetails[key]) === undefined,
    ),
  );
  const reportedTotal = count(usage.total_tokens);
  if (prompt !== undefined && completion !== undefined) {
    const total = prompt + completion;
    if (Number.isSafeInteger(total)) {
      details.total = total;
      if (reportedTotal !== undefined && reportedTotal !== total)
        issues.push("inconsistent_total_tokens");
    }
  } else if (reportedTotal !== undefined) details.total = reportedTotal;
  return {
    ...(Object.keys(details).length ? { usageDetails: details } : {}),
    promptTokens: prompt,
    completionTokens: completion,
    cachedTokens: cached,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: reasoning,
    inputAudioTokens: inputAudio,
    outputAudioTokens: outputAudio,
    providerCostUsd: money(usage.cost),
    upstreamInferenceCostUsd: money(
      record(usage.cost_details).upstream_inference_cost,
    ),
    issues,
  };
}

const priceFields = {
  prompt: "inputUsdPerMillion",
  completion: "outputUsdPerMillion",
  input_cache_read: "inputCachedUsdPerMillion",
  input_cache_write: "inputCacheWriteUsdPerMillion",
  internal_reasoning: "reasoningUsdPerMillion",
  request: "requestUsd",
} as const;
const ignoredPriceFields = new Set([
  "image",
  "web_search",
  "audio",
  "input_audio",
  "output_audio",
]);
const conditionFields = new Set([
  "min_prompt_tokens",
  "utc_start",
  "utc_end",
  "utc_days",
]);
const days = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseRates(value: JsonRecord): Rates {
  const rates: Rates = {};
  for (const [providerKey, rateKey] of Object.entries(priceFields)) {
    const amount = money(value[providerKey]);
    if (amount !== undefined) {
      const rate = Number(
        (amount * (providerKey === "request" ? 1 : 1_000_000)).toPrecision(15),
      );
      if (Number.isFinite(rate)) rates[rateKey as keyof Rates] = rate;
    }
  }
  return rates;
}
function hhmm(value: unknown): number | undefined {
  const n = count(value);
  return n !== undefined && n <= 2359 && n % 100 < 60 ? n : undefined;
}
function parsePricing(
  model: string,
  value: unknown,
  capturedAt: string,
): PricingSnapshot | undefined {
  const pricing = record(value);
  const rates = parseRates(pricing);
  if (!Object.keys(rates).length) return undefined;
  const overrides: PriceOverride[] = [];
  let unsupportedConditions = false;
  if (pricing.overrides !== undefined && !Array.isArray(pricing.overrides))
    unsupportedConditions = true;
  for (const raw of Array.isArray(pricing.overrides) ? pricing.overrides : []) {
    const entry = record(raw);
    const unknown = Object.keys(entry).some(
      (key) =>
        !(key in priceFields) &&
        !ignoredPriceFields.has(key) &&
        !conditionFields.has(key),
    );
    const threshold = count(entry.min_prompt_tokens);
    const start = hhmm(entry.utc_start);
    const end = hhmm(entry.utc_end);
    const utcDays = entry.utc_days;
    if (
      unknown ||
      ("min_prompt_tokens" in entry && threshold === undefined) ||
      (("utc_start" in entry || "utc_end" in entry) &&
        (start === undefined || end === undefined)) ||
      (utcDays !== undefined &&
        (!Array.isArray(utcDays) ||
          !utcDays.length ||
          utcDays.some(
            (day) => typeof day !== "string" || !days.includes(day),
          )))
    ) {
      unsupportedConditions = true;
      continue;
    }
    overrides.push({
      ...(threshold !== undefined ? { minPromptTokens: threshold } : {}),
      ...(start !== undefined ? { utcStart: start, utcEnd: end } : {}),
      ...(Array.isArray(utcDays) ? { utcDays: utcDays as string[] } : {}),
      rates: parseRates(entry),
    });
  }
  return {
    source: "openrouter_models",
    currency: "USD",
    model,
    capturedAt,
    rates,
    overrides,
    unsupportedConditions,
  };
}

function safeProvider(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_.:/ -]{0,127}$/.test(value) &&
    !/(?:sk-|sb_secret_|pk-lf-|Bearer|0x[0-9a-f]{40})/i.test(value)
    ? value
    : undefined;
}

/** Public catalog only: never forward a model API key to an arbitrary configured base URL. */
export function createPricingResolver(
  options: {
    fetch?: typeof fetch;
    now?: () => number;
    ttlMs?: number;
    timeoutMs?: number;
  } = {},
) {
  const fetcher =
    options.fetch ??
    ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const now = options.now ?? Date.now;
  const ttl = Math.min(900_000, Math.max(1_000, options.ttlMs ?? 300_000));
  const timeout = Math.min(5_000, Math.max(100, options.timeoutMs ?? 2_000));
  const cache = new Map<string, { expires: number; value?: PricingSnapshot }>();
  const inflight = new Map<string, Promise<PricingSnapshot | undefined>>();
  return {
    async resolve(input: {
      baseUrl: string;
      model: string;
      apiKey?: string;
      provider?: string;
    }): Promise<PricingSnapshot | undefined> {
      if (
        input.baseUrl.replace(/\/$/, "") !== "https://openrouter.ai/api/v1" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*\/[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(
          input.model,
        )
      )
        return undefined;
      const cached = cache.get(input.model);
      let snapshot: PricingSnapshot | undefined;
      if (cached && cached.expires > now()) snapshot = cached.value;
      else {
        let pending = inflight.get(input.model);
        if (!pending) {
          pending = (async () => {
            let value: PricingSnapshot | undefined;
            try {
              const response = await fetcher(
                "https://openrouter.ai/api/v1/models",
                { signal: AbortSignal.timeout(timeout) },
              );
              if (response.ok) {
                const result = record(await response.json());
                const match = Array.isArray(result.data)
                  ? result.data.find(
                      (entry) => record(entry).id === input.model,
                    )
                  : undefined;
                if (match)
                  value = parsePricing(
                    input.model,
                    record(match).pricing,
                    new Date(now()).toISOString(),
                  );
              } else await response.body?.cancel();
            } catch {
              // Pricing discovery is optional. Never log request headers or provider response bodies.
            }
            if (cache.size >= 128) cache.delete(cache.keys().next().value!);
            cache.set(input.model, {
              value,
              expires: now() + (value ? ttl : Math.min(ttl, 30_000)),
            });
            inflight.delete(input.model);
            return value;
          })();
          inflight.set(input.model, pending);
        }
        snapshot = await pending;
      }
      if (!snapshot) return undefined;
      // The provider is specific to the completed request, not the cached catalog entry.
      const provider = safeProvider(input.provider);
      return { ...snapshot, ...(provider ? { provider } : {}) };
    },
  };
}

function effectivePricing(
  snapshot: PricingSnapshot,
  promptTokens: number | undefined,
  requestedAt?: number,
) {
  const rates = { ...snapshot.rates };
  const appliedOverrideIndexes: number[] = [];
  const limitations = [
    "Catalog prices describe the top provider; the routed provider, discounts, or extra billable operations may differ.",
  ];
  let canEstimate = !snapshot.unsupportedConditions;
  if (!canEstimate)
    limitations.push(
      "Unsupported catalog pricing conditions prevent a reliable estimate.",
    );
  const requestDate =
    requestedAt !== undefined && Number.isFinite(requestedAt)
      ? new Date(requestedAt)
      : undefined;
  snapshot.overrides.forEach((override, index) => {
    if (override.minPromptTokens !== undefined) {
      if (promptTokens === undefined) {
        canEstimate = false;
        return;
      }
      if (promptTokens <= override.minPromptTokens) return;
    }
    if (override.utcStart !== undefined || override.utcDays !== undefined) {
      if (!requestDate) {
        canEstimate = false;
        return;
      }
      if (
        override.utcDays &&
        !override.utcDays.includes(days[requestDate.getUTCDay()])
      )
        return;
      if (override.utcStart !== undefined && override.utcEnd !== undefined) {
        const time =
          requestDate.getUTCHours() * 100 + requestDate.getUTCMinutes();
        const matches =
          override.utcEnd > override.utcStart
            ? time >= override.utcStart && time < override.utcEnd
            : time >= override.utcStart || time < override.utcEnd;
        if (!matches) return;
      }
    }
    Object.assign(rates, override.rates);
    appliedOverrideIndexes.push(index);
  });
  if (!canEstimate && !snapshot.unsupportedConditions)
    limitations.push(
      "Missing request time or token count prevents applying all catalog pricing conditions.",
    );
  const {
    rates: _rates,
    overrides: _overrides,
    unsupportedConditions: _unsupported,
    ...summary
  } = snapshot;
  const metadata: PricingMetadata = {
    ...summary,
    ...rates,
    appliedOverrideIndexes,
    limitations,
  };
  return { rates, metadata, canEstimate };
}

/** Report actual account charges when present. Estimates are never labelled actual charges. */
export function summarizeAccounting(input: {
  usage: unknown;
  pricing?: PricingSnapshot;
  requestedAt?: number;
}): AccountingSummary {
  const usage = normalizeUsage(input.usage);
  const effective = input.pricing
    ? effectivePricing(input.pricing, usage.promptTokens, input.requestedAt)
    : undefined;
  const metadata: AccountingSummary["metadata"] = {
    currency: "USD",
    costSource: "unknown",
    usageStatus: usage.usageDetails ? "reported" : "missing",
    accountingIssues: [...usage.issues],
    ...(usage.upstreamInferenceCostUsd !== undefined
      ? { upstreamInferenceCostUsd: usage.upstreamInferenceCostUsd }
      : {}),
    ...(effective ? { pricing: effective.metadata } : {}),
  };
  const result: AccountingSummary = {
    ...(usage.usageDetails ? { usageDetails: usage.usageDetails } : {}),
    metadata,
  };
  if (usage.providerCostUsd !== undefined) {
    metadata.costSource = "provider_reported";
    result.costDetails = { total: usage.providerCostUsd };
    return result;
  }
  if (
    !effective ||
    !effective.canEstimate ||
    usage.promptTokens === undefined ||
    usage.completionTokens === undefined ||
    usage.issues.some((issue) => issue.startsWith("invalid_"))
  )
    return result;
  if ((usage.inputAudioTokens ?? 0) > 0 || (usage.outputAudioTokens ?? 0) > 0) {
    metadata.accountingIssues.push("audio_pricing_not_supported");
    return result;
  }
  const rates = effective.rates;
  const cached = usage.cachedTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const reasoning = usage.reasoningTokens ?? 0;
  const priced = (tokens: number, rate: number | undefined) =>
    tokens === 0
      ? 0
      : rate === undefined
        ? undefined
        : (tokens * rate) / 1_000_000;
  const inputParts = [
    priced(usage.promptTokens - cached - cacheWrite, rates.inputUsdPerMillion),
    priced(cached, rates.inputCachedUsdPerMillion),
    priced(cacheWrite, rates.inputCacheWriteUsdPerMillion),
  ];
  const outputParts = [
    priced(usage.completionTokens - reasoning, rates.outputUsdPerMillion),
    priced(
      reasoning,
      rates.reasoningUsdPerMillion ?? rates.outputUsdPerMillion,
    ),
  ];
  if ([...inputParts, ...outputParts].some((value) => value === undefined)) {
    metadata.accountingIssues.push("required_catalog_rate_missing");
    return result;
  }
  const inputCost = (inputParts as number[]).reduce(
    (sum, part) => sum + part,
    0,
  );
  const outputCost = (outputParts as number[]).reduce(
    (sum, part) => sum + part,
    0,
  );
  const requestCost = rates.requestUsd ?? 0;
  const total = inputCost + outputCost + requestCost;
  if (!Number.isFinite(total)) return result;
  metadata.costSource = "catalog_estimate";
  result.costDetails = {
    input: inputCost,
    output: outputCost,
    ...(requestCost ? { request: requestCost } : {}),
    total,
  };
  return result;
}
