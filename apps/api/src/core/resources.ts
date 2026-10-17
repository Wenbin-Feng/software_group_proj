import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError, type RecordData, type User } from "./types.js";
import type { createStore } from "./store.js";
const idSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const title = z.string().trim().min(1).max(200);
const iso = () => new Date().toISOString();
function deny(
  condition: any,
  message = "You do not have permission to change this record.",
) {
  if (!condition) throw new HttpError(403, message);
}
function sameOwner(
  old: RecordData | undefined,
  next: RecordData,
  fields: string[],
) {
  if (old)
    for (const field of fields)
      if (next[field] !== old[field])
        throw new HttpError(409, `The ${field} cannot be changed.`);
}
const withoutUndefined = (r: RecordData) => JSON.parse(JSON.stringify(r));
export async function registerResources(
  app: FastifyInstance,
  core: ReturnType<typeof createStore>,
) {
  const {
    db,
    get,
    put,
    all,
    requireUser,
    canReadCourse,
    canTeach,
    canReadMaterial,
    canReadSession,
    canReadNote,
  } = core;
  app.get("/api/workspace", async (req) => core.workspace(requireUser(req)));
  app.post("/api/courses", async (req) => {
    const user = requireUser(req);
    deny(user.role === "teacher", "Only teachers can create courses.");
    const input = z
      .object({
        name: title,
        code: z.string().trim().min(1).max(40),
        description: z.string().trim().max(2000).optional().default(""),
      })
      .strict()
      .parse(req.body);
    const record = {
      ...input,
      id: `c-${randomUUID()}`,
      teacherId: user.id,
      instructor: user.name,
      joinCode: randomBytes(5).toString("hex").toUpperCase(),
      term: new Date().getFullYear().toString(),
      color: "#3156d3",
      createdAt: iso(),
    };
    put("courses", record);
    return { course: record, record };
  });
  app.post("/api/courses/join", async (req) => {
    const user = requireUser(req);
    deny(user.role === "student", "Only student accounts join courses.");
    const { code } = z
      .object({ code: z.string().trim().min(1).max(80) })
      .strict()
      .parse(req.body);
    const course = all("courses").find(
      (c) => String(c.joinCode).toUpperCase() === code.toUpperCase(),
    );
    if (!course)
      throw new HttpError(
        404,
        "This course code was not found. Ask your teacher for the current code.",
      );
    const id = `${course.id}_${user.id}`;
    if (!get("enrollments", id))
      put("enrollments", {
        id,
        courseId: course.id,
        studentId: user.id,
        joinedAt: iso(),
      });
    const { joinCode, ...safe } = course;
    return { course: safe };
  });
  app.post("/api/courses/:id/join-code/reset", async (req) => {
    const user = requireUser(req),
      { id } = req.params as any;
    deny(canTeach(user, id));
    const course = get("courses", id)!;
    course.joinCode = randomBytes(5).toString("hex").toUpperCase();
    put("courses", course);
    return { course, joinCode: course.joinCode };
  });
  for (const collection of [
    "sessions",
    "notes",
    "market",
    "threads",
    "materials",
  ]) {
    app.put(`/api/${collection}/:id`, async (req) => {
      const user = requireUser(req);
      const id = idSchema.parse((req.params as any).id);
      const input = z
        .object({ record: z.record(z.string(), z.unknown()) })
        .strict()
        .parse(req.body).record as RecordData;
      if (input.id !== id)
        throw new HttpError(400, "Record ID does not match the request.");
      const existing = get(collection, id);
      const courseId = z.string().min(1).parse(input.courseId);
      deny(canReadCourse(user, courseId));
      sameOwner(existing, input, ["courseId"]);
      let record: RecordData;
      if (collection === "sessions") {
        deny(
          user.role === "student" &&
            (!existing || existing.studentId === user.id),
        );
        sameOwner(existing, input, ["studentId"]);
        if (input.studentId !== user.id)
          throw new HttpError(403, "Sessions must belong to your account.");
        const messages = z
          .array(
            z
              .object({
                id: idSchema,
                role: z.enum(["user", "assistant"]),
                content: z.string().max(100_000),
              })
              .passthrough(),
          )
          .max(1000)
          .parse(input.messages || []);
        const prior = existing?.messages || [];
        if (
          messages.length < prior.length ||
          !prior.every(
            (m: any, i: number) =>
              messages[i]?.id === m.id &&
              messages[i]?.role === m.role &&
              messages[i]?.content === m.content,
          )
        )
          throw new HttpError(
            409,
            "Session messages changed on the server. Refresh before saving.",
          );
        if (messages.slice(prior.length).some((m) => m.role !== "user"))
          throw new HttpError(
            403,
            "Assistant messages are created by the server.",
          );
        record = {
          ...existing,
          id,
          courseId,
          studentId: user.id,
          title: title.parse(input.title || "New learning session"),
          messages: [
            ...prior,
            ...messages
              .slice(prior.length)
              .map((m) => ({ id: m.id, role: "user", content: m.content })),
          ],
          updatedAt: iso(),
          animation: existing?.animation || null,
        };
      } else if (collection === "notes") {
        deny(
          user.role === "student" &&
            input.studentId === user.id &&
            (!existing || canReadNote(user, existing)),
        );
        sameOwner(existing, input, ["studentId"]);
        const sourceSession =
          input.sourceSessionId && get("sessions", input.sourceSessionId);
        if (input.sourceSessionId)
          deny(
            sourceSession &&
              sourceSession.courseId === courseId &&
              canReadSession(user, sourceSession),
          );
        const sourceMessage =
          input.sourceMessageId &&
          sourceSession?.messages?.find(
            (m: any) =>
              m.id === input.sourceMessageId && m.role === "assistant",
          );
        if (input.sourceMessageId)
          deny(
            sourceMessage,
            "Source messages must belong to your selected learning session.",
          );
        // HTML is copied only from an authorized server-generated message or immutable publication.
        // Client-supplied visualizationHtml never enters persisted notes.
        let visualizationHtml =
          existing?.visualizationHtml || sourceMessage?.visualizationHtml;
        const source =
          input.source && get("materials", input.source.materialId);
        const sourcePage = input.source
          ? z
              .number()
              .int()
              .positive()
              .parse(input.source.page || 1)
          : null;
        if (input.source)
          deny(
            source &&
              source.courseId === courseId &&
              canReadMaterial(user, source) &&
              source.pages?.some((p: any) => p.page === sourcePage),
            "Select an actual page from a material in this course.",
          );
        let attribution: any;
        if (input.importedFrom) {
          const publication = get(
            "market",
            z.string().max(160).parse(input.importedFrom),
          );
          deny(
            publication &&
              publication.courseId === courseId &&
              canReadCourse(user, publication.courseId),
            "Import publications from this course only.",
          );
          const pageId = z
            .string()
            .max(160)
            .parse(
              input.importedPageId ||
                existing?.importedPageId ||
                publication?.noteId,
            );
          const importedPage = publication?.pages?.find(
            (p: any) => p.id === pageId,
          );
          deny(
            importedPage,
            "This page is not part of the published snapshot.",
          );
          visualizationHtml =
            existing?.visualizationHtml || importedPage?.visualizationHtml;
          attribution = {
            publicationId: publication!.id,
            author: publication!.author,
            authorId: publication!.authorId,
            version: publication!.version,
            title: publication!.title,
          };
          input.importedPageId = pageId;
        }
        sameOwner(existing, input, ["importedFrom", "importedPageId"]);
        record = {
          id,
          courseId,
          studentId: user.id,
          title: title.parse(input.title),
          content: z
            .string()
            .max(1_000_000)
            .parse(input.content || ""),
          category: z
            .string()
            .max(100)
            .parse(input.category || "Concepts"),
          tags: z
            .array(z.string().max(60))
            .max(30)
            .parse(input.tags || []),
          links: z
            .array(idSchema)
            .max(1000)
            .parse(input.links || []),
          updatedAt: iso(),
          hasAnimation:
            Boolean(visualizationHtml) || Boolean(input.hasAnimation),
          animation: visualizationHtml
            ? "html"
            : typeof input.animation === "string"
              ? input.animation
              : null,
          ...(typeof visualizationHtml === "string" && visualizationHtml
            ? { visualizationHtml }
            : {}),
          ...(input.source
            ? {
                source: {
                  materialId: source!.id,
                  name: source!.name,
                  page: sourcePage,
                },
              }
            : {}),
          ...(input.sourceSessionId
            ? { sourceSessionId: input.sourceSessionId }
            : {}),
          ...(typeof input.sourceMessageId === "string"
            ? { sourceMessageId: input.sourceMessageId }
            : {}),
          ...(input.importedFrom
            ? {
                importedFrom: input.importedFrom,
                importedPageId: input.importedPageId,
                attribution,
              }
            : {}),
        };
        for (const linkId of record.links) {
          const link = get("notes", linkId);
          if (link) deny(canReadNote(user, link));
        }
      } else if (collection === "market") {
        if (!existing) {
          deny(user.role === "student" && input.authorId === user.id);
          const ids = z
            .array(idSchema)
            .min(1)
            .max(100)
            .parse(input.noteIds || [input.noteId]);
          const notes = ids.map((noteId) => get("notes", noteId));
          deny(
            notes.every(
              (n) => n && n.courseId === courseId && canReadNote(user, n),
            ),
            "You can only publish your own notes from this course.",
          );
          const pages = notes.map((n) => {
            const m = n!.source && get("materials", n!.source.materialId);
            return {
              id: n!.id,
              title: n!.title,
              content: n!.content,
              category: n!.category,
              tags: n!.tags || [],
              links: (n!.links || []).filter((v: string) => ids.includes(v)),
              hasAnimation:
                Boolean(n!.visualizationHtml) || Boolean(n!.hasAnimation),
              animation: n!.visualizationHtml ? "html" : n!.animation || null,
              ...(typeof n!.visualizationHtml === "string" &&
              n!.visualizationHtml
                ? { visualizationHtml: n!.visualizationHtml }
                : {}),
              ...(m && !m.ownerId && m.courseId === courseId
                ? {
                    source: {
                      materialId: m.id,
                      name: m.name,
                      page: n!.source.page,
                    },
                  }
                : {}),
            };
          });
          const versions = all("market")
            .filter((m) => m.authorId === user.id && m.noteId === ids[0])
            .map((m) => Number(m.version) || 1);
          record = {
            id,
            courseId,
            noteId: ids[0],
            noteIds: ids,
            pages,
            title: title.parse(input.title),
            description: z
              .string()
              .max(2000)
              .parse(input.description || ""),
            authorId: user.id,
            author: user.name,
            initials: user.initials,
            color: user.color,
            category: z
              .string()
              .max(100)
              .parse(input.category || "Concepts"),
            content: pages
              .map((n) =>
                pages.length > 1 ? `# ${n.title}\n\n${n.content}` : n.content,
              )
              .join("\n\n---\n\n"),
            tags: [...new Set(pages.flatMap((n) => n.tags))],
            version: Math.max(0, ...versions) + 1,
            updatedAt: iso(),
            likes: 0,
            likedBy: [],
            bookmarkedBy: [],
            featured: false,
            hasAnimation: pages.some((n) => n.hasAnimation),
            animation: pages[0].animation,
            pageCount: pages.length,
          };
        } else {
          sameOwner(existing, input, ["authorId", "noteId"]);
          const toggle = (field: string) => {
            const saved = new Set<string>(existing[field] || []);
            if ((input[field] || []).includes(user.id)) saved.add(user.id);
            else saved.delete(user.id);
            return [...saved];
          };
          const bookmarkedBy = toggle("bookmarkedBy"),
            likedBy = toggle("likedBy");
          record = {
            ...existing,
            bookmarkedBy,
            likedBy,
            likes: likedBy.length,
          };
          if (Boolean(input.featured) !== Boolean(existing.featured)) {
            deny(
              canTeach(user, courseId),
              "Only the course teacher can feature publications.",
            );
            record.featured = Boolean(input.featured);
            record.featuredBy = record.featured ? user.id : null;
          }
        }
      } else if (collection === "threads") {
        record = saveThread(user, input, existing, core);
      } else {
        if (existing) {
          deny(
            canReadMaterial(user, existing) &&
              (existing.ownerId === user.id ||
                (!existing.ownerId && canTeach(user, courseId))),
          );
          sameOwner(existing, input, ["ownerId"]);
          const archived = Boolean(input.archivedAt);
          record = {
            ...existing,
            name: title.parse(input.name),
            archivedAt: archived ? existing.archivedAt || iso() : null,
            archivedBy: archived ? user.id : null,
          };
        } else {
          const staged = db
            .prepare("SELECT * FROM originals WHERE material_id=?")
            .get(id) as any;
          if (
            !staged ||
            staged.user_id !== user.id ||
            staged.course_id !== courseId
          )
            throw new HttpError(
              400,
              "Upload the original file before saving this material.",
            );
          const processing = db
            .prepare("SELECT status FROM file_jobs WHERE material_id=?")
            .get(id) as any;
          if (processing && processing.status !== "succeeded")
            throw new HttpError(
              409,
              processing.status === "failed"
                ? "This file could not be parsed. Upload a readable document."
                : "The document is still being parsed. Please wait before saving it.",
            );
          if (!Array.isArray(JSON.parse(staged.metadata).pages))
            throw new HttpError(409, "Document parsing has not completed yet.");
          const ownerId = user.role === "teacher" ? null : user.id;
          if (input.ownerId !== ownerId)
            throw new HttpError(
              403,
              "The material owner does not match your account.",
            );
          record = {
            ...JSON.parse(staged.metadata),
            id,
            courseId,
            ownerId,
            uploadedBy: user.id,
            uploadedAt: iso(),
            archivedAt: null,
            hasOriginal: true,
          };
        }
      }
      put(collection, withoutUndefined(record));
      return { record };
    });
    app.delete(`/api/${collection}/:id`, async (req) => {
      const user = requireUser(req),
        { id } = req.params as any;
      const r = get(collection, id);
      if (!r) throw new HttpError(404, "Record not found.");
      if (collection === "sessions")
        deny(
          user.role === "student" &&
            r.studentId === user.id &&
            canReadCourse(user, r.courseId),
        );
      else if (collection === "notes") deny(canReadNote(user, r));
      else if (collection === "materials")
        deny(
          r.ownerId === user.id && canReadMaterial(user, r),
          "Shared course materials must be archived rather than deleted.",
        );
      else
        deny(false, "Published snapshots and inbox history cannot be deleted.");
      db.prepare("DELETE FROM records WHERE collection=? AND id=?").run(
        collection,
        id,
      );
      return { ok: true };
    });
  }
}
function saveThread(
  user: User,
  input: RecordData,
  old: RecordData | undefined,
  core: ReturnType<typeof createStore>,
): RecordData {
  const course = core.get("courses", input.courseId)!;
  const timestamp = iso();
  if (old) {
    deny(core.canReadThread(user, old));
    sameOwner(old, input, [
      "studentId",
      "teacherId",
      "relatedSessionId",
      "subject",
    ]);
  } else {
    deny(
      user.role === "student" &&
        input.studentId === user.id &&
        input.teacherId === course.teacherId,
    );
    if (input.relatedSessionId) {
      const s = core.get("sessions", input.relatedSessionId);
      deny(s && s.studentId === user.id && s.courseId === input.courseId);
    }
  }
  const incoming = z
    .array(
      z
        .object({
          id: idSchema,
          senderRole: z.enum(["student", "teacher"]),
          senderId: idSchema,
          body: z.string().trim().min(1).max(8000),
          createdAt: z.string().optional(),
        })
        .strict(),
    )
    .max(1000)
    .parse(input.messages);
  const prior = old?.messages || [];
  if (
    incoming.length < prior.length ||
    !prior.every((m: any, i: number) =>
      ["id", "senderRole", "senderId", "body"].every(
        (k) => m[k] === incoming[i]?.[k as keyof (typeof incoming)[number]],
      ),
    )
  )
    throw new HttpError(
      409,
      "Conversation messages are immutable. Refresh before replying.",
    );
  const added = incoming.slice(prior.length);
  if (added.length > 1 || (!old && added.length !== 1))
    throw new HttpError(400, "Send one message at a time.");
  deny(
    added.every((m) => m.senderId === user.id && m.senderRole === user.role),
    "You can only send messages as yourself.",
  );
  const status = input.status === "resolved" ? "resolved" : "open";
  if (
    user.role === "student" &&
    status !== old?.status &&
    !(status === "open" && added.length)
  )
    deny(!old && status === "open");
  const ownRead = input.lastReadAt?.[user.role];
  return {
    id: input.id,
    courseId: input.courseId,
    studentId: old?.studentId || user.id,
    teacherId: course.teacherId,
    subject:
      old?.subject || z.string().trim().min(1).max(120).parse(input.subject),
    relatedSessionId: old?.relatedSessionId || input.relatedSessionId || null,
    status: added.length ? "open" : status,
    createdAt: old?.createdAt || timestamp,
    updatedAt:
      added.length || status !== old?.status
        ? timestamp
        : old?.updatedAt || timestamp,
    lastReadAt: {
      student: null,
      teacher: null,
      ...old?.lastReadAt,
      ...(ownRead || added.length ? { [user.role]: timestamp } : {}),
    },
    messages: [...prior, ...added.map((m) => ({ ...m, createdAt: timestamp }))],
  };
}
