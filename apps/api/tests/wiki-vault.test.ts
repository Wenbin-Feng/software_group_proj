import test from "node:test";
import assert from "node:assert/strict";
import {
  appendNote,
  backlinks,
  createNote,
  dispatchWikiTool,
  outgoingLinks,
  readNote,
  searchNotes,
  setProperty,
} from "../src/ai/wiki-vault.js";
import { exploreWiki } from "../src/ai/wiki-turn.js";

const notes = [
  {
    id: "note-group",
    title: "Group axioms",
    path: "concepts/group-axioms.md",
    content:
      "---\ntags: [algebra]\n---\n# Group axioms\nClosure and inverses. See [[Elliptic curves]].\n",
    tags: ["algebra"],
  },
  {
    id: "note-curve",
    title: "Elliptic curves",
    path: "concepts/elliptic-curves.md",
    content: "# Elliptic curves\nPoints form a group. See [[Group axioms]].\n",
    tags: ["crypto"],
  },
];

test("wiki search reads a note and follows wikilinks both ways", () => {
  assert.equal(searchNotes(notes, "inverses")[0].title, "Group axioms");
  const read = readNote(notes, "Group axioms");
  assert.equal(read.frontmatter.tags, "[algebra]");
  assert.deepEqual(outgoingLinks(notes, "group axioms").map((link) => link.title), [
    "Elliptic curves",
  ]);
  assert.equal(backlinks(notes, "Elliptic curves")[0].title, "Group axioms");
  const listed = dispatchWikiTool(notes, "wiki_tags", {});
  assert.equal(
    (listed.tags as { tag: string }[]).some((tag) => tag.tag === "algebra"),
    true,
  );
});

test("wiki writes create, append, and set a property without replacing prose", () => {
  const created = createNote(notes, {
    id: "note-sign",
    wikiId: "wiki-1",
    courseId: "course-1",
    studentId: "student-1",
    title: "ECDSA",
    content: "# ECDSA\nA signature is a pair.\n",
    now: "2026-10-30T00:00:00.000Z",
  });
  assert.throws(() =>
    createNote([...notes, created], {
      ...created,
      id: "other",
      title: "ECDSA",
      content: "replacement",
      now: created.updatedAt as string,
    }),
  );
  const appended = appendNote([created], "ECDSA", "The nonce is used once.");
  assert.match(String(appended.content), /A signature is a pair/);
  assert.match(String(appended.content), /The nonce is used once/);
  const tagged = setProperty([appended], "ECDSA", "status", "draft");
  assert.match(String(tagged.content), /A signature is a pair/);
  assert.match(String(tagged.content), /"status": "draft"|"status":"draft"|status: "draft"/);
});

test("wiki exploration reads the note a search returns", async () => {
  const calls: string[] = [];
  const explored = await exploreWiki({
    notes,
    question: "What is a group?",
    onStage: (text) => calls.push(text),
    ask: async (messages) => {
      const tools = messages.filter((message) => message.role === "tool");
      if (!tools.length)
        return {
          content: "",
          toolCalls: [
            { id: "1", name: "wiki_search", arguments: { query: "group" } },
            { id: "2", name: "wiki_read", arguments: { note: "Group axioms" } },
          ],
        };
      return { content: "", toolCalls: [] };
    },
  });
  assert.deepEqual(explored.readIds, ["note-group"]);
  assert.match(calls.join(" "), /Searching the wiki/);
  assert.match(calls.join(" "), /Reading/);
});
