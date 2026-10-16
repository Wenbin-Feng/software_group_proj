import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  LogOut,
  Menu,
  Network,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { Avatar, Badge, Confirm, Dialog, Logo } from './UI';

export function Shell({ children }: { children: ReactNode }) {
  const { state, user, switchUser, reset, storageError } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [identity, setIdentity] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [help, setHelp] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearch(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  if (!user) return null;
  const activeLabel = location.pathname.startsWith('/wiki')
    ? 'My Wiki'
    : location.pathname.startsWith('/market')
      ? 'Wiki Market'
      : location.pathname.startsWith('/manage')
        ? 'Workspace management'
        : 'My Classes';
  const resultQuery = query.trim().toLowerCase();
  const results = [
    ...state.courses
      .filter(
        (c) =>
          user.role !== 'student' ||
          state.memberships.some((m) => m.userId === user.id && m.courseId === c.id),
      )
      .map((c) => ({ title: c.title, kind: 'Class', path: `/classes/${c.id}` })),
    ...state.notes
      .filter((n) => n.ownerId === user.id)
      .map((n) => ({ title: n.title, kind: 'Wiki note', path: `/wiki/${n.id}` })),
    ...state.publications.map((p) => ({
      title: p.title,
      kind: 'Community note',
      path: `/market/${p.id}`,
    })),
  ]
    .filter((r) => r.title.toLowerCase().includes(resultQuery))
    .slice(0, 8);
  return (
    <div className="app-layout">
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <button className="workspace-picker" onClick={() => setIdentity(true)}>
          <span className="workspace-avatar">L</span>
          <span>
            <strong>My learning space</strong>
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink to="/classes">
            <BookOpen size={19} />
            <span>My Classes</span>
            <span className="nav-count">
              {user.role === 'student'
                ? state.memberships.filter((membership) => membership.userId === user.id).length
                : state.courses.length}
            </span>
          </NavLink>
          <NavLink to="/wiki">
            <Network size={19} />
            <span>My Wiki</span>
          </NavLink>
          <NavLink to="/market">
            <Compass size={19} />
            <span>Wiki Market</span>
            <span className="new-dot" />
          </NavLink>
          {user.role !== 'student' && (
            <NavLink to="/manage">
              <Users size={19} />
              <span>{user.role === 'admin' ? 'People & roles' : 'Class management'}</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-spark">
              <Sparkles size={17} />
            </span>
            <h4>
              A little curiosity.
              <br />A lot of possibility.
            </h4>
            <p>Your next great idea could start with a question.</p>
            <button onClick={() => navigate('/wiki')}>
              Explore your Wiki <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="sidebar-utility" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            Help & demo guide
          </button>
          <button className="sidebar-utility" onClick={() => setConfirm(true)}>
            <RotateCcw size={16} />
            Reset demo data
          </button>
          <button className="profile-button" onClick={() => setIdentity(true)}>
            <Avatar user={user} />
            <span>
              <strong>{user.name}</strong>
              <small>{user.role.charAt(0).toUpperCase() + user.role.slice(1)} · Demo account</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{activeLabel}</strong>
          </div>
          <div className="topbar-right">
            <button className="search-trigger" onClick={() => setSearch(true)}>
              <Search size={16} />
              <span>Search your workspace</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="demo-pill">
              <span />
              Interactive prototype
            </span>
            <button
              className="topbar-avatar"
              aria-label="Switch demo identity"
              onClick={() => setIdentity(true)}
            >
              <Avatar user={user} small />
            </button>
          </div>
        </header>
        {storageError && (
          <div className="storage-alert" role="alert">
            {storageError}
          </div>
        )}
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          <span>Made for curious minds.</span>
          <span>
            Luma learning workspace <i /> Frontend demo
          </span>
        </footer>
      </div>
      {identity && (
        <Dialog title="Choose your demo identity" onClose={() => setIdentity(false)}>
          <p className="dialog-description">
            Explore the same workspace from different perspectives. Each student has a personal
            Wiki.
          </p>
          <div className="identity-list">
            {state.users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  switchUser(u.id);
                  setIdentity(false);
                  navigate('/classes');
                }}
              >
                <Avatar user={u} />
                <span>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </span>
                <Badge color={u.color}>{u.role}</Badge>
                {u.id === user.id ? <Check size={18} /> : <ArrowRight size={17} />}
              </button>
            ))}
          </div>
          <button
            className="button secondary full-width"
            onClick={() => {
              switchUser(null);
              setIdentity(false);
              navigate('/login');
            }}
          >
            <LogOut size={16} />
            Back to sign in
          </button>
        </Dialog>
      )}
      {search && (
        <Dialog title="Search your workspace" onClose={() => setSearch(false)}>
          <label className="search-field dialog-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search classes, notes, and community"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Classes, notes, and community ideas…"
            />
          </label>
          <div className="search-results">
            {results.length ? (
              results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    navigate(r.path);
                    setSearch(false);
                    setQuery('');
                  }}
                >
                  <span>
                    <small>{r.kind}</small>
                    <strong>{r.title}</strong>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))
            ) : (
              <p>No results. Try “Agile” or “Requirements”.</p>
            )}
          </div>
        </Dialog>
      )}
      {help && (
        <Dialog title="A connected learning journey" onClose={() => setHelp(false)}>
          <div className="help-steps">
            <p>
              <b>1. Explore a classroom.</b> Open Software Engineering Fundamentals and choose the
              lifecycle guide.
            </p>
            <p>
              <b>2. Follow your curiosity.</b> Ask the suggested Waterfall / Agile question and open
              the interactive animation.
            </p>
            <p>
              <b>3. Make the idea yours.</b> Save the explanation to My Wiki, edit it, and connect
              it with [[Note Title]] links.
            </p>
            <p>
              <b>4. Learn together.</b> Publish to Wiki Market, switch to Jamie Chen, and copy the
              shared note.
            </p>
          </div>
          <div className="tip">Class codes: SE2026 · AI2026 · DESIGN26</div>
          <p className="fine-print">
            Google sign-in and AI responses are simulated. Data stays in this browser. Uploaded
            binary files need reselection after reload. No real account or backend is used.
          </p>
        </Dialog>
      )}
      {confirm && (
        <Confirm
          title="Start fresh?"
          description="This restores the original sample classes, notes, and community entries. Your local edits and uploads will be removed."
          onConfirm={() => {
            reset();
            navigate('/login');
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
