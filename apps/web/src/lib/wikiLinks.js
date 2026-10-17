const canonical = (value) =>
  String(value || "")
    .normalize("NFC")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\.md$/i, "")
    .trim()
    .toLocaleLowerCase();

const basename = (value) =>
  canonical(value).split("/").filter(Boolean).pop() || "";

// Strip code before looking for links. Examples in code are not vault edges.
function proseOnly(content) {
  let fence = null;
  return String(content || "")
    .split("\n")
    .map((line) => {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (match) {
        if (!fence) fence = { character: match[1][0], length: match[1].length };
        else if (
          match[1][0] === fence.character &&
          match[1].length >= fence.length
        )
          fence = null;
        return "";
      }
      if (fence) return "";
      return line.replace(/(`+)([\s\S]*?)\1/g, "");
    })
    .join("\n")
    .replace(/<!--[^]*?-->/g, "");
}

/** Parse Obsidian links, preserving headings and the visible alias separately. */
export function parseWikiLinks(content) {
  const result = [];
  const text = proseOnly(content);
  const pattern = /\[\[([^\[\]\n]+)\]\]/g;
  for (const match of text.matchAll(pattern)) {
    let escaped = 0;
    for (let i = match.index - 1; i >= 0 && text[i] === "\\"; i--) escaped++;
    if (escaped % 2) continue;
    const raw = match[1];
    const separator = raw.indexOf("|");
    const destination = (separator < 0 ? raw : raw.slice(0, separator)).trim();
    const hash = destination.indexOf("#");
    const target = (hash < 0 ? destination : destination.slice(0, hash)).trim();
    const heading = hash < 0 ? "" : destination.slice(hash + 1).trim();
    const alias = separator < 0 ? "" : raw.slice(separator + 1).trim();
    if (!target && !heading) continue;
    const visibleTarget = target
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      .replace(/\.md$/i, "");
    result.push({ target, label: alias || visibleTarget || heading, heading });
  }
  return result;
}

/** Resolve against the provided visible vault; callers control its privacy scope. */
export function resolveWikiLink(notes = [], target, sourceNote) {
  const key = canonical(
    String(target || "")
      .split("|")[0]
      .split("#")[0],
  );
  if (!key)
    return sourceNote && notes.find((note) => note.id === sourceNote.id);
  const leaf = basename(key);
  return notes
    .map((note, index) => {
      const identities = [
        note.id,
        note.title,
        note.path,
        note.filePath,
        note.filename,
      ]
        .filter(Boolean)
        .map(canonical);
      const exact = identities.includes(key);
      const short = identities.some((identity) => basename(identity) === leaf);
      if (!exact && !short) return null;
      return {
        note,
        index,
        score:
          (exact ? 100 : 0) +
          (sourceNote && note.courseId === sourceNote.courseId ? 20 : 0) +
          (sourceNote && note.studentId === sourceNote.studentId ? 10 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.note;
}

export function outgoingLinks(note, notes = []) {
  const seen = new Set();
  return parseWikiLinks(note?.content).flatMap((link) => {
    const resolved = resolveWikiLink(notes, link.target, note);
    const key = `${resolved?.id || canonical(link.target)}#${link.heading}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...link, note: resolved }];
  });
}

export function incomingLinks(note, notes = []) {
  if (!note) return [];
  return notes.flatMap((source) => {
    if (source.id === note.id) return [];
    const match = outgoingLinks(source, notes).find(
      (link) => link.note?.id === note.id,
    );
    if (!match) return [];
    const line = proseOnly(source.content)
      .split("\n")
      .find((value) =>
        parseWikiLinks(value).some(
          (link) => resolveWikiLink(notes, link.target, source)?.id === note.id,
        ),
      );
    const excerpt = (line || "")
      .replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
        const [destination, alias] = inner.split("|");
        return alias || destination.replace(/\.md(?=#|$)/i, "");
      })
      .replace(/^\s*[#>*-]+\s*/, "")
      .trim();
    return [{ note: source, excerpt }];
  });
}

export function buildWikiGraph(notes = []) {
  const edges = [];
  const unresolved = [];
  const seen = new Set();
  for (const source of notes) {
    for (const link of outgoingLinks(source, notes)) {
      if (!link.note) {
        unresolved.push({
          source: source.id,
          target: link.target,
          label: link.label,
        });
        continue;
      }
      const key = `${source.id}\u0000${link.note.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: source.id, target: link.note.id });
    }
  }
  return { nodes: notes, edges, unresolved };
}
