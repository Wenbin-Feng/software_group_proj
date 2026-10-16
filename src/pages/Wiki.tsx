import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Globe2,
  Link2,
  Network,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { Markdown } from '../components/Markdown';
import { Badge, Confirm, Dialog, Empty, PageHeading, SaveStatus, Tip } from '../components/UI';
import { id, publishNote, renameNote, today, uniqueTitle, wikiLinks } from '../lib/domain';
import { useApp } from '../lib/store';

export function Wiki() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { state, user, setState, notify } = useApp();
  const [view, setView] = useState<'notes' | 'graph'>('notes');
  const [mode, setMode] = useState<'write' | 'preview'>('preview');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [ai, setAi] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const notes = state.notes.filter((n) => n.ownerId === user!.id);
  const note = notes.find((n) => n.id === noteId) || notes[0];
  const filtered = notes.filter((n) =>
    `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );
  const links = note ? wikiLinks(note.content) : [];
  const backlinks = note
    ? notes.filter(
        (n) =>
          n.id !== note.id &&
          wikiLinks(n.content).some((t) => t.toLowerCase() === note.title.toLowerCase()),
      )
    : [];
  const publication = state.publications.find(
    (p) => p.noteId === note?.id && p.authorId === user!.id,
  );
  const update = (changes: Partial<typeof note>) => {
    if (!note) return;
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === note.id && n.ownerId === user!.id ? { ...n, ...changes, updatedAt: today() } : n,
      ),
    }));
  };
  const open = (targetId: string) => {
    navigate(`/wiki/${targetId}`);
    setMode('preview');
    setView('notes');
  };
  const create = (name: string) => {
    const newId = id();
    const nextTitle = uniqueTitle(name, notes);
    setState((s) => ({
      ...s,
      notes: [
        {
          id: newId,
          ownerId: user!.id,
          title: nextTitle,
          content: `# ${nextTitle}\n\nStart with an idea. Make a connection.\n`,
          tags: [],
          updatedAt: today(),
        },
        ...s.notes,
      ],
    }));
    setCreating(false);
    setTitle('');
    navigate(`/wiki/${newId}`);
    setMode('write');
    setView('notes');
    notify('A new space for your idea.');
  };
  const follow = (target: string) => {
    const found = notes.find((n) => n.title.toLowerCase() === target.toLowerCase());
    if (found) open(found.id);
    else {
      setTitle(target);
      setCreating(true);
    }
  };
  const suggested = notes
    .filter(
      (n) => n.id !== note?.id && !links.some((l) => l.toLowerCase() === n.title.toLowerCase()),
    )
    .slice(0, 2);
  const suggestion = `\n\n## Further connections\n\n${suggested.length ? suggested.map((n) => `- [[${n.title}]] — explore how this idea relates to ${note?.title.toLowerCase()}.`).join('\n') : '- What example from your own project would make this idea more concrete?'}\n\n## A question to keep\n\nHow would I explain this to a classmate using a concrete example?`;
  return (
    <div className="page wiki-page">
      <PageHeading
        eyebrow="YOUR OWN LITTLE WORLD OF KNOWLEDGE"
        title="A home for your ideas."
        description="Capture what clicks. Connect what matters. Let your understanding grow."
        action={
          <button
            className="button"
            onClick={() => {
              setTitle('');
              setCreating(true);
            }}
          >
            <Plus size={17} />
            New note
          </button>
        }
      />
      <div className="wiki-top-controls">
        <div className="segmented-tabs">
          <button className={view === 'notes' ? 'active' : ''} onClick={() => setView('notes')}>
            <FileText size={16} />
            My notes <span>{notes.length}</span>
          </button>
          <button className={view === 'graph' ? 'active' : ''} onClick={() => setView('graph')}>
            <Network size={16} />
            Knowledge graph
          </button>
        </div>
        <span className="wiki-top-hint">
          <Link2 size={14} />
          Small notes. Meaningful connections.
        </span>
      </div>
      {view === 'graph' ? (
        <KnowledgeGraph notes={notes} onOpen={open} />
      ) : (
        <div className="wiki-workspace">
          <aside className="note-sidebar">
            <div className="note-sidebar-title">
              <span>YOUR NOTES</span>
              <button
                className="icon-button"
                aria-label="Create a note"
                onClick={() => {
                  setTitle('');
                  setCreating(true);
                }}
              >
                <Plus size={16} />
              </button>
            </div>
            <label className="search-field note-search">
              <Search size={14} />
              <input
                aria-label="Search personal notes"
                placeholder="Find an idea…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="note-list">
              {filtered.map((n) => (
                <button
                  key={n.id}
                  className={note?.id === n.id ? 'active' : ''}
                  onClick={() => open(n.id)}
                >
                  <FileText size={15} />
                  <span>
                    <strong>{n.title}</strong>
                    <small>{n.tags[0] || 'Personal note'}</small>
                  </span>
                </button>
              ))}
              {!filtered.length && <p className="note-no-results">No matching ideas yet.</p>}
            </div>
            <div className="note-sidebar-footer">
              <Network size={20} />
              <p>
                Your ideas get stronger
                <br />
                when you connect them.
              </p>
              <button onClick={() => setView('graph')}>
                Explore your graph <ArrowUpRight size={13} />
              </button>
            </div>
          </aside>
          {note ? (
            <>
              <section className="note-editor">
                <div className="note-editor-toolbar">
                  <span>
                    <BookOpen size={14} />
                    My Wiki <ChevronRight size={12} />
                    Note
                  </span>
                  <SaveStatus />
                </div>
                <div className="note-header">
                  <div className="note-title-row">
                    <h2>{note.title}</h2>
                    <button
                      className="icon-button"
                      aria-label="Rename note"
                      onClick={() => {
                        setRenameTitle(note.title);
                        setError('');
                        setRenaming(true);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                  <div className="note-tags">
                    {note.tags.map((tag) => (
                      <span className="note-tag" key={tag}>
                        {tag}
                        <button
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => update({ tags: note.tags.filter((t) => t !== tag) })}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const tag = tagInput.trim();
                        if (tag && !note.tags.some((t) => t.toLowerCase() === tag.toLowerCase()))
                          update({ tags: [...note.tags, tag] });
                        setTagInput('');
                      }}
                    >
                      <input
                        aria-label="Add note tag"
                        placeholder="+ Add tag"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        maxLength={30}
                      />
                    </form>
                  </div>
                  {note.sourceAuthorId && (
                    <div className="note-attribution">
                      Adapted from a note by{' '}
                      {state.users.find((u) => u.id === note.sourceAuthorId)?.name ||
                        'a community author'}
                      .
                    </div>
                  )}
                </div>
                <div className="note-mode-row">
                  <div className="note-mode">
                    <button
                      className={mode === 'write' ? 'active' : ''}
                      onClick={() => setMode('write')}
                    >
                      <Pencil size={13} />
                      Write
                    </button>
                    <button
                      className={mode === 'preview' ? 'active' : ''}
                      onClick={() => setMode('preview')}
                    >
                      <BookOpen size={13} />
                      Preview
                    </button>
                  </div>
                  <button className="ai-polish" onClick={() => setAi(true)}>
                    <Sparkles size={14} />
                    Find a connection
                  </button>
                </div>
                <div className="note-body">
                  {mode === 'write' ? (
                    <textarea
                      className="markdown-editor"
                      aria-label="Note Markdown editor"
                      value={note.content}
                      onChange={(e) => update({ content: e.target.value })}
                      spellCheck={false}
                    />
                  ) : (
                    <Markdown content={note.content} onWikiLink={follow} />
                  )}
                </div>
                <div className="note-editor-footer">
                  <span>
                    {note.content.trim() ? note.content.trim().split(/\s+/).length : 0} words <i />
                    Markdown + [[links]]
                  </span>
                  <button
                    className="icon-button subtle-danger"
                    aria-label="Delete note"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </section>
              <aside className="note-connections">
                <div className="connections-header">
                  <Network size={17} />
                  <h3>The connected bits</h3>
                </div>
                <p className="connections-intro">No idea lives on its own.</p>
                <div className="connection-group">
                  <h4>
                    OUTGOING LINKS <span>{links.length}</span>
                  </h4>
                  {links.length ? (
                    links.map((link) => {
                      const exists = notes.some(
                        (n) => n.title.toLowerCase() === link.toLowerCase(),
                      );
                      return (
                        <button
                          className={exists ? '' : 'missing-link'}
                          key={link}
                          onClick={() => follow(link)}
                        >
                          <Link2 size={13} />
                          <span>{link}</span>
                          {exists ? <ArrowUpRight size={12} /> : <Plus size={12} />}
                        </button>
                      );
                    })
                  ) : (
                    <p>Add [[Note Title]] in your note to make a connection.</p>
                  )}
                </div>
                <div className="connection-group">
                  <h4>
                    LINKED FROM <span>{backlinks.length}</span>
                  </h4>
                  {backlinks.length ? (
                    backlinks.map((n) => (
                      <button key={n.id} onClick={() => open(n.id)}>
                        <ArrowLeft size={13} />
                        <span>{n.title}</span>
                      </button>
                    ))
                  ) : (
                    <p>Notes that link here will appear as your Wiki grows.</p>
                  )}
                </div>
                <div className="publish-note-box">
                  <Globe2 size={23} />
                  <h3>An idea worth sharing?</h3>
                  <p>Help someone else see things a little differently.</p>
                  <button
                    className="button"
                    onClick={() => {
                      const nextPub = publishNote(note, publication?.id || id());
                      setState((s) => ({
                        ...s,
                        publications: publication
                          ? s.publications.map((p) => (p.id === publication.id ? nextPub : p))
                          : [nextPub, ...s.publications],
                      }));
                      notify(
                        publication
                          ? 'Published snapshot updated.'
                          : 'Your note is now in Wiki Market.',
                      );
                    }}
                  >
                    <Globe2 size={14} />
                    {publication ? 'Update publication' : 'Publish to Market'}
                  </button>
                  {publication && (
                    <>
                      <button
                        className="text-link"
                        onClick={() => navigate(`/market/${publication.id}`)}
                      >
                        View publication <ArrowUpRight size={12} />
                      </button>
                      <button
                        className="unpublish-link"
                        onClick={() => {
                          setState((s) => ({
                            ...s,
                            publications: s.publications.filter((p) => p.id !== publication.id),
                          }));
                          notify('Publication removed. Your private note is unchanged.');
                        }}
                      >
                        Unpublish
                      </button>
                    </>
                  )}
                  <small>
                    {publication
                      ? 'Private edits stay private until you update.'
                      : 'Publishes a snapshot. Your draft stays yours.'}
                  </small>
                </div>
              </aside>
            </>
          ) : (
            <Empty
              title="Make room for your first idea"
              description="Create a note or bring an inspiring one home from Wiki Market."
              action={
                <button className="button" onClick={() => setCreating(true)}>
                  Create a note
                </button>
              }
            />
          )}
        </div>
      )}
      {creating && (
        <Dialog title="What’s on your mind?" onClose={() => setCreating(false)}>
          <p className="dialog-description">
            Give your idea a name. You can shape it as you learn.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create(title);
            }}
          >
            <label className="form-label">
              Note title
              <input
                className="text-input"
                placeholder="e.g. Thinking in small iterations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </label>
            <Tip>
              Connect notes with [[Note Title]]. Missing notes can be created straight from a link.
            </Tip>
            <div className="dialog-actions">
              <button className="button secondary" type="button" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="button" type="submit">
                <Plus size={15} />
                Create note
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {renaming && note && (
        <Dialog title="Give this idea a new name" onClose={() => setRenaming(false)}>
          <p className="dialog-description">
            Links in your other notes will follow the new title automatically.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                // Validate before scheduling a React update so errors stay in this dialog.
                const renamedNotes = renameNote(state.notes, note.id, renameTitle, user!.id);
                setState((s) => ({
                  ...s,
                  notes: renamedNotes,
                }));
                setRenaming(false);
                notify('Note renamed and links updated.');
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label className="form-label">
              Note title
              <input
                className="text-input"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="button secondary" onClick={() => setRenaming(false)}>
                Cancel
              </button>
              <button className="button" type="submit">
                Rename note
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleting && note && (
        <Confirm
          title="Delete this private note?"
          description="Other notes will keep their links and can recreate the missing idea. Published snapshots remain available until you unpublish them."
          danger
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== note.id) }));
            navigate('/wiki');
            notify('Private note deleted.');
          }}
        />
      )}
      {ai && note && (
        <Dialog title="A fresh angle on your idea" onClose={() => setAi(false)}>
          <Badge color="purple">Demo AI · Prepared suggestion</Badge>
          <p className="dialog-description">
            Here are a few prompts and connections to help you think further. Review them before
            adding anything.
          </p>
          <div className="suggestion-preview">
            <Markdown content={suggestion} onWikiLink={follow} />
          </div>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setAi(false)}>
              Keep thinking
            </button>
            <button
              className="button"
              onClick={() => {
                update({ content: note.content + suggestion });
                setAi(false);
                notify('Suggestion added. Edit it in your own words.');
              }}
            >
              <Check size={15} />
              Add to my note
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
