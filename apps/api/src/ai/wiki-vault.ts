// Vault operations over a student's wiki notes. The notes stay in the database.
// Paths, frontmatter, and [[wikilinks]] follow the same rules as a connected
// Obsidian vault: reads navigate the graph, writes only create, append, or set
// one property. Nothing here rewrites existing prose.

export type VaultNote = {
  id: string;
  title: string;
  path?: string;
  content?: string;
  tags?: string[];
  wikiId?: string;
  summary?: string;
  courseId?: string;
  studentId?: string;
  ledger?: string;
  wikiRoot?: boolean;
  category?: string;
  links?: string[];
  updatedAt?: string;
  [key: string]: unknown;
};

export class VaultError extends Error {}

const WIKILINK = /\[\[([^\[\]\n]+)\]\]/g;
const FRONTMATTER = /^\uFEFF?---\s*\n([\s\S]*?)\n---\s*\n?/;
const INLINE_TAG = /(?:^|(?<=\s))#([A-Za-z0-9_][A-Za-z0-9_/-]*)/g;

function knowledge(notes: VaultNote[]) {
  return notes.filter((note) => note && !note.ledger && !note.wikiRoot);
}

function fold(value: string) {
  return value.trim().toLocaleLowerCase();
}

function stem(value: string) {
  return value.replace(/\\/g, "/").split("/").pop()?.replace(/\.md$/i, "") || "";
}

export function splitFrontmatter(content: string) {
  const match = FRONTMATTER.exec(content);
  if (!match) return { frontmatter: {} as Record<string, string>, body: content };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const cut = line.indexOf(":");
    if (cut <= 0 || line.startsWith(" ") || line.startsWith("-")) continue;
    const key = line.slice(0, cut).trim();
    const value = line.slice(cut + 1).trim().replace(/^["']|["']$/g, "");
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

function compose(frontmatter: Record<string, string>, body: string) {
  const keys = Object.keys(frontmatter);
  if (!keys.length) return body;
  const lines = keys.map(
    (key) => `${key}: ${JSON.stringify(frontmatter[key] ?? "")}`,
  );
  return `---\n${lines.join("\n")}\n---\n${body.replace(/^\n+/, "")}`;
}

function prose(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]+`/g, " ");
}

export function linkTargets(content: string) {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const match of prose(content).matchAll(WIKILINK)) {
    const raw = match[1].split("|")[0]?.split("#")[0]?.trim() || "";
    if (!raw || seen.has(fold(raw))) continue;
    seen.add(fold(raw));
    targets.push(raw);
  }
  return targets;
}

export function resolveNote(notes: VaultNote[], ref: string) {
  const cleaned = ref.split("|")[0]?.split("#")[0]?.trim() || "";
  if (!cleaned) return null;
  const pages = knowledge(notes);
  const exactId = pages.find((note) => note.id === cleaned);
  if (exactId) return exactId;
  const wanted = fold(cleaned);
  const leaf = fold(stem(cleaned));
  return (
    pages.find((note) => note.path && fold(note.path) === wanted) ||
    pages.find((note) => fold(note.title) === wanted) ||
    pages.find((note) => note.path && fold(stem(note.path)) === leaf) ||
    pages.find((note) => fold(stem(note.title)) === leaf) ||
    null
  );
}

function snippet(text: string, query: string) {
  const body = text.replace(/\s+/g, " ").trim();
  const at = body.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  const start = at < 0 ? 0 : Math.max(0, at - 40);
  const slice = body.slice(start, start + 160);
  return `${start ? "…" : ""}${slice}${start + 160 < body.length ? "…" : ""}`;
}

function notePath(note: VaultNote) {
  return note.path || note.title;
}

export function searchNotes(notes: VaultNote[], query: string, limit = 8) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const hits = [];
  for (const note of knowledge(notes)) {
    const text = `${note.title}\n${note.content || ""}`;
    if (!text.toLocaleLowerCase().includes(needle)) continue;
    hits.push({
      id: note.id,
      title: note.title,
      path: notePath(note),
      snippet: snippet(text, query.trim()),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function readNote(notes: VaultNote[], ref: string) {
  const note = resolveNote(notes, ref);
  if (!note) throw new VaultError(`Note ${ref} was not found in this wiki.`);
  const { frontmatter, body } = splitFrontmatter(String(note.content || ""));
  return {
    id: note.id,
    title: note.title,
    path: notePath(note),
    frontmatter,
    links: linkTargets(body),
    body: body.slice(0, 4500),
  };
}

export function listNotes(notes: VaultNote[], limit = 40) {
  return knowledge(notes)
    .slice(0, limit)
    .map((note) => ({ id: note.id, title: note.title, path: notePath(note) }));
}

export function outgoingLinks(notes: VaultNote[], ref: string) {
  const note = readNote(notes, ref);
  return note.links.map((target) => {
    const resolved = resolveNote(notes, target);
    return { target, id: resolved?.id || null, title: resolved?.title || null };
  });
}

export function backlinks(notes: VaultNote[], ref: string, limit = 20) {
  const target = resolveNote(notes, ref);
  if (!target) throw new VaultError(`Note ${ref} was not found in this wiki.`);
  const hits = [];
  for (const note of knowledge(notes)) {
    if (note.id === target.id) continue;
    const points = linkTargets(String(note.content || "")).some((link) => {
      const resolved = resolveNote(notes, link);
      return resolved?.id === target.id;
    });
    if (!points) continue;
    hits.push({
      id: note.id,
      title: note.title,
      path: notePath(note),
      snippet: snippet(String(note.content || ""), target.title),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function collectTags(notes: VaultNote[], limit = 40) {
  const counts = new Map<string, number>();
  const bump = (tag: string) => {
    const clean = tag.trim().replace(/^#/, "").toLocaleLowerCase();
    if (!clean) return;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  };
  for (const note of knowledge(notes)) {
    for (const tag of note.tags || []) bump(String(tag));
    const { frontmatter, body } = splitFrontmatter(String(note.content || ""));
    if (frontmatter.tags)
      for (const tag of frontmatter.tags.split(/[,[\]]+/)) bump(tag);
    for (const match of body.matchAll(INLINE_TAG)) bump(match[1]);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export function createNote(
  notes: VaultNote[],
  input: {
    id: string;
    wikiId: string;
    courseId: string;
    studentId: string;
    title: string;
    content: string;
    path?: string;
    now: string;
  },
) {
  const title = input.title.trim();
  if (!title) throw new VaultError("A new note needs a title.");
  if (knowledge(notes).some((note) => fold(note.title) === fold(title)))
    throw new VaultError(`Note ${title} already exists. Append to it instead.`);
  const path =
    input.path?.trim() ||
    `concepts/${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "note"}.md`;
  if (knowledge(notes).some((note) => note.path && fold(note.path) === fold(path)))
    throw new VaultError(`Path ${path} already exists. Append to that note instead.`);
  return {
    id: input.id,
    wikiId: input.wikiId,
    courseId: input.courseId,
    studentId: input.studentId,
    title,
    path,
    category: "Concepts",
    content: input.content.trim() ? input.content : `# ${title}\n`,
    tags: [],
    links: [],
    summary: "",
    updatedAt: input.now,
    hasAnimation: false,
    animation: null,
  } satisfies VaultNote;
}

export function appendNote(notes: VaultNote[], ref: string, content: string) {
  const note = resolveNote(notes, ref);
  if (!note) throw new VaultError(`Note ${ref} was not found. Create it first.`);
  const addition = content.replace(/\s+$/, "");
  if (!addition.trim()) throw new VaultError("Nothing to append.");
  const existing = String(note.content || "");
  const separator = existing.endsWith("\n") || !existing ? "" : "\n";
  return {
    ...note,
    content: `${existing}${separator}${addition.startsWith("\n") ? addition : `\n${addition}`}\n`,
  };
}

export function setProperty(
  notes: VaultNote[],
  ref: string,
  key: string,
  value: string,
) {
  const note = resolveNote(notes, ref);
  if (!note) throw new VaultError(`Note ${ref} was not found. Create it first.`);
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(key))
    throw new VaultError("A property name must be a short word.");
  const { frontmatter, body } = splitFrontmatter(String(note.content || ""));
  frontmatter[key] = value.replace(/\s+/g, " ").trim().slice(0, 200);
  return { ...note, content: compose(frontmatter, body) };
}

function clamp(value: unknown, fallback: number, lo: number, hi: number) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(hi, Math.max(lo, number));
}

export function dispatchWikiTool(
  notes: VaultNote[],
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  try {
    if (name === "wiki_search") {
      const query = String(args.query || "").trim();
      if (!query) return { error: "wiki_search needs a query." };
      const results = searchNotes(notes, query, clamp(args.limit, 8, 1, 8));
      return { query, count: results.length, results };
    }
    if (name === "wiki_read") {
      const note = String(args.note || "").trim();
      if (!note) return { error: "wiki_read needs a note." };
      return readNote(notes, note);
    }
    if (name === "wiki_list")
      return { notes: listNotes(notes, clamp(args.limit, 40, 1, 40)) };
    if (name === "wiki_links") {
      const note = String(args.note || "").trim();
      if (!note) return { error: "wiki_links needs a note." };
      return { note, links: outgoingLinks(notes, note) };
    }
    if (name === "wiki_backlinks") {
      const note = String(args.note || "").trim();
      if (!note) return { error: "wiki_backlinks needs a note." };
      const links = backlinks(notes, note, 12);
      return { note, count: links.length, backlinks: links };
    }
    if (name === "wiki_tags")
      return { tags: collectTags(notes, clamp(args.limit, 40, 1, 40)) };
    return { error: `Unknown wiki tool ${name}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The wiki tool failed." };
  }
}

export const wikiReadTools = [
  {
    type: "function",
    function: {
      name: "wiki_search",
      description:
        "Search the selected wiki for notes whose title or body contains the query. Use this before reading.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          limit: { type: "integer" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wiki_read",
      description:
        "Read one note by title, path, or id. Returns frontmatter, the body, and outgoing [[wikilinks]].",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { note: { type: "string" } },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wiki_list",
      description: "List notes in the selected wiki when you do not yet have a search term.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { limit: { type: "integer" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wiki_links",
      description: "List the notes a page links out to via [[wikilink]].",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { note: { type: "string" } },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wiki_backlinks",
      description: "Find notes that link to the given note. Use this when a keyword search misses a connection.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { note: { type: "string" } },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wiki_tags",
      description: "List tags used across the selected wiki, most frequent first.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { limit: { type: "integer" } },
      },
    },
  },
];
