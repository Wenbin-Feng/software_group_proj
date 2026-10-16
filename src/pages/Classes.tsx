import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  Compass,
  CornerDownRight,
  FileText,
  Network,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, CourseIcon, Dialog, Empty, PageHeading, Tip } from '../components/UI';
import { joinCourse } from '../lib/domain';
import { useApp } from '../lib/store';

export function Classes() {
  const { state, user, setState, notify } = useApp();
  const navigate = useNavigate();
  const [join, setJoin] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const courses = state.courses.filter(
    (c) =>
      (user!.role !== 'student' ||
        state.memberships.some((m) => m.userId === user!.id && m.courseId === c.id)) &&
      `${c.title} ${c.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  const notes = state.notes.filter((n) => n.ownerId === user!.id);
  const materials = state.materials.filter((m) => courses.some((c) => c.id === m.courseId));
  const greet = user!.name.replace(/^(Dr\.|Prof\.)\s+/i, '').split(' ')[0];
  return (
    <div className="page classes-page">
      <PageHeading
        eyebrow="YOUR LEARNING, CONNECTED"
        title={`Good to see you, ${greet}.`}
        description="A new question. A fresh connection. Where will you go today?"
        action={
          <button
            className="button"
            onClick={() => {
              setJoin(true);
              setError('');
            }}
          >
            <Plus size={17} />
            Join a class
          </button>
        }
      />
      <section className="welcome-banner">
        <div className="banner-text">
          <span className="banner-label">
            <Sparkles size={14} />
            LESS SCATTERED. MORE CONNECTED.
          </span>
          <h2>Go beyond the lecture.</h2>
          <p>
            Your classroom files, an AI study partner, and a Wiki that
            <br className="desktop-break" /> grows with you. All in one thoughtful space.
          </p>
          <button onClick={() => navigate('/classes/se')}>
            Pick up where you left off <ArrowRight size={16} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-ring ring-a" />
          <div className="art-ring ring-b" />
          <div className="art-ring ring-c" />
          <div className="floating-card art-files">
            <FileText size={25} />
            <span>Collect.</span>
            <i />
            <i />
          </div>
          <div className="floating-card art-ai">
            <Sparkles size={26} />
            <span>Understand.</span>
            <div className="mini-wave">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="floating-card art-wiki">
            <Network size={26} />
            <span>Connect.</span>
            <div className="mini-nodes">
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="art-spark spark-one">✧</span>
          <span className="art-spark spark-two">✦</span>
        </div>
      </section>
      <div className="workspace-stats">
        <div>
          <span className="stat-icon sage">
            <BookOpen size={19} />
          </span>
          <strong>{courses.length}</strong>
          <span>Active classes</span>
        </div>
        <div>
          <span className="stat-icon blue">
            <FileText size={19} />
          </span>
          <strong>{materials.length}</strong>
          <span>Learning materials</span>
        </div>
        <div>
          <span className="stat-icon purple">
            <Network size={19} />
          </span>
          <strong>{notes.length}</strong>
          <span>Connected notes</span>
        </div>
        <div>
          <span className="stat-icon peach">
            <Compass size={19} />
          </span>
          <strong>{state.publications.length}</strong>
          <span>Community ideas</span>
        </div>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <h2>
              Your classrooms <span className="count-chip">{courses.length}</span>
            </h2>
            <p>A shared space to learn something new.</p>
          </div>
          <label className="search-field compact">
            <Search size={16} />
            <input
              aria-label="Search classes"
              placeholder="Find a class…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="course-grid">
          {courses.map((course) => {
            const instructor = state.users.find((u) => u.id === course.instructorId)!;
            return (
              <button
                className="course-card"
                key={course.id}
                onClick={() => navigate(`/classes/${course.id}`)}
              >
                <div className={`course-cover ${course.color}`}>
                  <span className="course-cover-label">{course.code.split('  ')[0]}</span>
                  <div className={`cover-illustration ${course.icon}`}>
                    <CourseIcon course={course} size={58} />
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="course-open">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
                <div className="course-card-body">
                  <span className="course-category">{course.code.split('  ')[1]}</span>
                  <h3>{course.title}</h3>
                  <div className="instructor-line">
                    <Avatar user={instructor} small />
                    <span>{instructor.name}</span>
                  </div>
                  <div className="course-card-meta">
                    <span>
                      <FileText size={14} />
                      {state.materials.filter((m) => m.courseId === course.id).length} materials
                    </span>
                    <span>
                      <Users size={14} />
                      {state.memberships.filter((m) => m.courseId === course.id).length} students
                    </span>
                    <span className="course-term">{course.term}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!courses.length && (
          <Empty
            title="Your next class is one code away"
            description="Join with a class invitation code, or try another search."
            action={
              <button className="button" onClick={() => setJoin(true)}>
                Join a class
              </button>
            }
          />
        )}
      </section>
      <div className="home-bottom">
        <section className="continue-panel">
          <div className="section-heading">
            <h2>Keep the ideas flowing</h2>
            <button className="text-link" onClick={() => navigate('/wiki')}>
              Open My Wiki <ArrowUpRight size={14} />
            </button>
          </div>
          {notes.slice(0, 2).map((note) => (
            <button
              className="recent-note"
              key={note.id}
              onClick={() => navigate(`/wiki/${note.id}`)}
            >
              <span className="recent-note-icon">
                <FileText size={19} />
              </span>
              <span>
                <strong>{note.title}</strong>
                <small>
                  <Clock3 size={12} /> Updated{' '}
                  {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                    new Date(note.updatedAt + 'T12:00:00'),
                  )}
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </section>
        <section className="community-prompt">
          <div className="community-prompt-icon">
            <Compass size={23} />
          </div>
          <div>
            <span className="eyebrow">GOOD IDEAS TRAVEL</span>
            <h3>
              Someone else’s notes.
              <br />
              Your next lightbulb moment.
            </h3>
            <button className="text-link" onClick={() => navigate('/market')}>
              Wander the Wiki Market <ArrowRight size={15} />
            </button>
          </div>
          <CornerDownRight className="community-decoration" size={60} />
        </section>
      </div>
      {join && (
        <Dialog title="A seat in your next classroom" onClose={() => setJoin(false)}>
          <p className="dialog-description">Enter the invitation code shared by your instructor.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const next = joinCourse(state, code, user!.id);
                const course = state.courses.find(
                  (c) => c.inviteCode.toLowerCase() === code.trim().toLowerCase(),
                )!;
                setState(next);
                setJoin(false);
                notify(
                  next === state
                    ? 'You are already in this class.'
                    : 'Welcome to your new classroom.',
                );
                navigate(`/classes/${course.id}`);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label className="form-label">
              Class invitation code
              <input
                className="text-input code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SE2026"
                autoComplete="off"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Tip>Try SE2026 for Software Engineering, AI2026, or DESIGN26.</Tip>
            <div className="dialog-actions">
              <button className="button secondary" type="button" onClick={() => setJoin(false)}>
                Cancel
              </button>
              <button className="button" type="submit">
                Join classroom <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
