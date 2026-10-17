import test from "node:test";
import assert from "node:assert/strict";
import { workspaceChanges, streamChat, api, ApiError } from "../src/lib/api.js";
test("workspace changes emit only changed resource records and explicit deletions", () => {
  const a = {
    notes: [
      { id: "a", content: "before" },
      { id: "b", content: "keep" },
    ],
    courses: [{ id: "private" }],
  };
  const b = {
    notes: [
      { id: "a", content: "after" },
      { id: "b", content: "keep" },
    ],
    courses: [],
  };
  assert.deepEqual(workspaceChanges(a, b), [
    { collection: "notes", id: "a", record: { id: "a", content: "after" } },
  ]);
  assert.deepEqual(
    workspaceChanges(b, { notes: [] }).map((x) => [x.id, x.deleted]),
    [
      ["a", true],
      ["b", true],
    ],
  );
});
test("stream parser handles SSE chunks split inside JSON and multiple event types", async () => {
  const before = global.fetch;
  const output = [];
  global.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const data of [
            'event: delta\ndata: {"text":"He',
            'llo"}\n\nevent: done\ndata: {"session":{"id":"saved"}}\n\n',
          ])
            controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        },
      }),
    );
  try {
    await streamChat({}, (type, data) => output.push([type, data]));
    assert.deepEqual(output, [
      ["delta", { text: "Hello" }],
      ["done", { session: { id: "saved" } }],
    ]);
  } finally {
    global.fetch = before;
  }
});
test("API reports rejected writes rather than accepting them as saved", async () => {
  const before = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ error: "Not your course" }), { status: 403 });
  try {
    await assert.rejects(
      api("/api/notes/x", { method: "PUT", body: {} }),
      (e) =>
        e instanceof ApiError &&
        e.status === 403 &&
        e.message === "Not your course",
    );
  } finally {
    global.fetch = before;
  }
});
