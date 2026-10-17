import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { openDatabase } from "./core/db.js";
import { createStore, seedSamples } from "./core/store.js";
import { registerAuth } from "./core/auth.js";
import { registerResources } from "./core/resources.js";
import { registerUploads } from "./core/uploads.js";
import { HttpError } from "./core/types.js";
import { openApiDocument } from "./core/openapi.js";
import type { GoogleOidcProvider } from "./core/google-oidc.js";
import {
  initializeObservability,
  shutdownObservability,
} from "./observability.js";
export interface AppOptions {
  dataDir?: string;
  publicUrl?: string;
  secureCookies?: boolean;
  registerAi?: boolean;
  seed?: boolean;
  now?: () => number;
  logger?: boolean;
  originSecret?: string;
  googleProvider?: GoogleOidcProvider | null;
}
export async function buildApp(options: AppOptions = {}) {
  const publicUrl =
    options.publicUrl || process.env.APP_PUBLIC_URL || "http://127.0.0.1:5173";
  const origin = new URL(publicUrl).origin;
  const app = Fastify({
    logger: options.logger
      ? {
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            "req.headers.x-origin-secret",
            "res.headers.set-cookie",
          ],
          serializers: {
            // OAuth callbacks contain one-time codes/state in their query; never log them.
            req(request: any) {
              return {
                method: request.method,
                url: String(request.url || "").split("?")[0],
                remoteAddress: request.ip,
              };
            },
          },
        }
      : false,
    bodyLimit: 4 * 1024 * 1024,
    trustProxy: false,
  });
  const originSecret = options.originSecret ?? process.env.ORIGIN_SECRET;
  const trustedOrigin = (header: unknown) => {
    const a = Buffer.from(typeof header === "string" ? header : ""),
      b = Buffer.from(originSecret || "");
    return (
      Boolean(originSecret) && a.length === b.length && timingSafeEqual(a, b)
    );
  };
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const user = app.folio?.user(request);
      if (user) return `user:${user.id}`;
      const ip = request.headers["x-real-ip"];
      // Only Vercel's authenticated proxy may supply the client IP. Never trust arbitrary forwarded headers.
      if (
        trustedOrigin(request.headers["x-origin-secret"]) &&
        typeof ip === "string" &&
        isIP(ip)
      )
        return `ip:${ip}`;
      return request.ip;
    },
  });
  const dataDir = resolve(options.dataDir || process.env.DATA_DIR || "./data");
  const { db } = openDatabase(dataDir);
  const core = createStore(app, {
    db,
    dataDir,
    publicUrl: origin,
    now: options.now || Date.now,
  });
  app.decorate("folio", core);
  app.addHook("onClose", async () => {
    db.close();
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("cache-control", "private, no-store")
      .header("x-content-type-options", "nosniff")
      .header("referrer-policy", "same-origin");
    if (req.url.split("?")[0] === "/api/health") return;
    if (originSecret && !trustedOrigin(req.headers["x-origin-secret"]))
      throw new HttpError(403, "Use the Folio website to access this API.");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    )
      throw new HttpError(403, "Request origin is not allowed.");
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: "Invalid request.",
        details: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    const status = (error as any).statusCode || 500;
    if (status >= 500)
      app.log.error(
        {
          err: {
            name: (error as Error).name,
            message: (error as Error).message,
          },
          requestId: req.id,
        },
        "Request failed",
      );
    return reply.code(status).send({
      error:
        status >= 500
          ? "Something went wrong. Please try again."
          : (error as Error).message,
    });
  });
  app.get("/api/openapi.json", async () => openApiDocument(origin));
  app.get("/api/health", async () => ({
    status: "ok",
    version: process.env.APP_VERSION || "development",
  }));
  await registerAuth(
    app,
    options.secureCookies ?? origin.startsWith("https://"),
    options.googleProvider,
  );
  await registerResources(app, core);
  await registerUploads(app);
  if (options.seed !== false) seedSamples(core);
  if (options.registerAi !== false) {
    const { registerAiRoutes } = await import("./ai/routes.js");
    await registerAiRoutes(app);
  }
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  initializeObservability();
  let app;
  try {
    app = await buildApp({ logger: true });
  } catch (error) {
    await shutdownObservability();
    throw error;
  }
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    // Fastify's onClose hooks run in reverse registration order. Flush only after
    // all requests, generation workers, file workers, and the database have closed.
    try {
      await app.close();
    } finally {
      await shutdownObservability();
    }
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    await app.listen({
      port: Number(process.env.PORT || 3001),
      host: "0.0.0.0",
    });
  } catch (error) {
    await stop();
    throw error;
  }
}
