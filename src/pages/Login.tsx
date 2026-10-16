import { ArrowRight, BookOpen, Check, Compass, Network, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Logo } from '../components/UI';
import { useApp } from '../lib/store';

export function Login() {
  const { state, switchUser } = useApp();
  const navigate = useNavigate();
  const [selected, setSelected] = useState('student-1');
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo />
        <div className="login-story-content">
          <span className="overline">A PLACE FOR YOUR NEXT “AHA.”</span>
          <h1>
            Your learning.
            <br />
            More connected.
          </h1>
          <p>
            From the classroom to your own collection of ideas. A little help from AI. A lot of room
            to grow.
          </p>
          <div className="login-orbit">
            <div className="orbit-ring one" />
            <div className="orbit-ring two" />
            <div className="orbit-center">
              <Sparkles size={42} />
            </div>
            <span className="orbit-chip orbit-class">
              <BookOpen size={20} />
              Your classes
            </span>
            <span className="orbit-chip orbit-wiki">
              <Network size={20} />
              Your ideas
            </span>
            <span className="orbit-chip orbit-community">
              <Compass size={20} />
              Your community
            </span>
            <span className="orbit-dot d1" />
            <span className="orbit-dot d2" />
          </div>
        </div>
        <div className="login-story-footer">Built for the way curious minds learn.</div>
      </section>
      <section className="login-form-side">
        <div className="login-top-note">
          <span className="status-dot" />
          INTERACTIVE FRONTEND PROTOTYPE
        </div>
        <div className="login-form">
          <Badge>WELCOME TO LUMA</Badge>
          <h2>A good place to begin.</h2>
          <p>Choose a demo identity and step into your learning space.</p>
          <div className="login-identities">
            {state.users.map((u) => (
              <button
                key={u.id}
                className={selected === u.id ? 'selected' : ''}
                onClick={() => setSelected(u.id)}
              >
                <Avatar user={u} />
                <span>
                  <strong>{u.name}</strong>
                  <small>
                    {u.role === 'student'
                      ? 'Student'
                      : u.role === 'instructor'
                        ? 'Instructor'
                        : 'Administrator'}
                    {u.id === 'student-1' ? ' · Recommended first visit' : ''}
                  </small>
                </span>
                <span className="radio-dot">{selected === u.id && <Check size={12} />}</span>
              </button>
            ))}
          </div>
          <button
            className="button google-signin"
            onClick={() => {
              switchUser(selected);
              navigate('/classes');
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.8 12.2c0-.7-.1-1.4-.2-2.2H12v4.2h5.5a4.8 4.8 0 0 1-2 3.1v2.6h3.4c2-1.8 2.9-4.4 2.9-7.7Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-.9 6.8-2.5l-3.4-2.6c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H2.9v2.7A10.2 10.2 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.4 13.8a6 6 0 0 1 0-3.7V7.4H2.9a10 10 0 0 0 0 9.1l3.5-2.7Z"
              />
              <path
                fill="#EA4335"
                d="M12 6.1c1.5 0 2.8.5 3.8 1.5l3-3A9.8 9.8 0 0 0 12 2a10.2 10.2 0 0 0-9.1 5.5l3.5 2.7A6 6 0 0 1 12 6.1Z"
              />
            </svg>
            Continue with Google <span className="demo-label">Demo</span>
            <ArrowRight size={17} />
          </button>
          <p className="login-disclaimer">
            Demo sign-in only. No Google account is connected.
            <br />
            Your sample workspace is saved in this browser.
          </p>
        </div>
        <div className="login-footer">Learn something. Connect the dots. Pass it on.</div>
      </section>
    </div>
  );
}
