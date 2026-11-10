// A SlideMaker deck that fits every layout cap, for mocked model replies.
export function slideDeck(
  count: number,
  {
    title = "Database concurrency",
    text = "Two requests can read the same stock",
    notes = "Ask students which step loses the update.",
    source = { materialId: "public", page: 3 },
    lang = "en",
  } = {},
) {
  const body = Array.from({ length: Math.max(1, count - 2) }, (_, index) => ({
    template: "bullets",
    fields: {
      title: `${title} ${index + 1}`,
      lead: text,
      items: [
        { heading: "Shared read", body: text },
        { heading: "Late write", body: text },
      ],
    },
    notes,
    sources: [source],
  }));
  return {
    title,
    lang,
    aspect: "16:9",
    slides: [
      {
        template: "title",
        fields: { title, subtitle: "Week 4" },
        notes,
        sources: [],
      },
      ...body,
      {
        template: "closing",
        fields: { message: title },
        notes,
        sources: [],
      },
    ].slice(0, count),
  };
}
