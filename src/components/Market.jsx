import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  GitBranch,
  Heart,
  Layers3,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useApp } from "../context";
import { Modal } from "./ui";
import { WikiMarkdown, friendlyDate } from "./Wiki";
const matchKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
const avatarStyle = (color) => ({
  background: color?.length === 7 ? `${color}18` : "#eef0f6",
  color: color || "#64728a",
});
import "./wiki.css";

function CoverArt({ kind = 0, title = "", hasAnimation = false }) {
  const type = kind % 4;
  return (
    <div className={`market-cover market-cover-${type}`} aria-hidden="true">
      <div className="market-cover-grid" />
      {type === 0 && (
        <div className="market-art-flow">
          <span className="market-art-box">
            <Layers3 size={22} />
          </span>
          <i />
          <span className="market-art-core">
            <GitBranch size={28} />
          </span>
          <i />
          <span className="market-art-box">
            <Check size={22} />
          </span>
          <div className="market-art-label">ONE IDEA. MANY CONNECTIONS.</div>
        </div>
      )}
      {type === 1 && (
        <div className="market-art-paper">
          <div className="market-paper-back" />
          <div className="market-paper-front">
            <span className="market-paper-dot" />
            <i />
            <i />
            <div className="market-paper-link">
              <span />
              <span />
              <span />
            </div>
            <i />
          </div>
          <span className="market-paper-orbit">
            <Sparkles size={18} />
          </span>
        </div>
      )}
      {type === 2 && (
        <div className="market-art-venn">
          <div />
          <div />
          <span>
            <BookOpen size={26} />
          </span>
          <small>LESS MEMORIZING. MORE UNDERSTANDING.</small>
        </div>
      )}
      {type === 3 && (
        <div className="market-art-stacks">
          <div>
            <FileText size={18} />
            <span />
            <span />
            <span />
          </div>
          <div>
            <GitBranch size={22} />
            <span />
            <span />
          </div>
          <div>
            <Check size={18} />
            <span />
            <span />
          </div>
        </div>
      )}
      <span className="market-cover-format">
        {hasAnimation ? (
          <>
            <Sparkles size={11} /> Includes animation
          </>
        ) : (
          <>
            <FileText size={11} /> Connected notes
          </>
        )}
      </span>
    </div>
  );
}

export default function Market() {
  const { data, setData, courseId, course, user, navigate, toast } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState("Recommended");
  const [readingId, setReadingId] = useState(null);
  const [readingPageId, setReadingPageId] = useState(null);
  const items = (data.market || []).filter(
    (item) => item.courseId === courseId,
  );
  const categories = [
    "All topics",
    ...new Set(items.map((item) => item.category)),
  ];
  const saved = (item) => (item.bookmarkedBy || []).includes(user.id);
  const reading = items.find((item) => item.id === readingId);
  const readingPages = reading
    ? reading.pages?.length
      ? reading.pages
      : [
          {
            id: reading.noteId || reading.id,
            title: reading.title,
            content: reading.content,
            hasAnimation: reading.hasAnimation,
          },
        ]
    : [];
  const readingPage =
    readingPages.find((page) => page.id === readingPageId) || readingPages[0];
  const openPublication = (id) => {
    setReadingPageId(null);
    setReadingId(id);
  };
  const followPublicLink = (page, target) => {
    if (!page)
      return toast(`“${target}” isn't included in this published collection.`);
    setReadingPageId(page.id);
    document
      .querySelector(".modal-body")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const shown = useMemo(() => {
    const matching = items.filter(
      (item) =>
        (category === "All topics" || item.category === category) &&
        (!onlySaved || saved(item)) &&
        `${item.title} ${item.description} ${item.author} ${(item.tags || []).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    if (sort === "Most appreciated")
      return [...matching].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    if (sort === "Newest first") {
      const time = (item) =>
        Number.isNaN(Date.parse(item.updatedAt))
          ? Number(item.id.replace("market-", "")) || Date.now()
          : Date.parse(item.updatedAt);
      return [...matching].sort((a, b) => time(b) - time(a));
    }
    return matching;
  }, [items, category, onlySaved, query, sort, user.id]);
  const bookmark = (item) => {
    const wasSaved = saved(item);
    setData((prev) => ({
      ...prev,
      market: prev.market.map((m) =>
        m.id === item.id
          ? {
              ...m,
              bookmarkedBy: wasSaved
                ? (m.bookmarkedBy || []).filter((id) => id !== user.id)
                : [...(m.bookmarkedBy || []), user.id],
            }
          : m,
      ),
    }));
    toast(
      wasSaved
        ? "Removed from your saved collection."
        : "Saved for a curious moment later.",
    );
  };
  const importNote = (item) => {
    const existing = (data.notes || []).find(
      (n) =>
        n.importedFrom === item.id &&
        n.courseId === courseId &&
        (n.studentId === user.id || n.studentId === user.studentId),
    );
    if (existing) {
      setReadingId(null);
      navigate("wiki", { noteId: existing.id });
      return toast("You already have this version. Opening your copy.");
    }
    const pages = item.pages?.length
      ? item.pages
      : [
          {
            id: item.noteId || item.id,
            title: item.title,
            category: "From the community",
            content: item.content,
            tags: item.tags || [],
            links: [],
            animation:
              item.animation ||
              (/race condition/i.test(item.title) ? "race" : null),
            hasAnimation: !!item.hasAnimation,
          },
        ];
    const idMap = new Map(
      pages.map((page, index) => [
        page.id,
        `note-import-${Date.now()}-${index}`,
      ]),
    );
    const pageFor = (target) =>
      pages.find(
        (page) =>
          page.id === target || matchKey(page.title) === matchKey(target),
      );
    const imported = pages.map((page) => {
      const remappedContent = (page.content || "")
        .replace(/^# [^\n]+\n*/, "")
        .replace(/\[\[([^\]]+)\]\]/g, (original, reference) => {
          const [target, label] = reference.split("|");
          const linked = pageFor(target);
          return linked
            ? `[[${idMap.get(linked.id)}|${label || linked.title}]]`
            : original;
        });
      const inlineLinks = [...remappedContent.matchAll(/\[\[([^|\]]+)/g)]
        .map((match) => match[1])
        .filter((id) => [...idMap.values()].includes(id));
      const links = [
        ...new Set([
          ...(page.links || [])
            .map((target) => idMap.get(pageFor(target)?.id))
            .filter(Boolean),
          ...inlineLinks,
        ]),
      ];
      const publicMaterial =
        page.source &&
        (data.materials || []).find(
          (m) =>
            m.id === page.source.materialId &&
            m.courseId === courseId &&
            !m.ownerId,
        );
      return {
        id: idMap.get(page.id),
        courseId,
        studentId: user.id,
        title: page.title || item.title,
        category: "From the community",
        content: `> From ${item.author} · ${course?.code || "Course wiki market"} · Version ${item.version || 1}\n\n${remappedContent}`,
        tags: [...(page.tags || [])],
        links,
        updatedAt: "Just now",
        animation:
          page.animation ||
          (/race condition/i.test(page.title || item.title) ? "race" : null),
        hasAnimation: !!page.hasAnimation,
        importedFrom: item.id,
        importedPageId: page.id,
        ...(publicMaterial
          ? {
              source: {
                materialId: publicMaterial.id,
                name: publicMaterial.name,
                page: page.source.page || 1,
              },
            }
          : {}),
      };
    });
    setData((prev) => ({ ...prev, notes: [...prev.notes, ...imported] }));
    setReadingId(null);
    toast(
      `Added ${imported.length === 1 ? "a page" : `${imported.length} connected pages`} to your wiki. Make this understanding your own.`,
    );
    navigate("wiki", { noteId: imported[0].id });
  };
  const likes = (item) => (item.likedBy || []).includes(user.id);
  const appreciate = (item) => {
    const liked = likes(item);
    setData((prev) => ({
      ...prev,
      market: prev.market.map((m) =>
        m.id === item.id
          ? {
              ...m,
              likes: Math.max(0, (m.likes || 0) + (liked ? -1 : 1)),
              likedBy: liked
                ? (m.likedBy || []).filter((id) => id !== user.id)
                : [...(m.likedBy || []), user.id],
            }
          : m,
      ),
    }));
  };
  return (
    <div className="market-page">
      <div className="wiki-page-heading">
        <div>
          <div className="eyebrow">GOOD KNOWLEDGE IS BETTER SHARED</div>
          <h1>
            The wiki market<span className="wiki-title-dot">.</span>
          </h1>
          <p>A different perspective might be the one that makes it click.</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate("wiki")}>
          <BookOpen size={16} /> Share from my wiki <ArrowRight size={15} />
        </button>
      </div>
      <section className="market-feature">
        <div className="market-feature-copy">
          <span className="market-feature-kicker">
            <span /> YOUR COURSE, CONNECTED
          </span>
          <h2>
            Learn it your way.
            <br />
            See it through <em>theirs.</em>
          </h2>
          <p>
            Explore notes, visual explanations, and little breakthroughs
            <br className="market-desktop-break" /> made by the people learning
            alongside you.
          </p>
          <div className="market-community">
            <div className="market-avatar-stack">
              {(data.students || []).slice(0, 4).map((s) => (
                <span key={s.id} style={avatarStyle(s.color)}>
                  {s.initials}
                </span>
              ))}
            </div>
            <span>
              <strong>
                {Math.max((data.students || []).length, 4)} curious minds
              </strong>{" "}
              in {course?.code || "this course"}
            </span>
          </div>
        </div>
        <div className="market-feature-illustration" aria-hidden="true">
          <div className="market-feature-orbit orbit-one" />
          <div className="market-feature-orbit orbit-two" />
          <div className="market-floating-note floating-note-back">
            <span className="market-floating-icon peach">
              <GitBranch size={19} />
            </span>
            <strong>A new connection.</strong>
            <i />
            <i />
            <div>
              <span>concepts</span>
              <span>examples</span>
            </div>
          </div>
          <div className="market-floating-note floating-note-front">
            <span className="market-floating-icon blue">
              <Sparkles size={20} />
            </span>
            <span className="market-note-mini-kicker">
              A LITTLE BREAKTHROUGH
            </span>
            <strong>“Oh, now I get it.”</strong>
            <i />
            <i />
            <div>
              <span>understood</span>
              <Check size={14} />
            </div>
          </div>
          <span className="market-feature-spark">
            <Sparkles size={23} />
          </span>
          <span className="market-feature-link">
            <LinkIcon />
          </span>
        </div>
      </section>
      <div className="market-browse-heading">
        <div>
          <h2>
            From your course community <span>{items.length}</span>
          </h2>
          <p>Small notes. Shared understanding.</p>
        </div>
        <div className="market-browse-controls">
          <label className="market-search">
            <Search size={16} />
            <input
              aria-label="Search the course wiki market"
              placeholder="Search a concept, topic, author…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className={`market-saved-toggle ${onlySaved ? "active" : ""}`}
            onClick={() => setOnlySaved(!onlySaved)}
            aria-pressed={onlySaved}
          >
            <Bookmark size={15} fill={onlySaved ? "currentColor" : "none"} />{" "}
            Saved
          </button>
        </div>
      </div>
      <div className="market-filter-row">
        <div
          className="market-topic-filters"
          role="group"
          aria-label="Filter by topic"
        >
          {categories.map((c) => (
            <button
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
              key={c}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="market-sort">
          <span>Sort:</span>
          <select
            aria-label="Sort wiki publications"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option>Recommended</option>
            <option>Most appreciated</option>
            <option>Newest first</option>
          </select>
        </label>
      </div>
      {shown.length ? (
        <div className="market-cards">
          {shown.map((item, i) => (
            <article className="market-card" key={item.id}>
              <button
                className="market-card-cover-btn"
                onClick={() => openPublication(item.id)}
                aria-label={`Read ${item.title}`}
              >
                <CoverArt
                  kind={i}
                  title={item.title}
                  hasAnimation={item.hasAnimation}
                />
              </button>
              <div className="market-card-content">
                <div className="market-card-topic">
                  <span>{item.category}</span>
                  <span>v{item.version || 1}.0</span>
                </div>
                <button
                  className="market-title-btn"
                  onClick={() => openPublication(item.id)}
                >
                  <h3>{item.title}</h3>
                </button>
                <p>{item.description}</p>
                <div className="market-card-tags">
                  {(item.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <div className="market-card-author">
                  <span
                    className="market-author-avatar"
                    style={avatarStyle(item.color)}
                  >
                    {item.initials ||
                      item.author
                        ?.split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                  </span>
                  <span>
                    <strong>{item.author}</strong>
                    <small>{friendlyDate(item.updatedAt)}</small>
                  </span>
                  <button
                    className={`market-bookmark ${saved(item) ? "saved" : ""}`}
                    aria-label={
                      saved(item)
                        ? `Unsave ${item.title}`
                        : `Save ${item.title}`
                    }
                    onClick={() => bookmark(item)}
                  >
                    <Bookmark
                      size={17}
                      fill={saved(item) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              </div>
              <div className="market-card-footer">
                <button
                  className={likes(item) ? "is-liked" : ""}
                  onClick={() => appreciate(item)}
                  aria-label={`Appreciate ${item.title}`}
                  aria-pressed={likes(item)}
                >
                  <Heart
                    size={14}
                    fill={likes(item) ? "currentColor" : "none"}
                  />
                  <span>{item.likes || 0}</span>
                  <span className="market-footer-word">appreciations</span>
                </button>
                <button onClick={() => openPublication(item.id)}>
                  Explore note <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="market-empty">
          <Search size={30} />
          <h3>
            {onlySaved
              ? "Your collection is waiting."
              : "No notes found just yet."}
          </h3>
          <p>
            {onlySaved
              ? "Save a note that sparks something, then find it here."
              : "Try another topic or search for a broader idea."}
          </p>
          <button
            className="btn btn-outline"
            onClick={() => {
              setQuery("");
              setCategory("All topics");
              setOnlySaved(false);
            }}
          >
            Explore all notes
          </button>
        </div>
      )}
      <div className="market-bottom-note">
        <ShieldCheckSmall />
        <span>
          Shared within {course?.code || "your course"}. Each publication is a
          versioned snapshot, chosen by its author.
        </span>
      </div>
      {reading && (
        <Modal
          title={reading.title}
          subtitle={`${reading.author} · ${reading.category} · Version ${reading.version || 1}.0`}
          onClose={() => setReadingId(null)}
          wide
        >
          <div className="market-reader">
            <div className="market-reader-banner">
              <span
                className="market-author-avatar"
                style={avatarStyle(reading.color)}
              >
                {reading.initials}
              </span>
              <div>
                <strong>Shared by {reading.author}</strong>
                <span>
                  {friendlyDate(reading.updatedAt)} · {readingPages.length}{" "}
                  connected page{readingPages.length > 1 ? "s" : ""}
                </span>
              </div>
              <span className="market-snapshot-badge">
                <Layers3 size={12} /> Snapshot v{reading.version || 1}.0
              </span>
            </div>
            <p className="market-reader-description">{reading.description}</p>
            {readingPages.length > 1 && (
              <div
                className="market-package-nav"
                aria-label="Pages in this collection"
              >
                <div className="market-package-label">
                  <Layers3 size={13} /> IN THIS COLLECTION
                </div>
                {readingPages.map((page, index) => (
                  <button
                    className={readingPage.id === page.id ? "active" : ""}
                    key={page.id}
                    onClick={() => {
                      setReadingPageId(page.id);
                    }}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <FileText size={14} />
                    {page.title}
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            )}
            {readingPages.length > 1 && (
              <h2 className="market-package-page-title">{readingPage.title}</h2>
            )}
            <WikiMarkdown
              content={(
                readingPage?.content || "This publication is ready to explore."
              ).replace(/^# [^\n]+\n*/, "")}
              notes={readingPages}
              onLink={followPublicLink}
            />
            {reading.hasAnimation && (
              <div className="market-animation-note">
                <Sparkles size={18} />
                <div>
                  <strong>Understanding, in motion.</strong>
                  <span>
                    This collection includes an interactive HTML explainer.
                    Import it to play and explore in your wiki.
                  </span>
                </div>
              </div>
            )}
            <div className="market-reader-bottom">
              <button
                className={`btn btn-outline ${saved(reading) ? "is-saved" : ""}`}
                onClick={() => bookmark(reading)}
              >
                <Bookmark
                  size={15}
                  fill={saved(reading) ? "currentColor" : "none"}
                />
                {saved(reading) ? "Saved to collection" : "Save for later"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => importNote(reading)}
              >
                <ArrowDownToLine size={16} />{" "}
                {readingPages.length > 1
                  ? `Add ${readingPages.length} pages to my wiki`
                  : "Add to my wiki"}
              </button>
            </div>
            <p className="market-import-hint">
              You’ll get your own editable copy. The author’s original stays as
              published.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
      <path
        d="m10 15 5-5m-7 3-2 2a4 4 0 0 0 6 6l4-4a4 4 0 0 0-1-6m2 1 2-2a4 4 0 0 0-6-6l-4 4a4 4 0 0 0 1 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function ShieldCheckSmall() {
  return (
    <svg
      width="15"
      height="16"
      viewBox="0 0 15 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.5 1.5 13 3.8v4.3c0 3-3.1 5.4-5.5 6.4C5.1 13.5 2 11.1 2 8.1V3.8l5.5-2.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="m5 8 1.6 1.6L10 6.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
