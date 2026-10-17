import type { FastifyInstance, FastifyReply } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  authCookieOptions,
  createSession,
  hash,
  sessionCookie,
  setSessionCookie,
} from "./auth.js";
import { HttpError } from "./types.js";
import type { GoogleOidcProvider } from "./google-oidc.js";

export const oauthBrowserCookie = "folio_google";
export const oauthBrowserCookiePath = "/api/auth";
const cookiePath = oauthBrowserCookiePath;
const random = () => randomBytes(32).toString("base64url");
interface OAuthState {
  state_hash: string;
  browser_hash: string;
  nonce: string;
  code_verifier: string;
  mode: "login" | "link";
  link_user_id: string | null;
  link_session_hash: string | null;
  expires_at: number;
}

export async function registerGoogle(
  app: FastifyInstance,
  secure: boolean,
  provider: GoogleOidcProvider | null,
) {
  const { db, now, publicUrl } = app.folio;
  const canonical = new URL(publicUrl).origin;
  const redirectUri = `${canonical}/api/auth/google/callback`;
  const redirect = (reply: FastifyReply, parameter: string, value: string) => {
    const target = new URL("/", canonical);
    target.searchParams.set(parameter, value);
    return reply
      .header("referrer-policy", "no-referrer")
      .clearCookie(oauthBrowserCookie, { path: cookiePath })
      .redirect(target.href, 303);
  };
  app.get("/api/auth/providers", async () => ({
    google: Boolean(provider),
    wallet: true,
  }));
  app.post(
    "/api/auth/google/start",
    { config: { rateLimit: { max: 20, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      if (!provider)
        throw new HttpError(503, "Google sign-in is not configured.");
      const { mode } = z
        .object({ mode: z.enum(["login", "link"]).default("login") })
        .strict()
        .parse(request.body || {});
      const actor = mode === "link" ? app.folio.user(request) : null;
      if (mode === "link" && !actor)
        throw new HttpError(401, "Sign in before linking a Google account.");
      const session = request.cookies[sessionCookie];
      const state = random(),
        browser = random(),
        nonce = random(),
        codeVerifier = random();
      const timestamp = now();
      // Provider discovery can fail; don't persist a challenge until a usable
      // authorization URL exists. No redirect supplied by the browser is used.
      let url: string;
      try {
        url = await provider.authorizationUrl({
          state,
          nonce,
          codeVerifier,
          redirectUri,
        });
      } catch {
        throw new HttpError(503, "Google sign-in is temporarily unavailable.");
      }
      db.transaction(() => {
        db.prepare("DELETE FROM google_oauth_states WHERE expires_at<=?").run(
          timestamp,
        );
        if (mode === "link") {
          const validSession = db
            .prepare(
              "SELECT 1 FROM auth_sessions WHERE token_hash=? AND user_id=? AND expires_at>?",
            )
            .get(hash(session || ""), actor!.id, now());
          if (!validSession)
            throw new HttpError(401, "Your sign-in session expired.");
        }
        db.prepare(
          "INSERT INTO google_oauth_states(state_hash,browser_hash,nonce,code_verifier,mode,link_user_id,link_session_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        ).run(
          hash(state),
          hash(browser),
          nonce,
          codeVerifier,
          mode,
          actor?.id || null,
          actor ? hash(session!) : null,
          timestamp + 600_000,
          timestamp,
        );
      })();
      reply.setCookie(oauthBrowserCookie, browser, {
        ...authCookieOptions(secure),
        path: cookiePath,
        maxAge: 600,
      });
      return { url };
    },
  );
  app.get(
    "/api/auth/google/callback",
    { config: { rateLimit: { max: 30, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      if (!provider) return redirect(reply, "auth_error", "google_unavailable");
      const query = request.query as Record<string, unknown>;
      const state = query.state,
        browser = request.cookies[oauthBrowserCookie];
      if (typeof state !== "string" || state.length > 256 || !state || !browser)
        return redirect(reply, "auth_error", "google_invalid_state");
      // Consume atomically BEFORE any asynchronous provider work, including a
      // cancellation response. Parallel callbacks cannot reuse an OAuth code.
      const pending = db.transaction(() => {
        const row = db
          .prepare(
            "SELECT * FROM google_oauth_states WHERE state_hash=? AND browser_hash=? AND consumed_at IS NULL AND expires_at>?",
          )
          .get(hash(state), hash(browser), now()) as OAuthState | undefined;
        if (!row) return null;
        const consumed = db
          .prepare(
            "UPDATE google_oauth_states SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL AND expires_at>?",
          )
          .run(now(), row.state_hash, now());
        return consumed.changes === 1 ? row : null;
      })();
      if (!pending)
        return redirect(reply, "auth_error", "google_invalid_state");
      const linkSessionValid = () => {
        const token = request.cookies[sessionCookie];
        if (!token || hash(token) !== pending.link_session_hash) return false;
        return Boolean(
          db
            .prepare(
              "SELECT 1 FROM auth_sessions WHERE token_hash=? AND user_id=? AND expires_at>?",
            )
            .get(hash(token), pending.link_user_id, now()),
        );
      };
      if (pending.mode === "link" && !linkSessionValid())
        return redirect(reply, "auth_error", "google_link_session_expired");
      if (query.error)
        return redirect(
          reply,
          "auth_error",
          query.error === "access_denied"
            ? "google_cancelled"
            : "google_failed",
        );
      try {
        const identity = z
          .object({
            subject: z.string().min(1).max(255),
            email: z.string().email().max(320),
            emailVerified: z.literal(true),
            name: z.string().max(200).optional(),
          })
          .parse(
            await provider.exchange({
              callbackUrl: new URL(request.url, canonical).href,
              state,
              nonce: pending.nonce,
              codeVerifier: pending.code_verifier,
              redirectUri,
            }),
          );
        const result = db.transaction(() => {
          // Recheck after the network await: logout/session expiration while
          // Google is responding must invalidate an in-flight account link.
          if (pending.mode === "link" && !linkSessionValid())
            return { error: "google_link_session_expired" } as const;
          // Logout also revokes login-mode challenges. Consumed states remain
          // until expiry so another browser's start cannot interrupt this one.
          if (
            !db
              .prepare(
                "SELECT 1 FROM google_oauth_states WHERE state_hash=? AND browser_hash=? AND consumed_at IS NOT NULL",
              )
              .get(pending.state_hash, pending.browser_hash)
          )
            return { error: "google_invalid_state" } as const;
          const existing = db
            .prepare("SELECT id FROM users WHERE google_sub=?")
            .get(identity.subject) as { id: string } | undefined;
          let userId: string;
          if (pending.mode === "link") {
            userId = pending.link_user_id!;
            const actor = db
              .prepare("SELECT google_sub FROM users WHERE id=?")
              .get(userId) as { google_sub: string | null };
            if (
              (existing && existing.id !== userId) ||
              (actor.google_sub && actor.google_sub !== identity.subject)
            )
              return { error: "google_account_conflict" } as const;
            db.prepare(
              "UPDATE users SET google_sub=?,google_email=? WHERE id=?",
            ).run(identity.subject, identity.email, userId);
          } else {
            userId = existing?.id || `u-${randomUUID()}`;
            if (!existing)
              db.prepare(
                "INSERT INTO users(id,wallet_address,google_sub,google_email,name,created_at) VALUES(?,NULL,?,?,?,?)",
              ).run(
                userId,
                identity.subject,
                identity.email,
                (identity.name || "").trim().slice(0, 80),
                new Date(now()).toISOString(),
              );
            else
              db.prepare("UPDATE users SET google_email=? WHERE id=?").run(
                identity.email,
                userId,
              );
          }
          return { token: createSession(app, request, userId, "google") };
        })();
        if (result.error) return redirect(reply, "auth_error", result.error);
        setSessionCookie(reply, result.token!, secure);
        return redirect(
          reply,
          "auth",
          pending.mode === "link" ? "linked" : "success",
        );
      } catch {
        // Provider errors can contain authorization codes, token bodies and
        // user details. Never log or return their messages.
        return redirect(reply, "auth_error", "google_failed");
      }
    },
  );
}
