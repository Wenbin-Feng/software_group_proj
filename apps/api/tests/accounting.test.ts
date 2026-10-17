import assert from "node:assert/strict";
import test from "node:test";
import {
  createPricingResolver,
  normalizeUsage,
  summarizeAccounting,
  type PricingSnapshot,
} from "../src/ai/accounting.js";

function catalog(pricing: Record<string, unknown>, id = "qwen/qwen3.6-plus") {
  return Response.json({ data: [{ id, pricing }] });
}
async function prices(
  pricing: Record<string, unknown>,
): Promise<PricingSnapshot> {
  const resolver = createPricingResolver({
    fetch: (async () => catalog(pricing)) as typeof fetch,
    now: () => Date.UTC(2026, 9, 17, 8),
  });
  const snapshot = await resolver.resolve({
    baseUrl: "https://openrouter.ai/api/v1",
    model: "qwen/qwen3.6-plus",
  });
  assert.ok(snapshot);
  return snapshot;
}

test("usage details split cache and reasoning without inflating token totals", () => {
  const result = normalizeUsage({
    prompt_tokens: 100,
    completion_tokens: 40,
    total_tokens: 140,
    prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 10 },
    completion_tokens_details: { reasoning_tokens: 25 },
    cost: 0.002,
    arbitrary_prompt: "This must never leave the provider adapter.",
  });
  assert.deepEqual(result.usageDetails, {
    input: 30,
    input_cached_tokens: 60,
    input_cache_write_tokens: 10,
    output: 15,
    output_reasoning_tokens: 25,
    total: 140,
  });
  const buckets = { ...result.usageDetails };
  delete buckets.total;
  assert.equal(
    Object.values(buckets).reduce((sum, n) => sum + n, 0),
    140,
  );
  assert.equal(JSON.stringify(result).includes("arbitrary_prompt"), false);
  assert.equal(result.providerCostUsd, 0.002);
});

test("missing usage is unknown, while explicit zero tokens and cost are retained", () => {
  assert.equal(normalizeUsage(undefined).usageDetails, undefined);
  const missing = summarizeAccounting({ usage: undefined });
  assert.equal(missing.costDetails, undefined);
  assert.equal(missing.metadata.usageStatus, "missing");
  const zero = summarizeAccounting({
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: 0,
      cost_details: { upstream_inference_cost: 19 },
    },
  });
  assert.deepEqual(zero.usageDetails, { input: 0, output: 0, total: 0 });
  assert.deepEqual(zero.costDetails, { total: 0 });
  assert.equal(zero.metadata.costSource, "provider_reported");
  assert.equal(zero.metadata.upstreamInferenceCostUsd, 19);
});

test("malformed token details retain trustworthy aggregate counts and suppress estimates", async () => {
  const usage = {
    prompt_tokens: 5,
    completion_tokens: 2,
    total_tokens: 100,
    prompt_tokens_details: { cached_tokens: 10 },
    cost: -1,
  };
  const normalized = normalizeUsage(usage);
  assert.deepEqual(normalized.usageDetails, { input: 5, output: 2, total: 7 });
  assert.deepEqual(normalized.issues, [
    "invalid_input_token_details",
    "inconsistent_total_tokens",
  ]);
  const summary = summarizeAccounting({
    usage,
    pricing: await prices({ prompt: "0.000001", completion: "0.000002" }),
  });
  assert.equal(summary.costDetails, undefined);
  assert.equal(summary.metadata.costSource, "unknown");
  for (const invalid of [null, "", "NaN", -1, Infinity, Number.NaN])
    assert.equal(normalizeUsage({ cost: invalid }).providerCostUsd, undefined);
});

test("provider charge takes precedence over catalog and upstream provider cost", async () => {
  const summary = summarizeAccounting({
    usage: {
      prompt_tokens: 100,
      completion_tokens: 20,
      cost: 0.123,
      cost_details: { upstream_inference_cost: 0.1 },
    },
    pricing: await prices({ prompt: "0.000001", completion: "0.000002" }),
  });
  assert.deepEqual(summary.costDetails, { total: 0.123 });
  assert.equal(summary.metadata.costSource, "provider_reported");
  assert.equal(summary.metadata.pricing?.inputUsdPerMillion, 1);
  assert.equal(summary.metadata.pricing?.outputUsdPerMillion, 2);
  assert.equal(summary.metadata.currency, "USD");
});

test("catalog estimates charge mutually exclusive cache, reasoning, and request amounts", async () => {
  const summary = summarizeAccounting({
    usage: {
      prompt_tokens: 100,
      completion_tokens: 40,
      prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 10 },
      completion_tokens_details: { reasoning_tokens: 25 },
    },
    pricing: await prices({
      prompt: "0.000001",
      completion: "0.000002",
      input_cache_read: "0.0000001",
      input_cache_write: "0.00000125",
      internal_reasoning: "0.000003",
      request: "0.00001",
    }),
  });
  assert.equal(summary.metadata.costSource, "catalog_estimate");
  assert.ok(Math.abs(summary.costDetails!.input - 0.0000485) < 1e-12);
  assert.ok(Math.abs(summary.costDetails!.output - 0.000105) < 1e-12);
  assert.ok(Math.abs(summary.costDetails!.total - 0.0001635) < 1e-12);
  assert.equal(summary.costDetails!.request, 0.00001);
});

test("cached tokens with an absent read price and incomplete usage cannot fabricate a charge", async () => {
  const pricing = await prices({
    prompt: "0.000000325",
    completion: "0.00000195",
  });
  const cached = summarizeAccounting({
    usage: {
      prompt_tokens: 100,
      completion_tokens: 10,
      prompt_tokens_details: { cached_tokens: 90 },
    },
    pricing,
  });
  assert.equal(cached.costDetails, undefined);
  assert.ok(
    cached.metadata.accountingIssues.includes("required_catalog_rate_missing"),
  );
  for (const usage of [
    undefined,
    { total_tokens: 10 },
    { prompt_tokens: 10 },
    { completion_tokens: 10 },
  ])
    assert.equal(
      summarizeAccounting({ usage, pricing }).costDetails,
      undefined,
    );
});

test("long context override starts strictly above its threshold and inherits absent prices", async () => {
  const pricing = await prices({
    prompt: "0.000000325",
    completion: "0.00000195",
    input_cache_read: "0.0000001",
    overrides: [
      {
        min_prompt_tokens: 256000,
        prompt: "0.0000013",
        completion: "0.0000039",
      },
    ],
  });
  const base = summarizeAccounting({
    usage: { prompt_tokens: 256000, completion_tokens: 10 },
    pricing,
  });
  const long = summarizeAccounting({
    usage: { prompt_tokens: 256001, completion_tokens: 10 },
    pricing,
  });
  assert.equal(base.metadata.pricing?.inputUsdPerMillion, 0.325);
  assert.equal(long.metadata.pricing?.inputUsdPerMillion, 1.3);
  assert.equal(long.metadata.pricing?.outputUsdPerMillion, 3.9);
  assert.equal(long.metadata.pricing?.inputCachedUsdPerMillion, 0.1);
  assert.deepEqual(base.metadata.pricing?.appliedOverrideIndexes, []);
  assert.deepEqual(long.metadata.pricing?.appliedOverrideIndexes, [0]);
});

test("UTC scheduled overrides honor weekday and midnight wrapping at request start", async () => {
  const pricing = await prices({
    prompt: "0.000001",
    completion: "0.000002",
    overrides: [
      {
        utc_days: ["saturday"],
        utc_start: 1630,
        utc_end: 30,
        prompt: "0.0000005",
      },
    ],
  });
  const usage = { prompt_tokens: 100, completion_tokens: 10 };
  const early = summarizeAccounting({
    usage,
    pricing,
    requestedAt: Date.UTC(2026, 9, 17, 0, 0),
  });
  const midday = summarizeAccounting({
    usage,
    pricing,
    requestedAt: Date.UTC(2026, 9, 17, 12, 0),
  });
  const sunday = summarizeAccounting({
    usage,
    pricing,
    requestedAt: Date.UTC(2026, 9, 18, 22, 0),
  });
  const absentTime = summarizeAccounting({ usage, pricing });
  assert.equal(early.metadata.pricing?.inputUsdPerMillion, 0.5);
  assert.equal(midday.metadata.pricing?.inputUsdPerMillion, 1);
  assert.equal(sunday.metadata.pricing?.inputUsdPerMillion, 1);
  assert.equal(absentTime.costDetails, undefined);
});

test("new unrecognized price conditions never apply silently", async () => {
  const pricing = await prices({
    prompt: "0.000001",
    completion: "0.000002",
    overrides: [{ min_image_tokens: 20, prompt: "0.9" }],
  });
  const summary = summarizeAccounting({
    usage: { prompt_tokens: 100, completion_tokens: 10 },
    pricing,
  });
  assert.equal(summary.costDetails, undefined);
  assert.equal(summary.metadata.pricing?.inputUsdPerMillion, 1);
  assert.match(summary.metadata.pricing!.limitations.join(" "), /Unsupported/);
});

test("resolver shares concurrent lookups, refreshes short cache, and does not forward API keys", async () => {
  let now = 0,
    calls = 0;
  const resolver = createPricingResolver({
    now: () => now,
    ttlMs: 1000,
    fetch: (async (url, init) => {
      calls++;
      assert.equal(url, "https://openrouter.ai/api/v1/models");
      assert.equal(init?.headers, undefined);
      assert.ok(init?.signal);
      await Promise.resolve();
      return catalog({ prompt: "0.000000325", completion: "0.00000195" });
    }) as typeof fetch,
  });
  const input = {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "qwen/qwen3.6-plus",
    apiKey: "never-forward-this-test-key",
  };
  const [a, b] = await Promise.all([
    resolver.resolve({ ...input, provider: "Alibaba" }),
    resolver.resolve({ ...input, provider: "Other Provider" }),
  ]);
  assert.equal(calls, 1);
  assert.equal(a?.provider, "Alibaba");
  assert.equal(b?.provider, "Other Provider");
  assert.equal(a?.capturedAt, "1970-01-01T00:00:00.000Z");
  now = 500;
  await resolver.resolve(input);
  assert.equal(calls, 1);
  now = 1001;
  await resolver.resolve(input);
  assert.equal(calls, 2);
});

test("unknown models, custom gateways, errors, and outages fail open without fabricated pricing", async () => {
  let calls = 0,
    now = 0;
  const resolver = createPricingResolver({
    now: () => now,
    fetch: (async () => {
      calls++;
      throw new Error("private provider error must not escape");
    }) as typeof fetch,
  });
  const input = {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "qwen/qwen3.6-plus",
  };
  assert.equal(
    await resolver.resolve({
      ...input,
      baseUrl: "https://private-gateway.example/api/v1",
    }),
    undefined,
  );
  assert.equal(calls, 0);
  assert.equal(await resolver.resolve(input), undefined);
  assert.equal(await resolver.resolve(input), undefined);
  assert.equal(calls, 1);
  now = 30001;
  assert.equal(await resolver.resolve(input), undefined);
  assert.equal(calls, 2);
  const exact = createPricingResolver({
    fetch: (async () =>
      catalog({ prompt: "0", completion: "0" }, "other/model")) as typeof fetch,
  });
  assert.equal(await exact.resolve(input), undefined);
});

test("valid free catalog prices remain zero and audio estimates remain unknown", async () => {
  const pricing = await prices({ prompt: "0", completion: "0", request: "0" });
  const free = summarizeAccounting({
    usage: { prompt_tokens: 20, completion_tokens: 5 },
    pricing,
  });
  assert.equal(free.metadata.costSource, "catalog_estimate");
  assert.equal(free.costDetails?.total, 0);
  const audio = summarizeAccounting({
    usage: {
      prompt_tokens: 20,
      completion_tokens: 5,
      prompt_tokens_details: { audio_tokens: 2 },
    },
    pricing,
  });
  assert.equal(audio.costDetails, undefined);
  assert.ok(
    audio.metadata.accountingIssues.includes("audio_pricing_not_supported"),
  );
});
