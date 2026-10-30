import test from "node:test";
import assert from "node:assert/strict";
import { boardSources, validateBoard } from "../src/ai/board.js";

test("course board reads questions without student names and drops invented sources", () => {
  const sources = boardSources([
    {
      id: "session-git",
      studentId: "student-1",
      updatedAt: "2026-10-30T01:00:00.000Z",
      messages: [
        { role: "user", content: "What is the difference between commit and push?" },
        { role: "assistant", content: "Commit saves locally. Push sends that commit." },
      ],
    },
    {
      id: "session-empty",
      messages: [{ role: "assistant", content: "Hello" }],
    },
  ]);
  assert.equal(sources.ids.length, 1);
  assert.match(sources.text, /\[S1\]/);
  assert.doesNotMatch(sources.text, /student-1/);
  const board = validateBoard(
    {
      quiet: false,
      summary: "Students are mixing up local and remote Git steps.",
      themes: [
        {
          title: "Commit versus push",
          detail: "Several questions treat a local commit as already shared.",
          mentions: 2,
          severity: "medium",
          sources: ["S1", "S9"],
        },
      ],
    },
    sources.ids,
  );
  assert.deepEqual(board.themes[0].sessionIds, ["session-git"]);
  assert.equal(board.quiet, false);
});
