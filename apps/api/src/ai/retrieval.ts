export type Evidence = {
  materialId: string;
  name: string;
  page: number;
  text: string;
};

// The caller supplies only records it has authorized. Splitting never changes PDF page numbers.
export function retrieveEvidence(
  materials: any[],
  question: string,
  limit = 8,
): Evidence[] {
  const words = [
    ...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []),
  ];
  const chinese = question.match(/[\p{Script=Han}]+/gu) || [];
  chinese.forEach((word) => {
    for (let i = 0; i < word.length - 1; i++) words.push(word.slice(i, i + 2));
  });
  const chunks: (Evidence & { score: number; order: number })[] = [];
  for (const material of materials) {
    const pages = material.pages?.length
      ? material.pages
      : [{ page: 1, text: material.text || "" }];
    for (const page of pages) {
      const text = String(page.text || "").trim();
      for (let start = 0; start < text.length; start += 1400) {
        const chunk = text.slice(start, start + 1800);
        const body = chunk.toLowerCase();
        chunks.push({
          materialId: material.id,
          name: material.name,
          page: Number(page.page) || 1,
          text: chunk,
          score: words.reduce(
            (score, word) => score + (body.includes(word) ? 1 : 0),
            0,
          ),
          order: chunks.length,
        });
      }
    }
  }
  return chunks
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ score, order, ...source }) => source);
}

export function evidenceContext(sources: Evidence[]) {
  return sources
    .map(
      (source, i) =>
        `[S${i + 1}] ${JSON.stringify({ name: source.name, materialId: source.materialId, page: source.page })}\n${source.text}`,
    )
    .join("\n\n");
}

export function citedSources(text: string, available: Evidence[]) {
  const seen = new Set<string>();
  const sources: Omit<Evidence, "text">[] = [];
  const content = text.replace(/\[S(\d+)\]/g, (match, number) => {
    const source = available[Number(number) - 1];
    if (!source) return "[unverified source]";
    const key = `${source.materialId}:${source.page}`;
    if (!seen.has(key)) {
      const { text: passage, ...reference } = source;
      sources.push(reference);
      seen.add(key);
    }
    return match;
  });
  return { content, sources };
}
