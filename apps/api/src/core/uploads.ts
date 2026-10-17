import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  mkdirSync,
  writeFileSync,
  unlinkSync,
  createReadStream,
  existsSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./types.js";
import { createFileQueue } from "./file-queue.js";
const maxBytes = 10 * 1024 * 1024;
async function parseFile(
  name: string,
  bytes: Buffer,
  progress: (percent: number) => void,
) {
  if (!bytes.length || bytes.length > maxBytes)
    throw new HttpError(400, "Choose a non-empty file up to 10 MB.");
  const ext = name.split(".").at(-1)?.toLowerCase();
  if (!["pdf", "txt", "md", "markdown"].includes(ext || ""))
    throw new HttpError(400, "Choose a PDF, Markdown or plain text file.");
  let pages: { page: number; text: string }[] = [];
  if (ext === "pdf") {
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")))
      throw new HttpError(400, "This is not a valid PDF document.");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    let loadingTask;
    try {
      loadingTask = getDocument({
        data: new Uint8Array(bytes),
        isEvalSupported: false,
        useSystemFonts: true,
      } as any);
      const doc = await loadingTask.promise;
      if (doc.numPages > 500)
        throw new HttpError(400, "Upload PDF documents with up to 500 pages.");
      let chars = 0;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const text = content.items
          .map((i: any) => (i.str ? `${i.str}${i.hasEOL ? "\n" : " "}` : ""))
          .join("")
          .trim();
        chars += text.length;
        if (chars > 2_000_000)
          throw new HttpError(
            400,
            "This document contains too much text. Split it into smaller files.",
          );
        pages.push({ page: n, text });
        page.cleanup();
        progress(10 + (n / doc.numPages) * 85);
      }
    } catch (error: any) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        400,
        error.name === "PasswordException"
          ? "Upload an unlocked PDF."
          : "This PDF could not be parsed. Try a text-based PDF.",
      );
    } finally {
      await loadingTask?.destroy();
    }
  } else {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true })
        .decode(bytes)
        .replace(/\u0000/g, "")
        .trim();
    } catch {
      throw new HttpError(400, "Save text documents using UTF-8 encoding.");
    }
    if (text.length > 2_000_000)
      throw new HttpError(400, "Split this text into smaller documents.");
    pages = [{ page: 1, text }];
  }
  const text = pages
    .map((p) => p.text)
    .join("\n\n")
    .trim();
  if (text.replace(/\s/g, "").length < 5)
    throw new HttpError(
      400,
      "No readable text found. Scanned PDFs need OCR before uploading.",
    );
  return {
    name,
    type: ext === "markdown" ? "md" : ext!,
    size: bytes.length,
    pages,
    text,
  };
}
export async function registerUploads(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: maxBytes },
    (_req, body, done) => done(null, body),
  );
  const { db, dataDir, requireUser, get, canReadCourse, canReadMaterial } =
    app.folio;
  const folder = join(dataDir, "originals");
  mkdirSync(folder, { recursive: true });
  const queue = createFileQueue(db, parseFile);
  app.addHook("onClose", () => queue.close());
  app.put(
    "/api/materials/:id/original",
    { bodyLimit: maxBytes },
    async (req, reply) => {
      const user = requireUser(req);
      const id = z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,160}$/)
        .parse((req.params as any).id);
      const courseId = z
        .string()
        .min(1)
        .parse((req.query as any).courseId);
      if (!canReadCourse(user, courseId))
        throw new HttpError(403, "This course is unavailable.");
      if (get("materials", id))
        throw new HttpError(
          409,
          "Original files are immutable. Upload a new material instead.",
        );
      const old = db
        .prepare(
          "SELECT user_id,path,course_id FROM originals WHERE material_id=?",
        )
        .get(id) as any;
      if (old && old.user_id !== user.id)
        throw new HttpError(403, "This upload belongs to another account.");
      if (old && old.course_id !== courseId)
        throw new HttpError(409, "The upload course cannot be changed.");
      const current = queue.get(id);
      if (current && ["queued", "running"].includes(current.status))
        throw new HttpError(409, "This document is already being parsed.");
      queue.checkCapacity(user.id);
      const header = req.headers["x-file-name"];
      let name = "";
      try {
        name = decodeURIComponent(typeof header === "string" ? header : "");
      } catch {}
      name = z.string().trim().min(1).max(180).parse(name);
      if (name.includes("/") || name.includes("\\") || /[\x00-\x1f]/.test(name))
        throw new HttpError(400, "Invalid file name.");
      if (!Buffer.isBuffer(req.body))
        throw new HttpError(
          415,
          "Upload the original bytes with application/octet-stream.",
        );
      const extension = name.split(".").at(-1)?.toLowerCase();
      if (!["pdf", "txt", "md", "markdown"].includes(extension || ""))
        throw new HttpError(400, "Choose a PDF, Markdown or plain text file.");
      if (!req.body.length || req.body.length > maxBytes)
        throw new HttpError(400, "Choose a non-empty file up to 10 MB.");
      const metadata = {
        name,
        type: extension === "markdown" ? "md" : extension,
        size: req.body.length,
      };
      const filePath = join(folder, randomUUID());
      writeFileSync(filePath, req.body, { mode: 0o600 });
      let jobId: string;
      try {
        jobId = db.transaction(() => {
          db.prepare(
            "INSERT INTO originals(material_id,user_id,course_id,path,metadata,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(material_id) DO UPDATE SET path=excluded.path,metadata=excluded.metadata,created_at=excluded.created_at",
          ).run(
            id,
            user.id,
            courseId,
            filePath,
            JSON.stringify(metadata),
            Date.now(),
          );
          return queue.enqueue(id, user.id);
        })();
      } catch (e) {
        unlinkSync(filePath);
        throw e;
      }
      if (old?.path && existsSync(old.path)) unlinkSync(old.path);
      return reply.code(202).send({ jobId });
    },
  );
  app.get("/api/materials/:id/processing", async (req) => {
    const user = requireUser(req),
      job = queue.get((req.params as any).id);
    if (!job || job.userId !== user.id)
      throw new HttpError(404, "This processing task is unavailable.");
    const { userId, materialId, ...safe } = job;
    return { job: safe };
  });
  app.get("/api/materials/:id/original", async (req, reply) => {
    const user = requireUser(req);
    const id = (req.params as any).id;
    const record = get("materials", id);
    const staged = db
      .prepare("SELECT * FROM originals WHERE material_id=?")
      .get(id) as any;
    if (
      record
        ? !canReadMaterial(user, record)
        : !staged || staged.user_id !== user.id
    )
      throw new HttpError(404, "This original file is unavailable.");
    const filePath = staged?.path || record?.filePath;
    if (
      !filePath ||
      !resolve(filePath).startsWith(resolve(dataDir) + sep) ||
      !existsSync(filePath)
    )
      throw new HttpError(404, "The original file is unavailable.");
    const metadata = record || JSON.parse(staged.metadata);
    const filename = String(metadata.name).replace(/[\r\n"\\]/g, "_");
    reply.header("x-file-name", encodeURIComponent(filename));
    reply.header(
      "content-type",
      metadata.mimeType ||
        (metadata.type === "pdf"
          ? "application/pdf"
          : "text/plain; charset=utf-8"),
    );
    reply.header(
      "content-disposition",
      `${metadata.type === "pdf" ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return reply.send(createReadStream(filePath));
  });
}
