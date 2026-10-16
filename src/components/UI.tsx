import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  FileText,
  Layers,
  Shapes,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Course, User } from '../lib/domain';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'small' : ''}`}>
      <span className="logo-mark">
        <span />
        <i />
      </span>
      <span>
        luma<span className="logo-dot">.</span>
      </span>
    </div>
  );
}
export function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  return (
    <span className={`avatar ${user.color} ${small ? 'avatar-sm' : ''}`} title={user.name}>
      {user.initials}
    </span>
  );
}
export function CourseIcon({ course, size = 24 }: { course: Course; size?: number }) {
  const Icon = course.icon === 'sparkles' ? Sparkles : course.icon === 'shapes' ? Shapes : Layers;
  return <Icon size={size} strokeWidth={1.6} />;
}
export function Badge({ children, color = 'sage' }: { children: ReactNode; color?: string }) {
  return <span className={`badge ${color}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,textarea,button,select,[tabindex="0"]')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,textarea,select,a[href],[tabindex="0"]',
          ) || [],
        );
        if (!items.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        }
        if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog ${wide ? 'dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
  danger = false,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="dialog-description">{description}</p>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`button ${danger ? 'danger' : ''}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {danger ? 'Delete' : 'Reset demo data'}
        </button>
      </div>
    </Dialog>
  );
}
export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="tip">
      <CircleHelp size={16} />
      <span>{children}</span>
    </div>
  );
}
export function MaterialSymbol({ kind }: { kind: string }) {
  return (
    <span
      className={`material-symbol ${kind === 'Activity' ? 'purple' : kind === 'PDF' ? 'peach' : 'sage'}`}
    >
      <FileText size={21} />
    </span>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function SaveStatus() {
  return (
    <span className="saved-status">
      <Check size={13} /> Saved locally
    </span>
  );
}
