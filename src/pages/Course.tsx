import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  FileText,
  Link2,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Assistant } from '../components/Assistant';
import { Markdown } from '../components/Markdown';
import { PdfPreview } from '../components/PdfPreview';
import {
  Avatar,
  Badge,
  Confirm,
  CourseIcon,
  Dialog,
  Empty,
  MaterialSymbol,
  Tip,
} from '../components/UI';
import { joinCourse, type Material } from '../lib/domain';
import { useApp } from '../lib/store';

export function CoursePage() {
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, user, setState, notify, registerFile, removeFile, fileUrls } = useApp();
  const [tab, setTab] = useState('Materials');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All materials');
  const [upload, setUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Lecture notes');
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [memberRemove, setMemberRemove] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null),
    article = useRef<HTMLElement>(null);
  const course = state.courses.find((c) => c.id === courseId);
  if (!course)
    return (
      <Empty
        title="Class not found"
        description="Return to your classes to choose an available space."
        action={
          <button className="button" onClick={() => navigate('/classes')}>
            My Classes
          </button>
        }
      />
    );
  const isMember =
    user!.role !== 'student' ||
    state.memberships.some((m) => m.courseId === courseId && m.userId === user!.id);
  if (!isMember)
    return (
      <div className="page">
        <Empty
          title="Your classroom is waiting"
          description="Join this class to explore its materials and study with your AI partner."
          action={
            <button
              className="button"
              onClick={() => {
                setState(joinCourse(state, course.inviteCode, user!.id));
                notify('You joined the classroom.');
              }}
            >
              Join {course.title}
            </button>
          }
        />
      </div>
    );
  const instructor = state.users.find((u) => u.id === course.instructorId)!;
  const canManage =
    user!.role === 'admin' || (user!.role === 'instructor' && course.instructorId === user!.id);
  const materials = state.materials.filter((m) => m.courseId === courseId);
  const selected = materials.find((m) => m.id === params.get('material'));
  const members = state.users.filter((u) =>
    state.memberships.some((m) => m.courseId === courseId && m.userId === u.id),
  );
  const filtered = materials.filter(
    (m) =>
      (category === 'All materials' || m.category === category) &&
      `${m.title} ${m.filename}`.toLowerCase().includes(query.toLowerCase()),
  );
  const chooseFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setUploadError('');
    try {
      await registerFile(file, course.id, uploadCategory);
      setUpload(false);
      notify('Material added to the classroom.');
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };
  const download = () => {
    if (!selected) return;
    const sessionUrl = fileUrls[selected.id];
    if (!selected.body && !sessionUrl) {
      notify('Reselect this file to download it.');
      return;
    }
    const url =
      sessionUrl || URL.createObjectURL(new Blob([selected.body], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = selected.filename;
    a.click();
    if (!sessionUrl) setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (selected)
    return (
      <div className="reader-page">
        <div className="reader-breadcrumb">
          <button onClick={() => setParams({})}>
            <ArrowLeft size={15} />
            Class materials
          </button>
          <ChevronRight size={14} />
          <span>{course.title}</span>
        </div>
        <div className="reader-title">
          <div>
            <div className="eyebrow">
              {course.code.split('  ')[0]} · {selected.category.toUpperCase()}
            </div>
            <h1>{selected.title}</h1>
            <div className="reader-meta">
              <Avatar user={instructor} small />
              <span>{instructor.name}</span>
              <span>·</span>
              <span>{selected.size}</span>
              <span>·</span>
              <Badge color={selected.seeded ? 'sage' : 'peach'}>
                {selected.seeded ? 'Class material' : 'Your upload'}
              </Badge>
            </div>
          </div>
          <button className="button secondary" onClick={download}>
            <Download size={16} />
            Download
          </button>
        </div>
        <div className="reader-layout">
          <section
            className={`document-panel ${highlight ? 'source-highlight' : ''}`}
            ref={article}
          >
            <div className="document-toolbar">
              <span>
                <FileText size={15} />
                {selected.filename}
              </span>
              <span>
                <span className="status-dot" />
                {selected.body ? 'Reading view' : 'File preview'}
              </span>
            </div>
            <div
              className={`document-content ${!selected.body && fileUrls[selected.id] && /\.pdf$/i.test(selected.filename) ? 'pdf-document-content' : ''}`}
            >
              {selected.body ? (
                <>
                  <div className="document-kicker">LEARN THE FOUNDATIONS</div>
                  <Markdown content={selected.body} />
                  <div className="document-end">
                    <span>Keep the conversation going.</span>
                    <p>Ask your study partner about a tricky idea, or connect it to your Wiki.</p>
                    <Sparkles size={23} />
                  </div>
                </>
              ) : fileUrls[selected.id] ? (
                /\.pdf$/i.test(selected.filename) ? (
                  <PdfPreview title={selected.title} url={fileUrls[selected.id]} />
                ) : (
                  <Empty
                    title="File ready to download"
                    description="This format has no inline preview. Download it to view in a compatible application."
                    action={
                      <button className="button" onClick={download}>
                        Download file
                      </button>
                    }
                  />
                )
              ) : (
                <Empty
                  title="Reselect your file to continue"
                  description="For this frontend demo, binary file previews last for one session. The file details are saved; its contents remain on your device."
                  action={
                    <label className="button file-label">
                      <Upload size={16} />
                      Reselect file
                      <input
                        type="file"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.name !== selected.filename) {
                            notify(`Choose the original file: ${selected.filename}`);
                            return;
                          }
                          try {
                            await registerFile(file, course.id, selected.category, selected.id);
                            notify('Preview restored for this session.');
                          } catch (err) {
                            notify((err as Error).message);
                          }
                        }}
                      />
                    </label>
                  }
                />
              )}
            </div>
            {!selected.seeded && (
              <div className="upload-session-note">
                Uploaded file · Binary previews are session-only. Demo AI cannot analyze new
                uploads.
              </div>
            )}
          </section>
          <Assistant
            key={`${user!.id}-${selected.id}`}
            material={selected}
            onSource={() => {
              setHighlight(true);
              article.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              article.current
                ?.querySelector('.document-content')
                ?.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(() => setHighlight(false), 2200);
              notify(`Source opened: ${selected.title}`);
            }}
          />
        </div>
      </div>
    );
  return (
    <div className="page course-page">
      <button className="back-link" onClick={() => navigate('/classes')}>
        <ArrowLeft size={15} />
        All classrooms
      </button>
      <div className={`course-header ${course.color}`}>
        <div className="course-header-icon">
          <CourseIcon course={course} size={34} />
        </div>
        <div className="course-header-text">
          <div className="eyebrow">
            {course.code} · {course.term}
          </div>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="course-header-meta">
            <Avatar user={instructor} small />
            <span>{instructor.name}</span>
            <span className="meta-dot" />
            <Users size={14} />
            <span>{members.length} students</span>
          </div>
        </div>
        <span className="course-header-decoration" aria-hidden="true">
          ✳
        </span>
      </div>
      <div className="course-tabs">
        <div role="tablist" aria-label="Class sections">
          {['Materials', 'Members', 'About'].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={tab === t ? 'active' : ''}
            >
              {t === 'Materials' ? (
                <FileText size={16} />
              ) : t === 'Members' ? (
                <Users size={16} />
              ) : (
                <BookOpen size={16} />
              )}{' '}
              {t}
              {t === 'Materials' && <span>{materials.length}</span>}
            </button>
          ))}
        </div>
        <button
          className="text-link"
          onClick={() => {
            navigator.clipboard
              ?.writeText(course.inviteCode)
              .then(() => notify(`Class code copied: ${course.inviteCode}`))
              .catch(() => notify(`Class code: ${course.inviteCode}`));
          }}
        >
          <Link2 size={14} />
          Class code: {course.inviteCode}
        </button>
      </div>
      {tab === 'Materials' && (
        <>
          <div className="section-heading materials-heading">
            <div>
              <h2>A little knowledge goes a long way.</h2>
              <p>Everything you need for the next step in your learning.</p>
            </div>
            {canManage && (
              <button className="button" onClick={() => setUpload(true)}>
                <Upload size={16} />
                Upload material
              </button>
            )}
          </div>
          <div className="material-filters">
            <div className="filter-chips">
              {['All materials', ...new Set(materials.map((m) => m.category))].map((c) => (
                <button
                  key={c}
                  className={category === c ? 'active' : ''}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="search-field compact">
              <Search size={15} />
              <input
                aria-label="Search materials"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search materials…"
              />
            </label>
          </div>
          <div className="materials-table">
            <div className="materials-table-head">
              <span>MATERIAL</span>
              <span>ADDED</span>
              <span>TYPE</span>
              <span />
            </div>
            {filtered.map((material) => (
              <div className="material-row" key={material.id}>
                <button
                  className="material-name"
                  onClick={() => setParams({ material: material.id })}
                >
                  <MaterialSymbol kind={material.kind} />
                  <span>
                    <strong>{material.title}</strong>
                    <small>
                      {material.filename} <span>·</span> {material.size}
                    </small>
                  </span>
                </button>
                <span className="material-date">{material.uploadedAt}</span>
                <Badge color={material.kind === 'Activity' ? 'purple' : 'sage'}>
                  {material.kind}
                </Badge>
                <div className="material-actions">
                  <button
                    className="ask-material"
                    onClick={() => setParams({ material: material.id })}
                  >
                    <Sparkles size={14} />
                    <span>Study with AI</span>
                    <ArrowUpRight size={14} />
                  </button>
                  {canManage && (
                    <button
                      className="icon-button subtle-danger"
                      aria-label={`Delete ${material.title}`}
                      onClick={() => setDeleting(material)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!filtered.length && (
              <Empty
                title="No materials here yet"
                description="Try another search or add a classroom file."
              />
            )}
          </div>
          <div className="class-insight">
            <span className="insight-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <h3>More than a place to keep your files.</h3>
              <p>
                Open any guide to ask a question, explore an idea, or turn a moment of clarity into
                a Wiki note.
              </p>
            </div>
            <ArrowUpRight size={22} />
          </div>
        </>
      )}
      {tab === 'Members' && (
        <section className="members-section">
          <div className="section-heading">
            <div>
              <h2>Learning is better together.</h2>
              <p>{members.length} students and one instructor share this classroom.</p>
            </div>
            <Badge>{course.inviteCode}</Badge>
          </div>
          <div className="member-table">
            {[instructor, ...members].map((member) => (
              <div className="member-row" key={member.id}>
                <Avatar user={member} />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </span>
                <Badge color={member.color}>
                  {member.id === instructor.id ? 'Instructor' : 'Student'}
                </Badge>
                {canManage && member.id !== instructor.id && (
                  <button
                    className="icon-button subtle-danger"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => setMemberRemove(member.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === 'About' && (
        <section className="about-course">
          <div className="card">
            <h2>A space to understand, not just remember.</h2>
            <p>{course.description}</p>
            <h3>What we will explore</h3>
            {course.topics.map((topic) => (
              <p key={topic}>
                <Check size={16} />
                {topic}
              </p>
            ))}
            <Tip>
              Use your AI study partner alongside the class material, then write what you learned in
              your own words.
            </Tip>
          </div>
          <div className="card">
            <CalendarDays size={25} />
            <h3>Next class</h3>
            <p>{course.nextSession}</p>
            <Badge>{course.term}</Badge>
            <p className="fine-print">Illustrative class schedule for this demo.</p>
          </div>
        </section>
      )}
      {upload && (
        <Dialog title="Share a little knowledge" onClose={() => setUpload(false)}>
          <p className="dialog-description">
            Add a material for everyone in this classroom. Text and Markdown open in reading view;
            PDFs open in a local page preview.
          </p>
          <label className="form-label">
            Category
            <select
              className="text-input"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
            >
              <option>Lecture notes</option>
              <option>Workshops</option>
              <option>Resources</option>
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            className="hidden-input"
            aria-label="Choose classroom file"
            onChange={chooseFile}
          />
          <button
            className="upload-dropzone"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={30} />
            <strong>{busy ? 'Adding your material…' : 'Choose a file from your device'}</strong>
            <span>PDF, Markdown, text, or another file · up to 25 MB</span>
          </button>
          {uploadError && (
            <p className="form-error" role="alert">
              {uploadError}
            </p>
          )}
          <Tip>
            Files stay in this browser. Binary previews need reselection after a reload. AI analysis
            of new files is outside this demo.
          </Tip>
        </Dialog>
      )}
      {deleting && (
        <Confirm
          title="Delete this material?"
          description={`“${deleting.title}” will be removed from this local demo classroom.`}
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            removeFile(deleting.id);
            notify('Material removed.');
          }}
        />
      )}
      {memberRemove && (
        <Dialog title="Remove student from this class?" onClose={() => setMemberRemove(null)}>
          <p className="dialog-description">
            Their personal Wiki will remain intact. They can rejoin with the class code.
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setMemberRemove(null)}>
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                setState((s) => ({
                  ...s,
                  memberships: s.memberships.filter(
                    (m) => !(m.courseId === course.id && m.userId === memberRemove),
                  ),
                }));
                setMemberRemove(null);
                notify('Student removed from this classroom.');
              }}
            >
              Remove student
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
