import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import "./task-progress.css";

// Server progress arrives in jumps while a model call runs, so the bar eases toward the
// next stretch instead of freezing. It never reports done until the task really is.
export default function TaskProgress({ title, steps, percent = 0, note }) {
  const [shown, setShown] = useState(percent);
  useEffect(() => {
    setShown((value) => Math.max(value, percent));
  }, [percent]);
  useEffect(() => {
    const timer = setInterval(() => {
      setShown((value) => {
        const cap = Math.min(92, percent + 45);
        return value >= cap ? value : value + Math.max(0.15, (cap - value) * 0.04);
      });
    }, 300);
    return () => clearInterval(timer);
  }, [percent]);
  const activeIndex = steps.reduce(
    (found, step, index) => (percent >= step.at ? index : found),
    0,
  );
  return (
    <div
      className="task-progress"
      role="progressbar"
      aria-label={title}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown)}
    >
      <div className="task-progress-head">
        <strong>{title}</strong>
        <span>{Math.round(shown)}%</span>
      </div>
      <div className="task-progress-bar">
        <i style={{ width: `${shown}%` }} />
      </div>
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={
              index < activeIndex ? "done" : index === activeIndex ? "active" : ""
            }
          >
            <span className="task-progress-mark">
              {index < activeIndex ? <Check size={11} /> : <b />}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      {note && <p>{note}</p>}
    </div>
  );
}
