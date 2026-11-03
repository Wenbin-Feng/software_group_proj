import test from "node:test";
import assert from "node:assert/strict";
import { cardSources, validateCards } from "../src/ai/cards.js";

const note = (id: string, updatedAt: string, extra = {}) => ({
  id,
  title: `Note ${id}`,
  content: "A race condition happens when timing changes the result.",
  courseId: "course",
  updatedAt,
  ...extra,
});

test("card sources skip ledgers and roots and rotate past recently used notes", () => {
  const sources = cardSources(
    [
      note("old", "2026-10-01"),
      note("new", "2026-10-30"),
      note("root", "2026-10-31", { wikiRoot: true }),
      note("ledger", "2026-10-31", { ledger: "manifest" }),
      note("empty", "2026-10-31", { content: "tiny" }),
    ],
    ["new"],
  );
  assert.deepEqual(
    sources.notes.map((item) => item.id),
    ["old", "new"],
  );
  assert.match(sources.text, /\[N1\] Note old/);
});

test("cards keep three distinct terms and drop invented sources", () => {
  let id = 0;
  const cards = validateCards(
    {
      cards: [
        { term: "Race condition", meaning: "Timing changes the result.", example: "Two shoppers grab the last cake.", source: "N1" },
        { term: "race condition", meaning: "Duplicate.", example: "", source: "N1" },
        { term: "Mutex", meaning: "Only one worker may enter at a time.", example: "One key for one bathroom.", source: "N9" },
        { term: "Atomic update", meaning: "Check and change happen as one step.", example: "A vending machine drops one can.", source: "N2" },
      ],
    },
    [note("a", "x"), note("b", "y")],
    () => `card-${++id}`,
  );
  assert.deepEqual(
    cards.map((card) => [card.term, card.noteId]),
    [
      ["Race condition", "a"],
      ["Mutex", null],
      ["Atomic update", "b"],
    ],
  );
  assert.throws(() => validateCards({ cards: cards.slice(0, 2) }, [], () => "x"));
});
