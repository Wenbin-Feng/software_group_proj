import { outgoingLinks } from "./wikiLinks";

export function shareablePages(notes, wiki, userId) {
  return (notes || []).filter(
    (note) =>
      note.wikiId === wiki.id &&
      note.studentId === userId &&
      !note.wikiRoot &&
      !note.ledger,
  );
}

export function wikiSnapshot({ wiki, pages, market, user, notes }) {
  const previous = (market || []).filter(
    (item) => item.authorId === user.id && pages.some((page) => page.id === item.noteId),
  );
  const version = previous.length
    ? Math.max(...previous.map((item) => Number(item.version) || 1)) + 1
    : 1;
  const pageIds = new Set(pages.map((note) => note.id));
  const snapshotPages = pages.map((note) => ({
    id: note.id,
    title: note.title,
    category: note.category,
    content: note.content,
    tags: [...(note.tags || [])],
    links: outgoingLinks(note, notes)
      .map((link) => link.note?.id)
      .filter((id) => pageIds.has(id)),
    animation: note.visualizationHtml ? "html" : null,
    hasAnimation: !!note.hasAnimation,
    visualizationHtml: note.visualizationHtml || null,
  }));
  const summary =
    pages.find((page) => page.summary)?.summary ||
    `Shared from ${wiki.title}.`;
  return {
    id: `market-${Date.now()}`,
    noteId: pages[0].id,
    noteIds: pages.map((note) => note.id),
    pages: snapshotPages,
    courseId: wiki.courseId,
    title: wiki.title,
    description: summary.slice(0, 280),
    author: user.name,
    authorId: user.id,
    initials: user.initials,
    color: user.color || "#e6ecff",
    category: pages[0].category || "Wiki",
    content: pages
      .map((note) =>
        pages.length > 1 ? `# ${note.title}\n\n${note.content}` : note.content,
      )
      .join("\n\n---\n\n"),
    tags: [...new Set(pages.flatMap((note) => note.tags || []))],
    likes: 0,
    bookmarkedBy: [],
    version,
    updatedAt: new Date().toISOString(),
    hasAnimation: pages.some((note) => note.hasAnimation),
    animation: snapshotPages[0].animation,
    pageCount: pages.length,
  };
}
