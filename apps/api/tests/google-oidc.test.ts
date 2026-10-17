import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createGoogleOidcProvider } from "../src/core/google-oidc.js";

const issuer = "https://accounts.google.com",
  clientId = "synthetic.apps.googleusercontent.com";
const redirectUri = "https://folio.example/api/auth/google/callback";
const parameters = {
  state: "synthetic-state",
  nonce: "synthetic-nonce",
  codeVerifier: "v".repeat(43),
  redirectUri,
};
const key = await generateKeyPair("RS256"),
  wrongKey = await generateKeyPair("RS256");
const jwk = {
  ...(await exportJWK(key.publicKey)),
  kid: "fixture-key",
  alg: "RS256",
  use: "sig",
};

function provider(fetcher: typeof fetch) {
  const id = process.env.GOOGLE_CLIENT_ID,
    secret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = clientId;
  process.env.GOOGLE_CLIENT_SECRET = "synthetic-client-secret";
  const instance = createGoogleOidcProvider({ fetch: fetcher })!;
  if (id === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = id;
  if (secret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
  else process.env.GOOGLE_CLIENT_SECRET = secret;
  return instance;
}
async function fixture(
  overrides: Record<string, unknown> = {},
  badSignature = false,
) {
  const idToken = await new SignJWT({
    iss: issuer,
    aud: clientId,
    sub: "stable-google-subject",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: parameters.nonce,
    email: "synthetic@example.test",
    email_verified: true,
    name: "Test Learner",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .sign((badSignature ? wrongKey : key).privateKey);
  const requests: { url: string; body?: URLSearchParams }[] = [];
  const instance = provider((async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      ...(init?.body ? { body: new URLSearchParams(String(init.body)) } : {}),
    });
    if (url === issuer + "/.well-known/openid-configuration")
      return Response.json({
        issuer,
        authorization_endpoint: issuer + "/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
      });
    if (url === "https://www.googleapis.com/oauth2/v3/certs")
      return Response.json({ keys: [jwk] });
    if (url === "https://oauth2.googleapis.com/token")
      return Response.json({
        access_token: "synthetic-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        id_token: idToken,
      });
    throw new Error("Unexpected provider endpoint");
  }) as typeof fetch);
  return { instance, requests };
}
const exchange = (
  instance: ReturnType<typeof provider>,
  callbackUrl = redirectUri + "?code=synthetic-code&state=" + parameters.state,
) => instance.exchange({ ...parameters, callbackUrl });

test("Google authorization uses minimal identity scopes, state, nonce and S256 PKCE; secrets stay off the URL", async () => {
  const { instance, requests } = await fixture();
  const url = new URL(await instance.authorizationUrl(parameters));
  assert.equal(url.origin, issuer);
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), parameters.state);
  assert.equal(url.searchParams.get("nonce"), parameters.nonce);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("code_challenge")!, /^[\w-]{43}$/);
  assert.doesNotMatch(
    url.href,
    /synthetic-client-secret|code_verifier|access_type=offline/,
  );
  assert.deepEqual(await exchange(instance), {
    subject: "stable-google-subject",
    email: "synthetic@example.test",
    emailVerified: true,
    name: "Test Learner",
  });
  const token = requests.find((r) => r.url.endsWith("/token"))!;
  assert.equal(token.body?.get("code_verifier"), parameters.codeVerifier);
  assert.equal(token.body?.get("client_secret"), "synthetic-client-secret");
  assert.equal(token.body?.get("redirect_uri"), redirectUri);
  assert.ok(
    requests.some((r) => r.url.endsWith("/certs")),
    "ID token signature is checked against the provider JWKS",
  );
});

for (const [name, claims, invalidSignature] of [
  ["invalid nonce", { nonce: "wrong-nonce" }, false],
  ["wrong audience", { aud: "another-app" }, false],
  ["wrong issuer", { iss: "https://attacker.invalid" }, false],
  ["expired token", { exp: Math.floor(Date.now() / 1000) - 600 }, false],
  ["unverified email", { email_verified: false }, false],
  ["absent subject", { sub: "" }, false],
  ["forged signature", {}, true],
] as const)
  test(
    "Google rejects " + name + " without leaking token details",
    async () => {
      const { instance } = await fixture(claims, invalidSignature);
      await assert.rejects(exchange(instance), (error) => {
        assert.equal(
          (error as Error).message,
          "Google could not verify this sign-in. Please try again.",
        );
        return true;
      });
    },
  );

test("wrong state and callback target fail before a token exchange; provider outages use a safe error", async () => {
  const { instance, requests } = await fixture();
  await assert.rejects(
    exchange(instance, redirectUri + "?code=synthetic-code&state=wrong"),
  );
  await assert.rejects(
    exchange(
      instance,
      "https://attacker.invalid/api/auth/google/callback?code=synthetic-code&state=" +
        parameters.state,
    ),
  );
  assert.equal(
    requests.some((r) => r.url.endsWith("/token")),
    false,
  );
  const offline = provider((async () => {
    throw new Error("PRIVATE provider failure");
  }) as typeof fetch);
  await assert.rejects(
    offline.authorizationUrl(parameters),
    /Google sign-in is temporarily unavailable/,
  );
  await assert.rejects(
    exchange(offline),
    /Google could not verify this sign-in/,
  );
});
