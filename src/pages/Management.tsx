import { ArrowUpRight, BookOpen, FileText, Search, ShieldCheck, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, CourseIcon, Empty, PageHeading, Tip } from '../components/UI';
import type { Role } from '../lib/domain';
import { useApp } from '../lib/store';

export function Management() {
  const { state, user, setState, notify } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  if (user!.role === 'student')
    return (
      <div className="page">
        <Empty
          title="A space for your instructors"
          description="Switch to an instructor or administrator demo identity to explore classroom management."
        />
      </div>
    );
  const admin = user!.role === 'admin';
  return (
    <div className="page management-page">
      <PageHeading
        eyebrow={admin ? 'A THOUGHTFULLY MANAGED WORKSPACE' : 'MAKE ROOM FOR GOOD LEARNING'}
        title={admin ? 'The people behind the ideas.' : 'Your classes. Their next discovery.'}
        description={
          admin
            ? 'Explore demo accounts and their roles in the learning community.'
            : 'Keep your learning materials organized and your students connected.'
        }
        action={
          <Badge color="sage">
            <ShieldCheck size={13} />
            {admin ? 'Administrator' : 'Instructor'} workspace
          </Badge>
        }
      />
      <div className="management-stats">
        <div className="card">
          <span className="stat-icon sage">
            <Users size={22} />
          </span>
          <strong>{state.users.filter((u) => u.role === 'student').length}</strong>
          <span>Student accounts</span>
        </div>
        <div className="card">
          <span className="stat-icon purple">
            <BookOpen size={22} />
          </span>
          <strong>{state.courses.length}</strong>
          <span>Shared classrooms</span>
        </div>
        <div className="card">
          <span className="stat-icon blue">
            <FileText size={22} />
          </span>
          <strong>{state.materials.length}</strong>
          <span>Learning materials</span>
        </div>
      </div>
      {admin ? (
        <section className="card people-card">
          <div className="section-heading">
            <div>
              <h2>Every learner has a place.</h2>
              <p>Manage roles for the local demo accounts.</p>
            </div>
            <label className="search-field compact">
              <Search size={16} />
              <input
                aria-label="Search people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a person…"
              />
            </label>
          </div>
          <div className="people-table-head">
            <span>PERSON</span>
            <span>ROLE</span>
            <span>WORKSPACE</span>
          </div>
          {state.users
            .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()))
            .map((u) => (
              <div className="people-row" key={u.id}>
                <div>
                  <Avatar user={u} />
                  <span>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </span>
                </div>
                <select
                  aria-label={`Role for ${u.name}`}
                  value={u.role}
                  disabled={u.id === user!.id}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    setState((s) => ({
                      ...s,
                      users: s.users.map((person) =>
                        person.id === u.id ? { ...person, role } : person,
                      ),
                    }));
                    notify(`${u.name} is now a demo ${role}.`);
                  }}
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </select>
                <span className="account-status">
                  <span className="status-dot" />
                  Demo account
                </span>
              </div>
            ))}
          <Tip>
            Your own administrator role is protected from accidental changes. Role controls
            demonstrate product behavior; they are not backend access controls.
          </Tip>
        </section>
      ) : (
        <section>
          <div className="section-heading">
            <div>
              <h2>A classroom is a starting point.</h2>
              <p>Add a resource, welcome a student, and help a new idea take shape.</p>
            </div>
          </div>
          <div className="instructor-course-list">
            {state.courses
              .filter((c) => c.instructorId === user!.id)
              .map((course) => (
                <div className="instructor-course card" key={course.id}>
                  <span className={`instructor-course-symbol ${course.color}`}>
                    <CourseIcon course={course} size={27} />
                  </span>
                  <div>
                    <span className="eyebrow">{course.code.split('  ')[0]}</span>
                    <h3>{course.title}</h3>
                    <p>
                      {state.materials.filter((m) => m.courseId === course.id).length} materials{' '}
                      <span>·</span>
                      {
                        state.memberships.filter((m) => m.courseId === course.id).length
                      } students <span>·</span>Code: {course.inviteCode}
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => navigate(`/classes/${course.id}`)}
                  >
                    <Upload size={15} />
                    Manage class <ArrowUpRight size={15} />
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
      <div className="management-footnote">
        <ShieldCheck size={20} />
        <p>
          <strong>A transparent prototype.</strong> Accounts, memberships, uploads, and role changes
          are local to this browser. No email invitations are sent and no real Google accounts are
          connected.
        </p>
      </div>
    </div>
  );
}
