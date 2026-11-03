import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  GalleryHorizontalEnd,
  LoaderCircle,
  Network,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context";
import { api } from "../lib/api";
import { waitForJob } from "../lib/jobs";
import { canReadPrivateNote } from "../lib/access";
import "./knowledge-cards.css";

const STEPS = [
  { at: 0, label: "Waiting for a free slot" },
  { at: 20, label: "Reading your wiki" },
  { at: 80, label: "Laying out three cards" },
];

export default function KnowledgeCards() {
  const { data, actor, navigate } = useApp();
  const notes = useMemo(
    () =>
      data.notes.filter(
        (note) =>
          canReadPrivateNote(data, actor, note) &&
          !note.ledger &&
          !note.wikiRoot,
      ),
    [data, actor],
  );
  const [deck, setDeck] = useState(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("Opening your cards");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api("/api/cards")
      .then((saved) => live && setDeck(saved.deck))
      .catch((caught) => live && setError(caught.message))
      .finally(() => live && setStatus(""));
    return () => {
      live = false;
    };
  }, []);
  const cards = deck?.cards || [];
  const card = cards[index];
  const busy = !!status;
  const last = index >= cards.length - 1;
  const generate = async () => {
    setError("");
    setStatus(STEPS[0].label);
    try {
      const { jobId } = await api("/api/cards", { method: "POST" });
      const result = await waitForJob(jobId, {
        onUpdate: (job) =>
          setStatus(
            [...STEPS].reverse().find((step) => job.progress >= step.at)
              ?.label || STEPS[0].label,
          ),
      });
      if (result?.deck) {
        setDeck({ generatedAt: result.deck.generatedAt, cards: result.deck.cards });
        setIndex(0);
      }
    } catch (caught) {
      setError(caught.message || "The cards could not be prepared.");
    }
    setStatus("");
  };
  useEffect(() => {
    const key = (event) => {
      if (busy || !cards.length || event.target.closest?.("input, textarea"))
        return;
      if (event.key === "ArrowRight" && !last) setIndex((value) => value + 1);
      if (event.key === "ArrowLeft" && index > 0)
        setIndex((value) => value - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, cards.length, index, last]);
  const source = card?.noteId && notes.find((note) => note.id === card.noteId);
  const course =
    card?.courseId && data.courses.find((item) => item.id === card.courseId);

  return (
    <div className="kcards-page">
      <header className="courses-heading kcards-heading">
        <div>
          <div className="courses-eyebrow">ONE IDEA AT A TIME</div>
          <h1>
            Knowledge cards<span>.</span>
          </h1>
          <p>
            Three short cards from your own wiki. Read one, then turn to the
            next.
          </p>
        </div>
        {cards.length > 0 && notes.length > 0 && (
          <button
            className="btn btn-outline kcards-new"
            onClick={generate}
            disabled={busy}
          >
            <Sparkles size={15} aria-hidden="true" />
            New cards
          </button>
        )}
      </header>
      {error && (
        <p className="kcards-error" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <div className="kcards-stage" aria-live="polite">
          <div className="kcards-card kcards-loading">
            <LoaderCircle size={22} className="kcards-spin" aria-hidden="true" />
            <p>{status}</p>
            <span className="kcards-skeleton wide" />
            <span className="kcards-skeleton" />
          </div>
        </div>
      ) : !notes.length ? (
        <div className="kcards-empty">
          <span>
            <Network size={26} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <h2>Your wiki is still empty</h2>
          <p>
            Save an answer to your wiki from any course chat. Cards are written
            from those notes.
          </p>
          <button className="btn btn-primary" onClick={() => navigate("courses")}>
            Go to Courses
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : !cards.length ? (
        <div className="kcards-empty">
          <span>
            <GalleryHorizontalEnd size={26} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <h2>Turn your wiki into three cards</h2>
          <p>
            Folio picks three ideas from your {notes.length}{" "}
            {notes.length === 1 ? "note" : "notes"} and explains each in one
            plain sentence, with an everyday example.
          </p>
          <button className="btn btn-primary" onClick={generate}>
            <Sparkles size={16} aria-hidden="true" />
            Generate 3 cards
          </button>
        </div>
      ) : (
        <>
          <div className="kcards-stage">
            <span className="kcards-ghost two" aria-hidden="true" />
            <span className="kcards-ghost one" aria-hidden="true" />
            <article
              key={card.id}
              className="kcards-card"
              aria-roledescription="card"
              aria-label={`Card ${index + 1} of ${cards.length}`}
            >
              <div className="kcards-meta">
                <span>
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(cards.length).padStart(2, "0")}
                </span>
                {course && <span>{course.code}</span>}
              </div>
              <h2 className="kcards-term">{card.term}</h2>
              <p className="kcards-meaning">{card.meaning}</p>
              {card.example && (
                <div className="kcards-example">
                  <small>For example</small>
                  <p>{card.example}</p>
                </div>
              )}
              {source && (
                <button
                  className="kcards-source"
                  onClick={() => navigate("wiki", { noteId: source.id })}
                >
                  From your note “{source.title}”
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              )}
            </article>
          </div>
          <nav className="kcards-controls" aria-label="Cards">
            <button
              className="btn btn-outline"
              onClick={() => setIndex(index - 1)}
              disabled={index === 0}
              aria-label="Previous card"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <div className="kcards-dots">
              {cards.map((item, position) => (
                <button
                  key={item.id}
                  className={position === index ? "active" : ""}
                  onClick={() => setIndex(position)}
                  aria-label={`Show card ${position + 1}`}
                  aria-current={position === index ? "true" : undefined}
                />
              ))}
            </div>
            {last ? (
              <button className="btn btn-primary" onClick={generate}>
                <Sparkles size={16} aria-hidden="true" />
                Generate 3 more
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => setIndex(index + 1)}
              >
                Next card
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
