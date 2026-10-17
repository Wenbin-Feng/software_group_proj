export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  let body = options.body;
  if (
    body !== undefined &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new ApiError(
      detail.message || detail.error || `Request failed (${response.status})`,
      response.status,
    );
  }
  return response.status === 204 ? null : response.json();
}
let pending = Promise.resolve();
export function flushChanges() {
  return pending;
}
const collections = ["sessions", "notes", "market", "threads", "materials"];
export function workspaceChanges(before, after) {
  return collections.flatMap((collection) => {
    const old = new Map(
      (before[collection] || []).map((item) => [item.id, item]),
    );
    const next = new Map(
      (after[collection] || []).map((item) => [item.id, item]),
    );
    return [
      ...[...next]
        .filter(
          ([id, item]) => JSON.stringify(old.get(id)) !== JSON.stringify(item),
        )
        .map(([id, record]) => ({ collection, id, record })),
      ...[...old.keys()]
        .filter((id) => !next.has(id))
        .map((id) => ({ collection, id, deleted: true })),
    ];
  });
}
export function persistChanges(changes, onError, onRecord) {
  pending = pending
    .then(async () => {
      for (const change of changes) {
        const result = await api(
          `/api/${change.collection}/${encodeURIComponent(change.id)}`,
          {
            method: change.deleted ? "DELETE" : "PUT",
            body: change.deleted ? undefined : { record: change.record },
          },
        );
        if (result?.record) onRecord?.(change, result.record);
      }
    })
    .catch(onError);
  return pending;
}
export async function streamChat(body, onEvent, signal) {
  await flushChanges();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new ApiError(
      detail.message ||
        detail.error ||
        "The tutor could not respond. Please retry.",
      response.status,
    );
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const type = frame.match(/^event: ?(.+)$/m)?.[1] || "message";
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data && data !== "[DONE]") onEvent(type, JSON.parse(data));
    }
    if (done) break;
  }
}
