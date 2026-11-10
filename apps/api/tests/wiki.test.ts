import test from "node:test";
import assert from "node:assert/strict";
import {
  compileWiki,
  mergePlans,
  missingConcepts,
  validateWikiPlan,
  wikiCapturePrompt,
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

const page = (extra: Record<string, unknown> = {}) => ({
  action: "create",
  matchTitle: "",
  type: "concept",
  title: "Working tree",
  summary: "The working tree holds the files you are editing.",
  tags: ["git", "workflow"],
  body:
    "The working tree holds the files you are editing. Changes move from here to the [[Staging area]] before a commit.\n\n## Clean and dirty\n\nA clean working tree matches the latest commit.",
  openQuestions: [],
  links: ["Staging area"],
  relationships: [{ target: "Staging area", type: "uses" }],
  ...extra,
});

function plan(extra: Partial<Record<keyof WikiPlan, unknown>> = {}): WikiPlan {
  return validateWikiPlan({
    worthSaving: true,
    reason: "The explanation defines the working tree.",
    takeaways: "The working tree is now distinct from the repository.",
    overview: "",
    pages: [page()],
    ...extra,
  });
}

const staging = {
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
};

test("wiki compile writes a prose page with inline links and the vault ledgers", () => {
  const existing = [staging];
  const compiled = compileWiki({ ...base, existing, plan: plan() });
  assert.equal(compiled.result.saved, true);
  assert.equal(compiled.result.created, 1);
  assert.equal(compiled.result.path, "concepts/working-tree.md");
  const note = compiled.records.find((item) => item.title === "Working tree");
  assert.match(note.content, /base_confidence: 0\.66/);
  assert.match(note.content, /lifecycle: draft/);
  assert.match(note.content, /^# Working tree$/m);
  assert.match(note.content, /move from here to the \[\[Staging area\]\] before/);
  assert.match(note.content, /## Clean and dirty\n\nA clean working tree/);
  assert.doesNotMatch(note.content, /What It Is|\^\[inferred\]/);
  // A link already written in the text is not repeated under Related.
  assert.doesNotMatch(note.content, /## Related/);
  assert.match(note.content, /agent:folio\/session-1\/message-1/);
  assert.equal(note.wiki.baseConfidence, wikiConfidence(1));
  assert.deepEqual(note.links, ["note-staging"]);
  const manifest = compiled.records.find((item) => item.ledger === "manifest");
  assert.equal(manifest.manifest.sources["agent:folio/session-1/message-1"].source_type, "data");
  assert.match(
    compiled.records.find((item) => item.ledger === "log").content,
    /CAPTURE source="agent:folio\/session-1\/message-1" pages_created=1 pages_updated=0/,
  );
  assert.match(
    compiled.records.find((item) => item.ledger === "index").content,
    /\[\[Working tree\]\] — /,
  );
  assert.match(
    compiled.records.find((item) => item.ledger === "hot").content,
    /distinct from the repository/,
  );

  const again = compileWiki({
    ...base,
    existing: [...existing, ...compiled.records],
    plan: plan(),
  });
  assert.equal(again.result.already, true);
  assert.equal(again.records.length, 0);
  assert.equal(again.result.noteId, note.id);
});

test("wiki links resolve to real pages, siblings and aliases; invented links become text", () => {
  const compiled = compileWiki({
    ...base,
    existing: [staging],
    plan: plan({
      pages: [
        page({
          body: "Edit files, then [[staging area|stage]] them. A [[Commit]] records them. See [[Imaginary page]] and [[Staging area#Why]].",
          links: ["Commit", "Nowhere"],
        }),
        page({
          title: "Commit",
          summary: "A snapshot of staged changes.",
          body: "A commit records what the [[Staging area]] holds.",
          links: ["Staging area"],
        }),
      ],
    }),
  });
  const tree = compiled.records.find((item) => item.title === "Working tree");
  const commit = compiled.records.find((item) => item.title === "Commit");
  assert.match(tree.content, /then \[\[Staging area\|stage\]\] them/);
  assert.match(tree.content, /A \[\[Commit\]\] records them/);
  assert.match(tree.content, /See Imaginary page and \[\[Staging area#Why\]\]/);
  assert.doesNotMatch(tree.content, /Nowhere/);
  assert.deepEqual(new Set(tree.links), new Set(["note-staging", commit.id]));
  // Each new page reaches at least two pages; Commit gets its sibling added.
  assert.match(commit.content, /## Related\n- \[\[Working tree\]\]/);
  assert.equal(commit.links.length, 2);
});

test("wiki compile merges new paragraphs into an existing page and keeps the student's text", () => {
  const existing = [
    staging,
    {
      id: "note-tree",
      courseId: base.courseId,
      studentId: base.studentId,
      title: "Working tree",
      category: "Concepts",
      path: "concepts/working-tree.md",
      content:
        "# Working tree\n\nThe working tree holds the files you are editing.\n\nOriginal classroom example stays.\n",
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
        page({
          action: "update",
          matchTitle: "Working tree",
          body:
            "The working tree holds the files you are editing.\n\n## Untracked files\n\nUntracked files are still part of the working tree.\n\nThey stay out of the [[Staging area]] until added.",
          links: [],
          relationships: [],
        }),
      ],
    }),
  });
  const note = compiled.records.find((item) => item.id === "note-tree");
  assert.equal(compiled.result.updated, 1);
  assert.match(note.content, /Original classroom example stays/);
  assert.match(
    note.content,
    /## Untracked files\n\nUntracked files are still part of the working tree\.\n\nThey stay out of the \[\[Staging area\]\] until added\./,
  );
  const body = note.content.replace(/^---\n[\s\S]*?\n---\n/, "");
  assert.equal(body.match(/The working tree holds the files you are editing\./g)?.length, 1);
  assert.equal(note.wiki.baseConfidence, 0.42);
  assert.deepEqual(note.links, ["note-staging"]);
});

test("whole-course ingest turns the wiki root into a map that links every page", () => {
  const root = {
    id: "wiki-git",
    courseId: base.courseId,
    studentId: base.studentId,
    title: "Git",
    content: "# Git\n\n",
    wikiRoot: true,
    tags: [],
    links: [],
  };
  const compiled = compileWiki({
    ...base,
    sessionId: "ingest",
    messageId: root.id,
    existing: [],
    wikiId: root.id,
    root,
    plan: plan({
      overview: "# Git\n\nGit tracks changes.\n\n## Basics\n\n- [[Working tree]]: where you edit\n- [[Ghost]]: not real",
      pages: [
        page({ body: "Files you edit. Next comes the [[Commit]].", links: [] }),
        page({ title: "Commit", body: "A snapshot of the [[Working tree]].", links: [] }),
        page({ title: "Branch", tags: ["branching", "git"], body: "A movable pointer.", links: [] }),
      ],
    }),
  });
  const map = compiled.records.find((item) => item.id === root.id);
  assert.ok(map.wikiRoot);
  assert.match(map.content, /^# Git\n\nGit tracks changes\.\n\n## Basics/);
  assert.match(map.content, /- \[\[Working tree\]\]: where you edit\n- Ghost: not real/);
  // Pages the overview missed are still listed.
  assert.match(map.content, /## More pages\n- \[\[Commit\]\][^\n]*\n- \[\[Branch\]\]/);
  assert.equal(map.links.length, 3);
  const branch = compiled.records.find((item) => item.title === "Branch");
  assert.equal(branch.links.length, 2);
  assert.match(
    compiled.records.find((item) => item.ledger === "log").content,
    /INGEST source="agent:folio\/ingest\/wiki-git" pages_created=3/,
  );
  assert.equal(compiled.records.every((item) => item.wikiId === root.id || item.id === root.id), true);
});

test("wiki compile skips an explanation with nothing to keep", () => {
  const compiled = compileWiki({
    ...base,
    existing: [],
    plan: plan({ worthSaving: false, reason: "The exchange never reached a conclusion.", pages: [] }),
  });
  assert.equal(compiled.result.saved, false);
  assert.equal(compiled.records.length, 0);
});

test("wiki compile keeps two wikis separate", () => {
  const first = compileWiki({ ...base, existing: [], plan: plan(), wikiId: "wiki-one" });
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

test("wiki plan cleans bodies and drops a relationship outside the allowlist", () => {
  const parsed = plan({
    pages: [
      page({
        body: "---\ntitle: x\n---\n# Working tree\n\nThe student asked about files.\nFiles you are editing.\n# Details\n\n\n\nMore.",
        relationships: [{ target: "Repository", type: "depends_on" }],
      }),
      page({ title: "Empty", body: "   " }),
    ],
  });
  assert.equal(parsed.pages.length, 1);
  assert.equal(parsed.pages[0].body, "Files you are editing.\n## Details\n\nMore.");
  assert.equal(parsed.pages[0].relationships.length, 0);
  assert.throws(() => validateWikiPlan({ worthSaving: true, pages: [{ ...page(), body: undefined }] }));
});

test("wiki prompt asks for linked prose pages", () => {
  const prompt = wikiCapturePrompt([{ title: "Staging area", summary: "Files chosen for the next commit." }]);
  assert.match(prompt, /\[\[Exact page title\]\]/);
  assert.match(prompt, /at least two other pages/);
  assert.match(prompt, /- Staging area: Files chosen/);
});

test("a thin plan names its missing concepts and merges only new pages", () => {
  const first = plan({
    overview: "- [[Working tree]]\n- [[Remote]]",
    pages: [page({ body: "Moves to the [[Staging area]], then a [[Commit|commit]] and the [[remote]].", links: ["Branch"] })],
  });
  assert.deepEqual(missingConcepts(first, ["Staging area"]), ["Remote", "Commit", "Branch"]);
  const second = plan({
    pages: [
      page({ title: "Commit", body: "A snapshot of the [[Working tree]]." }),
      page({ title: "working tree", body: "Duplicate." }),
      page({ title: "Staging area", body: "Already exists." }),
      page({ action: "update", matchTitle: "Working tree", title: "Remote", body: "Not a create." }),
    ],
  });
  const merged = mergePlans(first, second, ["Staging area"]);
  assert.deepEqual(merged.pages.map((item) => item.title), ["Working tree", "Commit"]);
  assert.equal(merged.overview, first.overview);
});
