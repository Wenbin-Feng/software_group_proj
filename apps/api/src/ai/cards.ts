export const cardsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "meaning", "example", "source"],
        properties: {
          term: { type: "string", maxLength: 48 },
          meaning: { type: "string", maxLength: 160 },
          example: { type: "string", maxLength: 160 },
          source: { type: "string", maxLength: 8 },
        },
      },
    },
  },
};

export type KnowledgeCard = {
  id: string;
  term: string;
  meaning: string;
  example: string;
  noteId: string | null;
  courseId: string | null;
};

export type CardDeck = {
  id: string;
  studentId: string;
  generatedAt: string;
  cards: KnowledgeCard[];
  recentTerms: string[];
  recentNoteIds: string[];
};

const clean = (value: unknown, max: number) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Notes the cards can draw from: real pages with prose, least recently used
// in a deck first so each round reaches a different part of the wiki.
export function cardSources(notes: any[], recentNoteIds: string[] = []) {
  const recent = new Set(recentNoteIds);
  const pages = (notes || [])
    .filter(
      (note) =>
        note?.id &&
        !note.ledger &&
        !note.wikiRoot &&
        clean(note.content, 40).length >= 20,
    )
    .sort(
      (a, b) =>
        Number(recent.has(a.id)) - Number(recent.has(b.id)) ||
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
    )
    .slice(0, 12);
  const text = pages
    .map(
      (note, index) =>
        `[N${index + 1}] ${clean(note.title, 120)}\n${clean(note.content, 700)}`,
    )
    .join("\n\n");
  return { text, notes: pages };
}

export function validateCards(
  input: any,
  notes: { id: string; courseId?: string }[],
  makeId: () => string,
): KnowledgeCard[] {
  if (!input || !Array.isArray(input.cards))
    throw new Error("The knowledge cards were incomplete. Please retry.");
  const seen = new Set<string>();
  const cards = input.cards
    .map((card: any) => {
      const term = clean(card?.term, 48);
      const meaning = clean(card?.meaning, 160);
      const example = clean(card?.example, 160);
      const key = term.toLowerCase();
      if (!term || !meaning || seen.has(key)) return null;
      seen.add(key);
      const match = String(card?.source || "").match(/^N(\d+)$/);
      const note = match ? notes[Number(match[1]) - 1] : undefined;
      return {
        id: makeId(),
        term,
        meaning,
        example,
        noteId: note?.id || null,
        courseId: note?.courseId || null,
      };
    })
    .filter(Boolean)
    .slice(0, 3) as KnowledgeCard[];
  if (cards.length < 3)
    throw new Error("The knowledge cards were incomplete. Please retry.");
  return cards;
}
