import {
  ArrowRight,
  Check,
  Lightbulb,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from './UI';

const phases = ['Requirements', 'Design', 'Build', 'Test', 'Release'];
const captions = [
  'Begin with a shared understanding of the problem and the people you are building for.',
  'Waterfall advances to design. An Agile team is already designing a small first increment.',
  'Implementation begins. Agile keeps the scope small enough to test with people soon.',
  'Both approaches need testing. Agile connects testing to every small delivery.',
  'Waterfall reaches its planned release. Agile reviews feedback and starts the next increment.',
  'Feedback changes what the team knows. Agile uses the next cycle to adapt its plan.',
  'A new increment builds on the last. The team revisits its assumptions instead of just repeating tasks.',
  'More feedback, a better fit. The value of iteration is what you learn, not the number of loops.',
  'The next release delivers another useful improvement. Good engineering still matters at every step.',
  'Two ways to organize the work. Choose deliberately for your uncertainty, users, and constraints.',
];
export function LifecycleAnimation({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((s) => {
          if (s >= 9) {
            setPlaying(false);
            return 9;
          }
          return s + 1;
        }),
      1600,
    );
    return () => clearInterval(timer);
  }, [playing]);
  return (
    <Dialog title="One goal. Two ways to get there." onClose={onClose} wide>
      <div className="animation-intro">
        <span className="eyebrow">
          <span className="status-dot" />
          INTERACTIVE EXPLAINER
        </span>
        <p>See how Waterfall and Agile organize a software project.</p>
      </div>
      <div className="animation-stage" data-step={step}>
        <div className="animation-model">
          <div className="model-heading">
            <span className="model-number">01</span>
            <div>
              <h3>Waterfall</h3>
              <p>One phase leads to the next.</p>
            </div>
            <span className="badge blue">Sequential</span>
          </div>
          <div className="waterfall-track">
            {phases.map((phase, i) => (
              <div
                className={`waterfall-phase ${Math.min(step, 4) >= i ? 'phase-active' : ''} ${Math.min(step, 4) > i ? 'phase-done' : ''}`}
                key={phase}
                style={{ marginLeft: `${i * 10}%` }}
              >
                <span>
                  {Math.min(step, 4) > i ? <Check size={14} /> : String(i + 1).padStart(2, '0')}
                </span>
                {phase}
                {i < 4 && <span className="phase-connector" />}
              </div>
            ))}
          </div>
        </div>
        <div className="animation-model agile-model">
          <div className="model-heading">
            <span className="model-number">02</span>
            <div>
              <h3>Agile</h3>
              <p>A small delivery. A chance to learn.</p>
            </div>
            <span className="badge sage">Iterative</span>
          </div>
          <div className="agile-cycle">
            <div className="agile-cycle-ring" />
            <div className="cycle-center">
              <RefreshCw size={25} className={playing ? 'spinning' : ''} />
              <strong>Iteration {Math.floor(step / 5) + 1}</strong>
              <span>Build · learn · adapt</span>
            </div>
            {phases.map((phase, i) => (
              <div
                key={phase}
                className={`cycle-node cycle-${i} ${step % 5 >= i ? 'node-active' : ''}`}
              >
                <span>{step % 5 > i ? <Check size={13} /> : i + 1}</span>
                {phase}
              </div>
            ))}
          </div>
          <div className="increment-line">
            <span className={step >= 4 ? 'increment done' : 'increment'}>
              <Check size={13} />
              Increment 1
            </span>
            <ArrowRight size={15} />
            <span className={step >= 9 ? 'increment done' : 'increment'}>
              <Check size={13} />
              Increment 2
            </span>
          </div>
        </div>
      </div>
      <div className="animation-caption" aria-live="polite">
        <Lightbulb size={20} />
        <p>{captions[step]}</p>
        <span>{String(step + 1).padStart(2, '0')} / 10</span>
      </div>
      <div className="animation-controls">
        <div>
          <button
            className="button"
            onClick={() => {
              if (step === 9) setStep(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}{' '}
            {playing ? 'Pause' : 'Play animation'}
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.min(9, s + 1));
            }}
            disabled={step === 9}
          >
            <SkipForward size={16} />
            Next step
          </button>
          <button
            className="icon-button"
            aria-label="Reset animation"
            onClick={() => {
              setPlaying(false);
              setStep(0);
            }}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <span>Prepared HTML animation · Demo</span>
      </div>
    </Dialog>
  );
}
