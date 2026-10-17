import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createSiweMessage } from "viem/siwe";
import { getAddress, isAddress, verifyMessage } from "viem";
import { z } from "zod";
import { HttpError, type User } from "./types.js";
import {
  registerGoogle,
  oauthBrowserCookie,
  oauthBrowserCookiePath,
} from "./google.js";
import {
  createGoogleOidcProvider,
  type GoogleOidcProvider,
} from "./google-oidc.js";
export const sessionCookie = "folio_session";
const browserCookie = "folio_login";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function toUser(row: any): User {
  const initials = String(row.name || "Account")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((v: string) => v[0])
    .join("")
    .toUpperCase();
  return {
    id: row.id,
    name: row.name,
    studentId: row.student_id,
    role: row.role || "student",
    profileComplete: Boolean(row.profile_complete),
    walletAddress: row.wallet_address || null,
    googleLinked: Boolean(row.google_sub),
    googleEmail: row.google_email || null,
    authMethod: row.auth_method || (row.wallet_address ? "wallet" : "google"),
    initials,
    color: row.role === "teacher" ? "#b16c4b" : "#3156d3",
  };
}
export function requestUser(
  app: FastifyInstance,
  request: FastifyRequest,
): User | null {
  const token = request.cookies[sessionCookie];
  if (!token) return null;
  const row = app.folio.db
    .prepare(
      "SELECT u.*,COALESCE(m.method,'wallet') AS auth_method FROM users u JOIN auth_sessions s ON s.user_id=u.id LEFT JOIN auth_session_methods m ON m.token_hash=s.token_hash WHERE s.token_hash=? AND s.expires_at>?",
    )
    .get(hash(token), app.folio.now());
  return row ? toUser(row) : null;
}
export function authCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/api" };
}
/** Call inside the authentication transaction, then set the cookie after commit. */
export function createSession(
  app: FastifyInstance,
  request: FastifyRequest,
  userId: string,
  method: "wallet" | "google" = "wallet",
) {
  const { db, now } = app.folio;
  const token = randomBytes(32).toString("base64url");
  const timestamp = now();
  const old = request.cookies[sessionCookie];
  if (old)
    db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(hash(old));
  db.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").run(timestamp);
  db.prepare(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
  ).run(hash(token), userId, timestamp + 7 * 86400_000, timestamp);
  db.prepare(
    "INSERT INTO auth_session_methods(token_hash,method) VALUES(?,?)",
  ).run(hash(token), method);
  return token;
}
export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  secure: boolean,
) {
  reply.setCookie(sessionCookie, token, {
    ...authCookieOptions(secure),
    maxAge: 7 * 86400,
  });
}
export async function registerAuth(
  app: FastifyInstance,
  secure: boolean,
  googleProvider?: GoogleOidcProvider | null,
) {
  const { db, now, publicUrl } = app.folio;
  const origin = new URL(publicUrl);
  const cookieOptions = authCookieOptions(secure);
  await registerGoogle(
    app,
    secure,
    googleProvider === undefined ? createGoogleOidcProvider() : googleProvider,
  );
  const challengeSchema = z
    .object({
      address: z.string().refine(isAddress, "Invalid Ethereum address"),
      chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict();
  app.get("/api/auth/me", async (request) => ({
    user: app.folio.user(request),
  }));
  app.post(
    "/api/auth/challenge",
    { config: { rateLimit: { max: 20, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      const { address, chainId } = challengeSchema.parse(request.body);
      const timestamp = now();
      const browser = randomBytes(32).toString("base64url");
      const expires = new Date(timestamp + 300_000);
      const message = createSiweMessage({
        address: getAddress(address),
        chainId,
        domain: origin.host,
        uri: origin.origin,
        version: "1",
        nonce: randomBytes(16).toString("hex"),
        statement:
          "Sign in to Folio. This does not send a transaction or charge gas.",
        issuedAt: new Date(timestamp),
        expirationTime: expires,
      });
      db.prepare(
        "DELETE FROM auth_challenges WHERE expires_at<? OR consumed_at IS NOT NULL",
      ).run(timestamp - 300_000);
      db.prepare(
        "INSERT INTO auth_challenges(id,browser_hash,address,message,expires_at) VALUES(?,?,?,?,?)",
      ).run(
        randomUUID(),
        hash(browser),
        getAddress(address),
        message,
        expires.getTime(),
      );
      reply.setCookie(browserCookie, browser, {
        ...cookieOptions,
        path: "/api/auth",
        maxAge: 300,
      });
      return { message };
    },
  );
  app.post(
    "/api/auth/verify",
    { config: { rateLimit: { max: 30, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      const { message, signature } = z
        .object({
          message: z.string().max(4096),
          signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
        })
        .strict()
        .parse(request.body);
      const browser = request.cookies[browserCookie];
      if (!browser)
        throw new HttpError(
          401,
          "The login challenge expired. Connect your wallet again.",
        );
      const challenge = db
        .prepare(
          "SELECT * FROM auth_challenges WHERE message=? AND browser_hash=? AND consumed_at IS NULL AND expires_at>?",
        )
        .get(message, hash(browser), now()) as any;
      if (!challenge)
        throw new HttpError(
          401,
          "The login challenge expired or was already used.",
        );
      let valid = false;
      try {
        valid = await verifyMessage({
          address: challenge.address,
          message,
          signature: signature as `0x${string}`,
        });
      } catch {}
      if (!valid)
        throw new HttpError(401, "The wallet signature could not be verified.");
      const timestamp = now();
      let token = "";
      const user = db.transaction(() => {
        const consumed = db
          .prepare(
            "UPDATE auth_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>?",
          )
          .run(timestamp, challenge.id, timestamp);
        if (consumed.changes !== 1)
          throw new HttpError(401, "The login challenge was already used.");
        db.prepare(
          "INSERT OR IGNORE INTO users(id,wallet_address,created_at) VALUES(?,?,?)",
        ).run(
          `u-${randomUUID()}`,
          challenge.address,
          new Date(timestamp).toISOString(),
        );
        const row = db
          .prepare("SELECT * FROM users WHERE wallet_address=? COLLATE NOCASE")
          .get(challenge.address) as any;
        token = createSession(app, request, row.id);
        return toUser(row);
      })();
      reply.clearCookie(browserCookie, { path: "/api/auth" });
      setSessionCookie(reply, token, secure);
      return { user };
    },
  );
  app.post("/api/auth/profile", async (request) => {
    const actor = app.folio.user(request);
    if (!actor) throw new HttpError(401, "Please sign in.");
    const input = z
      .object({
        name: z.string().trim().min(1).max(80),
        studentId: z.string().trim().max(40).optional().default(""),
        role: z.enum(["student", "teacher"]),
      })
      .strict()
      .parse(request.body);
    if (input.role === "student" && !input.studentId)
      throw new HttpError(400, "Students must provide their student number.");
    const user = db.transaction(() => {
      const row = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(actor.id) as any;
      if (row.profile_complete && row.role !== input.role)
        throw new HttpError(
          409,
          "Account roles cannot be changed after onboarding.",
        );
      db.prepare(
        "UPDATE users SET name=?,student_id=?,role=?,profile_complete=1 WHERE id=?",
      ).run(input.name, input.studentId, input.role, actor.id);
      return toUser({
        ...(db
          .prepare("SELECT * FROM users WHERE id=?")
          .get(actor.id) as object),
        auth_method: actor.authMethod,
      });
    })();
    return { user };
  });
  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (token)
      db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(
        hash(token),
      );
    const browser = request.cookies[oauthBrowserCookie];
    if (browser)
      db.prepare("DELETE FROM google_oauth_states WHERE browser_hash=?").run(
        hash(browser),
      );
    reply
      .clearCookie(sessionCookie, { path: "/api" })
      .clearCookie(browserCookie, { path: "/api/auth" })
      .clearCookie(oauthBrowserCookie, { path: oauthBrowserCookiePath });
    return { ok: true };
  });
}
