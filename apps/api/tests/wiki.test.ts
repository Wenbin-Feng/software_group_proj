import test from "node:test";
import assert from "node:assert/strict";
import {
  compileWiki,
  validateWikiPlan,
  wikiConfidence,
  type WikiPlan,
} from "../src/ai/wiki.js";

const now = "2026-10-27T04:00:00.000Z";
const base = {
  now,
  courseId: "demo-comp4342",
  studentId: "student-1",
  sessionId: "session-1",
  messageId: "message-1",
  messageText: "The working tree holds files you are editing.",
  sessionTitle: "Everyday Git",
  materials: [{ id: "git-ppt", name: "Using Git every day.pptx", page: 3 }],
};

function plan(extra: Partial<WikiPlan> = {}): WikiPlan {
  return validateWikiPlan({
    worthSaving: true,
    reason: "The explanation defines the working tree.",
    takeaways: "The working tree is now distinct from the repository.",
    pages: [
      {
        action: "create",
        matchTitle: "",
        type: "concept",
        title: "Working tree",
        summary: "The working tree holds the files you are editing.",
        tags: ["git", "workflow"],
        claims: [
          {
            text: "The working tree holds the files you are editing.",
            provenance: "extracted",
          },
          {
            text: "A clean working tree means the files match the latest commit.",
            provenance: "inferred",
          },
        ],
        openQuestions: [],
        links: ["Staging area"],
        relationships: [{ target: "Staging area", type: "uses" }],
      },
    ],
    ...extra,
  });
}

test("wiki compile writes a declarative page, provenance, and the vault ledgers", () => {
  const existing = [
    {
      id: "note-staging",
      courseId: base.courseId,
      studentId: base.studentId,
      title: "Staging area",
      category: "Concepts",
      path: "concepts/staging-area.md",
      content: "# Staging area\n\nFiles chosen for the next commit.\n",
      tags: ["git"],
      links: [],
      summary: "Files chosen for the next commit.",
    },
  ];
  const compiled = compileWiki({ ...base, existing, plan: plan() });
  assert.equal(compiled.result.saved, true);
  assert.equal(compiled.result.created, 1);
  assert.equal(compiled.result.path, "concepts/working-tree.md");
  const page = compiled.records.find((note) => note.title === "Working tree");
  assert.match(page.content, /base_confidence: 0\.66/);
  assert.match(page.content, /lifecycle: draft/);
  assert.match(page.content, /## What It Is/);
  assert.match(page.content, /## How It Works/);
  assert.match(page.content, /\^\[inferred\]/);
  assert.match(page.content, /\[\[Staging area\]\]/);
  assert.match(page.content, /agent:folio\/session-1\/message-1/);
  assert.equal(page.wiki.baseConfidence, wikiConfidence(1));
  assert.equal(page.links.includes("note-staging"), true);
  const manifest = compiled.records.find((note) => note.ledger === "manifest");
  assert.equal(manifest.manifest.sources["agent:folio/session-1/message-1"].source_type, "data");
  assert.match(
    compiled.records.find((note) => note.ledger === "log").content,
    /CAPTURE source="agent:folio\/session-1\/message-1" pages_created=1 pages_updated=0/,
  );
  assert.match(
    compiled.records.find((note) => note.ledger === "index").content,
    /\[\[Working tree\]\] — /,
  );
  assert.match(
    compiled.records.find((note) => note.ledger === "hot").content,
    /distinct from the repository/,
  );

  const again = compileWiki({
    ...base,
    existing: [...existing, ...compiled.records],
    plan: plan(),
  });
  assert.equal(again.result.already, true);
  assert.equal(again.records.length, 0);
  assert.equal(again.result.noteId, page.id);
});

test("wiki compile merges a new claim into an existing page", () => {
  const existing = [
    {
      id: "note-tree",
      courseId: base.courseId,
      studentId: base.studentId,
      title: "Working tree",
      category: "Concepts",
      path: "concepts/working-tree.md",
      content:
        "# Working tree\n\n## What It Is\n- The working tree holds the files you are editing.\n\nOriginal classroom example stays.\n",
      tags: ["git"],
      links: [],
      summary: "The working tree holds the files you are editing.",
      wiki: { baseConfidence: 0.42, lifecycle: "draft", sourceKeys: [] },
    },
  ];
  const compiled = compileWiki({
    ...base,
    materials: [],
    existing,
    plan: plan({
      pages: [
        {
          ...plan().pages[0],
          action: "update",
          matchTitle: "Working tree",
          claims: [
            {
              text: "The working tree holds the files you are editing.",
              provenance: "extracted",
            },
            {
              text: "Untracked files are still part of the working tree.",
              provenance: "extracted",
            },
          ],
          links: [],
          relationships: [],
        },
      ],
    }),
  });
  const page = compiled.records.find((note) => note.id === "note-tree");
  assert.equal(compiled.result.updated, 1);
  assert.match(page.content, /Original classroom example stays/);
  assert.match(page.content, /Untracked files are still part of the working tree/);
  assert.equal(page.content.includes("The student asked"), false);
  assert.equal(page.wiki.baseConfidence, 0.42);
});

test("wiki compile skips an explanation with nothing to keep", () => {
  const compiled = compileWiki({
    ...base,
    existing: [],
    plan: validateWikiPlan({
      worthSaving: false,
      reason: "The exchange never reached a conclusion.",
      takeaways: "",
      pages: [],
    }),
  });
  assert.equal(compiled.result.saved, false);
  assert.equal(compiled.records.length, 0);
});

test("wiki compile keeps two wikis separate", () => {
  const first = compileWiki({
    ...base,
    existing: [],
    plan: plan(),
    wikiId: "wiki-one",
  });
  const second = compileWiki({
    ...base,
    messageId: "message-2",
    existing: first.records,
    plan: plan(),
    wikiId: "wiki-two",
  });
  assert.equal(first.records.every((note) => note.wikiId === "wiki-one"), true);
  assert.equal(second.result.already, false);
  assert.equal(second.records.every((note) => note.wikiId === "wiki-two"), true);
});

test("wiki plan drops a relationship outside the allowlist", () => {
  const parsed = validateWikiPlan({
    worthSaving: true,
    reason: "The page defines the working tree.",
    takeaways: "Working tree stays separate from the repository.",
    pages: [
      {
        action: "create",
        matchTitle: "",
        type: "concept",
        title: "Working tree",
        summary: "Files you are editing.",
        tags: ["git", "workflow"],
        claims: [{ text: "Files you are editing.", provenance: "extracted" }],
        openQuestions: [],
        links: [],
        relationships: [{ target: "Repository", type: "depends_on" }],
      },
    ],
  });
  assert.equal(parsed.pages[0].relationships.length, 0);
});
