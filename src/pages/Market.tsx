import {
  BookOpen,
  Bookmark,
  Compass,
  Copy,
  FileText,
  Globe2,
  Lightbulb,
  Network,
  Search,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { Avatar, Badge, Dialog, Empty, PageHeading } from '../components/UI';
import { copyPublication, id, type Publication } from '../lib/domain';
import { useApp } from '../lib/store';

function MarketArt({ publication, index }: { publication: Publication; index: number }) {
  const Icon = index % 3 === 0 ? Network : index % 3 === 1 ? Sparkles : Lightbulb;
  return (
    <div className={`market-art ${publication.color}`} aria-hidden="true">
      <span className="art-grid" />
      <div className="market-art-center">
        <Icon size={44} strokeWidth={1.3} />
      </div>
      <span className="market-art-note">
        <FileText size={15} />
        <i />
        <i />
      </span>
      <span className="market-art-orbit" />
      <span className="market-art-star">✧</span>
    </div>
  );
}
export function Market() {
  const { publicationId } = useParams();
  const { state, user, setState, notify } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('All topics');
  const [view, setView] = useState('Discover');
  const selected = state.publications.find((p) => p.id === publicationId);
  const tags = ['All topics', 'Software engineering', 'AI', 'Agile', 'Product', 'Study guides'];
  const bookmarked = (pub: Publication) =>
    state.bookmarks.some((b) => b.userId === user!.id && b.publicationId === pub.id);
  const toggle = (pub: Publication) => {
    setState((s) => ({
      ...s,
      bookmarks: bookmarked(pub)
        ? s.bookmarks.filter((b) => !(b.userId === user!.id && b.publicationId === pub.id))
        : [...s.bookmarks, { userId: user!.id, publicationId: pub.id }],
    }));
  };
  const filtered = state.publications.filter(
    (p) =>
      (view === 'Discover' ||
        (view === 'Bookmarked' && bookmarked(p)) ||
        (view === 'My publications' && p.authorId === user!.id)) &&
      (tag === 'All topics' || p.tags.includes(tag)) &&
      `${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );
  const copy = (pub: Publication) => {
    const note = copyPublication(pub, user!.id, state.notes, id());
    setState((s) => ({ ...s, notes: [note, ...s.notes] }));
    notify('A copy is now in your Wiki, with credit to its author.');
    navigate(`/wiki/${note.id}`);
  };
  return (
    <div className="page market-page">
      <PageHeading
        eyebrow="KNOWLEDGE GETS BETTER WHEN IT’S SHARED"
        title="A good idea is just the beginning."
        description="Explore notes from curious minds. Find a fresh perspective. Make it your own."
        action={
          <button className="button secondary" onClick={() => navigate('/wiki')}>
            <PlusIcon />
            Share from My Wiki
          </button>
        }
      />
      <section className="market-banner">
        <div>
          <span className="eyebrow">
            <Compass size={15} />
            THE WIKI MARKET
          </span>
          <h2>
            A community of
            <br />
            “here’s what helped me.”
          </h2>
          <p>Thoughtful notes. Useful connections. A little inspiration for your next class.</p>
        </div>
        <div className="market-banner-art" aria-hidden="true">
          <div className="community-paper p1">
            <span>Good questions.</span>
            <i />
            <i />
            <Network size={33} />
          </div>
          <div className="community-paper p2">
            <Sparkles size={25} />
            <span>Fresh perspectives.</span>
            <i />
            <i />
          </div>
          <div className="community-paper p3">
            <BookOpen size={25} />
            <span>Shared understanding.</span>
          </div>
          <span className="market-banner-star">✳</span>
        </div>
      </section>
      <div className="market-controls">
        <div className="underlined-tabs">
          {['Discover', 'Bookmarked', 'My publications'].map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v === 'Bookmarked' && <Bookmark size={15} />} {v}
              {v === 'Discover' && <span>{state.publications.length}</span>}
            </button>
          ))}
        </div>
        <label className="search-field compact">
          <Search size={16} />
          <input
            aria-label="Search Wiki Market"
            placeholder="Find your next lightbulb moment…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="filter-chips market-tags">
        {tags.map((t) => (
          <button key={t} onClick={() => setTag(t)} className={tag === t ? 'active' : ''}>
            {t}
          </button>
        ))}
      </div>
      <div className="market-section-heading">
        <h2>
          {view === 'Discover'
            ? 'Made to be passed on.'
            : view === 'Bookmarked'
              ? 'Ideas you’re keeping close.'
              : 'Your ideas, out in the world.'}
        </h2>
        <span>
          {filtered.length} thoughtful {filtered.length === 1 ? 'note' : 'notes'}
        </span>
      </div>
      <div className="market-grid">
        {filtered.map((pub, index) => {
          const author = state.users.find((u) => u.id === pub.authorId)!;
          return (
            <article className="market-card" key={pub.id}>
              <button
                className="market-cover-button"
                aria-label={`Read ${pub.title}`}
                onClick={() => navigate(`/market/${pub.id}`)}
              >
                <MarketArt publication={pub} index={index} />
              </button>
              <div className="market-card-body">
                <div className="market-card-tags">
                  {pub.tags.slice(0, 2).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <button className="market-title" onClick={() => navigate(`/market/${pub.id}`)}>
                  <h3>{pub.title}</h3>
                </button>
                <p>{pub.description}</p>
                <div className="market-card-footer">
                  <Avatar user={author} small />
                  <span>
                    <strong>{author.name}</strong>
                    <small>
                      {author.role === 'instructor' ? 'Instructor' : 'Student contributor'}
                    </small>
                  </span>
                  <button
                    className={`icon-button ${bookmarked(pub) ? 'bookmarked' : ''}`}
                    aria-label={`${bookmarked(pub) ? 'Remove bookmark' : 'Bookmark'} ${pub.title}`}
                    onClick={() => toggle(pub)}
                  >
                    <Bookmark size={17} fill={bookmarked(pub) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="Room for your next discovery"
          description={
            view === 'My publications'
              ? 'Publish a note from My Wiki and it will appear here.'
              : 'Try another topic or bookmark a note you want to revisit.'
          }
          action={
            <button
              className="button secondary"
              onClick={() => {
                setView('Discover');
                setQuery('');
                setTag('All topics');
              }}
            >
              Explore all notes
            </button>
          }
        />
      )}
      <div className="market-bottom-note">
        <Globe2 size={17} />
        <span>
          Good knowledge is generous. All notes are free to explore and adapt, with credit to their
          authors.
        </span>
      </div>
      {selected && (
        <Dialog title="A little knowledge, shared" wide onClose={() => navigate('/market')}>
          <div className="publication-detail">
            <div className="publication-main">
              <div className="market-card-tags">
                {selected.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <h2>{selected.title}</h2>
              <p className="publication-description">{selected.description}</p>
              <div className="publication-author">
                <Avatar user={state.users.find((u) => u.id === selected.authorId)!} />
                <div>
                  <strong>{state.users.find((u) => u.id === selected.authorId)?.name}</strong>
                  <span>Published {selected.publishedAt} · Free community note</span>
                </div>
              </div>
              <Markdown content={selected.content} />
            </div>
            <aside className="publication-aside">
              <div className="publication-copy-icon">
                <Copy size={25} />
              </div>
              <h3>
                A starting point.
                <br />
                Make it yours.
              </h3>
              <p>
                Save an independent copy to your Wiki. Add your examples and connect it to your own
                ideas.
              </p>
              <button className="button" onClick={() => copy(selected)}>
                <Copy size={15} />
                Copy to My Wiki
              </button>
              <button className="button secondary" onClick={() => toggle(selected)}>
                <Bookmark size={15} fill={bookmarked(selected) ? 'currentColor' : 'none'} />
                {bookmarked(selected) ? 'Bookmarked' : 'Bookmark for later'}
              </button>
              <small>The author stays credited. Your edits stay in your personal Wiki.</small>
              {selected.authorId === user!.id && (
                <button
                  className="unpublish-link"
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      publications: s.publications.filter((p) => p.id !== selected.id),
                    }));
                    navigate('/market');
                    notify('Note unpublished.');
                  }}
                >
                  Unpublish this note
                </button>
              )}
            </aside>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function PlusIcon() {
  return <Globe2 size={16} />;
}
