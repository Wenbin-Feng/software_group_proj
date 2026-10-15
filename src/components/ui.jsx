import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      [
        ...ref.current.querySelectorAll(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        ),
      ].filter((el) => !el.disabled && el.offsetParent !== null);
    const first =
      focusables().find((el) => el.tagName === "INPUT") || focusables()[0];
    first?.focus();
    function onKey(event) {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const list = focusables();
      if (!list.length) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === list[0]) {
        event.preventDefault();
        list.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === list.at(-1)) {
        event.preventDefault();
        list[0].focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`modal-panel ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        ref={ref}
      >
        <header className="modal-heading">
          <div>
            <h2 id="modal-heading">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

export function Avatar({ initials, color = "#e3eaff", size = 36, name }) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : null;
  const dark =
    hex &&
    parseInt(hex.slice(0, 2), 16) * 0.299 +
      parseInt(hex.slice(2, 4), 16) * 0.587 +
      parseInt(hex.slice(4, 6), 16) * 0.114 <
      155;
  return (
    <span
      className="avatar"
      aria-label={name}
      style={{
        background: color,
        color: dark ? "#ffffff" : "#42536e",
        width: size,
        height: size,
      }}
    >
      {initials ||
        name
          ?.split(" ")
          .map((x) => x[0])
          .join("")
          .slice(0, 2)}
    </span>
  );
}
