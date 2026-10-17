const json = (schema: any) => ({ "application/json": { schema } });
const object = (properties: any, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const str = { type: "string" };
const error = {
  description: "Request rejected",
  content: json(object({ error: str })),
};
const response = (
  description = "Successful response",
  schema: any = { type: "object" },
) => ({ description, content: json(schema) });
const body = (schema: any) => ({ required: true, content: json(schema) });
const user = {
  type: ["object", "null"],
  properties: {
    id: str,
    name: str,
    studentId: str,
    role: { enum: ["student", "teacher"] },
    profileComplete: { type: "boolean" },
    walletAddress: { type: ["string", "null"] },
    googleLinked: { type: "boolean" },
    googleEmail: { type: ["string", "null"] },
    authMethod: { enum: ["wallet", "google"] },
    initials: str,
    color: str,
  },
};
const secured = { security: [{ session: [] }] };
const id = { name: "id", in: "path", required: true, schema: str };
export function openApiDocument(publicUrl: string) {
  const paths: Record<string, any> = {
    "/api/health": {
      get: {
        summary: "Service and deployed version",
        responses: { 200: response() },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Current Google or wallet session; null before login",
        responses: { 200: response("Session", object({ user })) },
      },
    },
    "/api/auth/providers": {
      get: {
        summary: "Available sign-in methods; credentials are never returned",
        responses: {
          200: response(
            "Providers",
            object({
              google: { type: "boolean" },
              wallet: { type: "boolean" },
            }),
          ),
        },
      },
    },
    "/api/auth/google/start": {
      post: {
        summary:
          "Start browser-bound Google sign-in or explicitly link the current account",
        description:
          "Requires the exact website Origin; link mode also requires an authenticated session. Sets a ten-minute HttpOnly OAuth browser cookie.",
        requestBody: body(
          object({ mode: { enum: ["login", "link"], default: "login" } }),
        ),
        responses: {
          200: response("Google authorization URL", object({ url: str })),
          401: error,
          403: error,
          429: error,
          503: error,
        },
      },
    },
    "/api/auth/google/callback": {
      get: {
        summary:
          "Consume a one-time Google OAuth callback and redirect to the canonical website",
        description:
          "Validates browser state, PKCE, nonce, ID-token signature/issuer/audience/expiry and verified email. Google access/refresh tokens are not persisted. Errors redirect with a fixed error code.",
        parameters: [
          { name: "state", in: "query", required: true, schema: str },
          { name: "code", in: "query", schema: str },
          { name: "error", in: "query", schema: str },
        ],
        responses: {
          303: {
            description:
              "Canonical website redirect and common HttpOnly session cookie on success",
          },
          429: error,
        },
      },
    },
    "/api/auth/challenge": {
      post: {
        summary: "Create a five-minute browser-bound SIWE challenge",
        description:
          "Requires the exact website Origin. Sets a short-lived HttpOnly browser challenge cookie.",
        requestBody: body(
          object({ address: str, chainId: { type: "integer", minimum: 1 } }, [
            "address",
            "chainId",
          ]),
        ),
        responses: {
          200: response(
            "Exact message to sign with personal_sign",
            object({ message: str }),
          ),
          400: error,
          403: error,
          429: error,
        },
      },
    },
    "/api/auth/verify": {
      post: {
        summary:
          "Verify the exact one-time EOA SIWE message and establish a seven-day session",
        requestBody: body(
          object({ message: str, signature: str }, ["message", "signature"]),
        ),
        responses: {
          200: response("Authenticated wallet", object({ user })),
          401: error,
          403: error,
        },
      },
    },
    "/api/auth/profile": {
      post: {
        ...secured,
        summary: "Complete onboarding or update the current role’s profile",
        description:
          "After onboarding, use PATCH /api/auth/settings to change roles.",
        requestBody: body(
          object(
            {
              name: { type: "string", minLength: 1, maxLength: 80 },
              studentId: { type: "string", maxLength: 40 },
              role: { enum: ["student", "teacher"] },
            },
            ["name", "role"],
          ),
        ),
        responses: {
          200: response("Saved profile", object({ user })),
          400: error,
          401: error,
          409: error,
        },
      },
    },
    "/api/auth/settings": {
      patch: {
        ...secured,
        summary: "Update account details or switch between student and teacher",
        description:
          "Requires a completed profile and exact website Origin. Provide at least one field. A student role requires a student number; omitted fields retain their values and a blank teacher student number preserves the previous number. Keeps the account ID, session, course ownership, enrollments and private records. Returns the workspace authorized for the new role in the same transaction.",
        requestBody: body({
          ...object({
            name: { type: "string", minLength: 1, maxLength: 80 },
            studentId: { type: "string", maxLength: 40 },
            role: { enum: ["student", "teacher"] },
          }),
          minProperties: 1,
        }),
        responses: {
          200: response(
            "Saved account and updated workspace",
            object({ user, data: { type: "object" } }, ["user", "data"]),
          ),
          400: error,
          401: error,
          403: error,
        },
      },
    },
    "/api/auth/logout": {
      post: {
        ...secured,
        summary: "Invalidate this session and clear browser cookies",
        responses: { 200: response() },
      },
    },
    "/api/workspace": {
      get: {
        ...secured,
        summary: "Return the authenticated account’s authorized workspace",
        description:
          "Students receive only their own private notes and sessions. Course teachers receive enrolled student sessions and materials, never private Wiki metadata or content.",
        responses: { 200: response(), 401: error, 403: error },
      },
    },
    "/api/courses": {
      post: {
        ...secured,
        summary: "Teacher creates an owned course and join code",
        requestBody: body(
          object({ name: str, code: str, description: str }, ["name", "code"]),
        ),
        responses: { 200: response(), 403: error },
      },
    },
    "/api/courses/join": {
      post: {
        ...secured,
        summary: "Student joins a course using its current join code",
        requestBody: body(object({ code: str }, ["code"])),
        responses: { 200: response(), 403: error, 404: error },
      },
    },
    "/api/courses/{id}/join-code/reset": {
      post: {
        ...secured,
        summary: "Assigned teacher replaces a course join code",
        parameters: [id],
        responses: { 200: response(), 403: error },
      },
    },
    "/api/materials/{id}/original": {
      put: {
        ...secured,
        summary:
          "Upload original PDF, Markdown or TXT, up to 10 MB, before saving metadata",
        parameters: [
          id,
          { name: "courseId", in: "query", required: true, schema: str },
          {
            name: "x-file-name",
            in: "header",
            required: true,
            description: "encodeURIComponent of original filename",
            schema: str,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        responses: {
          202: response(
            "Persisted document parsing job",
            object({ jobId: str }),
          ),
          400: error,
          403: error,
          409: error,
          413: error,
        },
      },
      get: {
        ...secured,
        summary: "Download an authorized original or published PPTX",
        parameters: [id],
        responses: {
          200: {
            description:
              "File bytes with Content-Disposition and encoded x-file-name header",
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          404: error,
        },
      },
    },
  };
  for (const collection of [
    "sessions",
    "notes",
    "market",
    "threads",
    "materials",
  ])
    paths[`/api/${collection}/{id}`] = {
      put: {
        ...secured,
        summary: `Save an authorized ${collection} record`,
        description:
          collection === "market"
            ? "Publication content and ownership are immutable. Later writes update only this account’s bookmark/appreciation or the assigned teacher’s featured flag."
            : collection === "threads"
              ? "Conversation participants and existing messages are immutable. Append at most one message as yourself or update your own read receipt; only teachers resolve threads."
              : collection === "materials"
                ? "Original upload must exist first. Extraction and ownership come from the server. Shared material removal uses archive metadata."
                : "Ownership and course are immutable; server validates references and preserves existing assistant messages.",
        parameters: [id],
        requestBody: body(
          object(
            {
              record: {
                type: "object",
                required: ["id", "courseId"],
                additionalProperties: true,
              },
            },
            ["record"],
          ),
        ),
        responses: {
          200: response(),
          400: error,
          401: error,
          403: error,
          409: error,
        },
      },
      delete: {
        ...secured,
        summary: "Delete an owned private session, note or personal material",
        description:
          "Published market snapshots and inbox history cannot be deleted.",
        parameters: [id],
        responses: { 200: response(), 403: error, 404: error },
      },
    };
  paths["/api/materials/{id}/processing"] = {
    get: {
      ...secured,
      summary:
        "Read the uploader’s durable document parsing job; successful jobs include extracted metadata",
      parameters: [id],
      responses: { 200: response(), 404: error },
    },
  };
  const aiRoutes: [string, string, string][] = [
    [
      "/api/chat",
      "post",
      "Stream a source-grounded assistant response as server-sent events",
    ],
    ["/api/courseware", "get", "List teacher-owned courseware"],
    ["/api/courseware", "post", "Queue a teacher courseware generation task"],
    ["/api/courseware/{id}", "get", "Read a teacher-owned deck"],
    ["/api/courseware/{id}", "patch", "Save a validated editable SlideDeck"],
    ["/api/courseware/{id}/pptx", "get", "Export native editable PowerPoint"],
    [
      "/api/courseware/{id}/publish",
      "post",
      "Publish a teacher deck into course materials",
    ],
    [
      "/api/visualizations",
      "post",
      "Queue a visualization for an owned assistant message",
    ],
    [
      "/api/visualizations/{id}",
      "get",
      "Read an authorized session visualization",
    ],
    ["/api/jobs", "get", "List the account’s course generation jobs"],
    ["/api/jobs/{id}", "get", "Read an owned task status"],
    ["/api/jobs/{id}/retry", "post", "Retry a failed owned generation task"],
  ];
  for (const [path, method, summary] of aiRoutes) {
    paths[path] ||= {};
    paths[path][method] = {
      ...secured,
      summary,
      ...(path.includes("{id}") ? { parameters: [id] } : {}),
      responses: {
        200: response(),
        202: response("Generation queued"),
        400: error,
        401: error,
        403: error,
        404: error,
        503: error,
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Folio API",
      version: "1.0.0",
      description:
        "Same-origin API. Mutations require the canonical website Origin and HttpOnly session. Production upstream requests additionally require a private Vercel origin header.",
    },
    servers: [{ url: publicUrl }],
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "folio_session" },
      },
    },
    paths,
  };
}
