import * as oidc from "openid-client";

export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}
export interface GoogleOidcProvider {
  authorizationUrl(input: {
    state: string;
    nonce: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<string> | string;
  exchange(input: {
    callbackUrl: string;
    state: string;
    nonce: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleIdentity>;
}

/** No tokens leave the server; test transport injection cannot be enabled by a request or env flag. */
export function createGoogleOidcProvider(
  options: { fetch?: typeof fetch } = {},
): GoogleOidcProvider | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  let pending: Promise<oidc.Configuration> | undefined;
  const configuration = () => {
    pending ??= oidc
      .discovery(
        new URL("https://accounts.google.com"),
        clientId,
        { id_token_signed_response_alg: "RS256" },
        oidc.ClientSecretPost(clientSecret),
        {
          timeout: 10,
          execute: [oidc.enableNonRepudiationChecks],
          // oauth4webapi also types Uint8Array bodies; native Fetch supports those at runtime.
          ...(options.fetch
            ? { [oidc.customFetch]: options.fetch as oidc.CustomFetch }
            : {}),
        },
      )
      .catch(() => {
        pending = undefined;
        throw new Error("Google sign-in is temporarily unavailable.");
      });
    return pending;
  };
  return {
    async authorizationUrl({ state, nonce, codeVerifier, redirectUri }) {
      try {
        const config = await configuration();
        return oidc.buildAuthorizationUrl(config, {
          redirect_uri: redirectUri,
          scope: "openid email profile",
          response_type: "code",
          state,
          nonce,
          code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
          code_challenge_method: "S256",
          prompt: "select_account",
        }).href;
      } catch {
        throw new Error("Google sign-in is temporarily unavailable.");
      }
    },
    async exchange({ callbackUrl, state, nonce, codeVerifier, redirectUri }) {
      try {
        const url = new URL(callbackUrl);
        // Never let forwarded Host/Origin or callback query parameters select the redirect URI.
        if (url.origin + url.pathname !== redirectUri)
          throw new Error("invalid_callback");
        const config = await configuration();
        const tokens = await oidc.authorizationCodeGrant(config, url, {
          expectedState: state,
          expectedNonce: nonce,
          pkceCodeVerifier: codeVerifier,
          idTokenExpected: true,
        });
        const claims = tokens.claims();
        if (
          !claims ||
          typeof claims.sub !== "string" ||
          !claims.sub ||
          claims.sub.length > 255 ||
          typeof claims.email !== "string" ||
          claims.email.length > 320 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) ||
          claims.email_verified !== true
        )
          throw new Error("invalid_identity");
        return {
          subject: claims.sub,
          email: claims.email,
          emailVerified: true,
          ...(typeof claims.name === "string"
            ? {
                name: claims.name
                  .replace(/[\u0000-\u001f]/g, "")
                  .trim()
                  .slice(0, 80),
              }
            : {}),
        };
      } catch {
        // OAuth/JWT exceptions can contain authorization codes, tokens, or identity claims.
        throw new Error(
          "Google could not verify this sign-in. Please try again.",
        );
      }
    },
  };
}
