import React, { useEffect, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  LockKeyhole,
  Check,
  ArrowRight,
  Database,
  ShoppingBag,
  Globe2,
  X,
} from "lucide-react";

const raceSteps = [
  {
    title: "One item. Two requests.",
    body: "There is one item left in stock. Two students place an order at almost the same time.",
    stock: 1,
    orders: 0,
    a: "Ready to order",
    b: "Ready to order",
  },
  {
    title: "Request A reads the stock",
    body: "A sees stock = 1. It passes the availability check, but has not written its change yet.",
    stock: 1,
    orders: 0,
    a: "Read: stock = 1",
    b: "Ready to order",
    active: "a",
  },
  {
    title: "Request B reads the same value",
    body: "Before A finishes, B also reads stock = 1. Both requests now think the item is available.",
    stock: 1,
    orders: 0,
    a: "Read: stock = 1",
    b: "Read: stock = 1",
    active: "b",
  },
  {
    title: "A confirms its order",
    body: "A subtracts one from its copy and writes stock = 0. The first order succeeds.",
    stock: 0,
    orders: 1,
    a: "Order confirmed",
    b: "Still holds: stock = 1",
    active: "a",
  },
  {
    title: "B writes its outdated result",
    body: "B also writes 1 − 1 = 0. This overwrites A’s change without detecting that the item was already sold.",
    stock: 0,
    orders: 2,
    a: "Order confirmed",
    b: "Order confirmed",
    active: "b",
  },
  {
    title: "Two orders, one item",
    body: "Both orders succeeded even though only one item existed. The availability check and update were not protected as one operation.",
    stock: 0,
    orders: 2,
    a: "Order confirmed",
    b: "Order confirmed",
    done: true,
  },
];

const lockedSteps = [
  {
    title: "Give one request the key",
    body: "A lock allows only one request at a time to check and update the shared stock.",
    stock: 1,
    orders: 0,
    a: "Ready to order",
    b: "Ready to order",
  },
  {
    title: "A acquires the lock",
    body: "A locks the stock row. B waits until A finishes the transaction.",
    stock: 1,
    orders: 0,
    a: "Lock acquired",
    b: "Waiting for lock",
    active: "a",
  },
  {
    title: "A checks the inventory",
    body: "A reads stock = 1 while holding the lock. No other request can change this value.",
    stock: 1,
    orders: 0,
    a: "Read: stock = 1",
    b: "Waiting for lock",
    active: "a",
  },
  {
    title: "A commits the order",
    body: "A updates stock to zero and confirms one order within the protected transaction.",
    stock: 0,
    orders: 1,
    a: "Order confirmed",
    b: "Waiting for lock",
    active: "a",
  },
  {
    title: "The lock is released",
    body: "A commits its transaction. B can now acquire the lock and read the latest stock.",
    stock: 0,
    orders: 1,
    a: "Lock released",
    b: "Lock acquired",
    active: "b",
  },
  {
    title: "B sees the updated value",
    body: "B reads stock = 0. The stock check fails, so B cannot create a second order.",
    stock: 0,
    orders: 1,
    a: "Order confirmed",
    b: "Read: stock = 0",
    active: "b",
  },
  {
    title: "One item, one successful order",
    body: "The lock serializes access to the shared row. The stock stays valid, and B receives an out-of-stock result.",
    stock: 0,
    orders: 1,
    a: "Order confirmed",
    b: "Out of stock",
    done: true,
  },
];

const requestSteps = [
  {
    title: "Enter a URL",
    body: "You enter a website address. The browser needs to find its server before it can request a page.",
    a: "URL entered",
    b: "Waiting for a request",
    phase: "THE STARTING POINT",
    value: "course.example",
  },
  {
    title: "Resolve the hostname",
    body: "DNS resolves the hostname to an IP address. The browser now knows which network address to contact.",
    a: "Look up hostname",
    b: "Return IP address",
    phase: "DNS RESOLUTION",
    value: "Hostname → IP",
    active: "a",
  },
  {
    title: "Establish a connection",
    body: "For this HTTPS example, the browser establishes a network connection and a secure TLS session. Existing connections may be reused.",
    a: "Connect securely",
    b: "Connection ready",
    phase: "NETWORK CONNECTION",
    value: "TCP + TLS",
    active: "b",
  },
  {
    title: "Send the HTTP request",
    body: "The browser sends an HTTP request. The server responds with a status, headers and the HTML document.",
    a: "GET /course",
    b: "200 OK + HTML",
    phase: "HTTP EXCHANGE",
    value: "Request → response",
    active: "a",
  },
  {
    title: "Parse and load resources",
    body: "The browser parses HTML into the DOM, fetches referenced resources, and builds the CSSOM from styles. Scripts can modify the document.",
    a: "Build DOM + CSSOM",
    b: "CSS, scripts, images",
    phase: "PARSE & LOAD",
    value: "Build render tree",
    active: "b",
  },
  {
    title: "Turn the document into pixels",
    body: "Layout determines positions and sizes. Paint and compositing produce the visible page. Open the Network panel to inspect the requests yourself.",
    a: "Layout + paint",
    b: "Page displayed",
    phase: "RENDERING",
    value: "Pixels on screen",
    done: true,
  },
];

export default function LearningAnimation({ type = "race" }) {
  const [locked, setLocked] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const steps =
    type === "request" ? requestSteps : locked ? lockedSteps : raceSteps;
  const scene = steps[Math.min(step, steps.length - 1)];
  const isRequest = type === "request";

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [type, locked]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((s) => {
          if (s >= steps.length - 1) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      1800,
    );
    return () => clearInterval(timer);
  }, [playing, steps.length]);

  function play() {
    if (step >= steps.length - 1) setStep(0);
    setPlaying((p) => !p);
  }

  return (
    <div className="folio-animation">
      <div className="anim-toolbar">
        <span className="anim-kicker">
          <span /> INTERACTIVE EXPLAINER
        </span>
        <span className="anim-html">HTML</span>
      </div>
      <div className="anim-title-row">
        <h3>
          {isRequest ? "How a browser loads a page" : "The last item problem"}
        </h3>
        <p>
          {isRequest
            ? "Follow a URL from your address bar to the screen."
            : "See what happens when two requests arrive together."}
        </p>
      </div>
      {!isRequest && (
        <div className="anim-mode-row">
          <span>
            <LockKeyhole size={14} /> Protect with a lock
          </span>
          <button
            role="switch"
            aria-checked={locked}
            aria-label="Protect inventory with a lock"
            className={`anim-switch ${locked ? "is-on" : ""}`}
            onClick={() => setLocked((l) => !l)}
          >
            <span />
          </button>
        </div>
      )}
      <div
        className={`anim-stage ${locked ? "is-locked" : ""} ${scene.done ? "is-complete" : ""}`}
      >
        <div className="anim-requests">
          <div
            className={`anim-request ${scene.active === "a" ? "active" : ""}`}
          >
            <span className="anim-person person-a">
              {isRequest ? "B" : "A"}
            </span>
            <strong>{isRequest ? "Browser" : "Request A"}</strong>
            <span className="anim-request-status">{scene.a}</span>
          </div>
          <div
            className={`anim-request ${scene.active === "b" ? "active" : ""}`}
          >
            <span className="anim-person person-b">
              {isRequest ? "S" : "B"}
            </span>
            <strong>{isRequest ? "Network & server" : "Request B"}</strong>
            <span className="anim-request-status">{scene.b}</span>
          </div>
        </div>
        <div className="anim-connectors" aria-hidden="true">
          <svg viewBox="0 0 340 64" preserveAspectRatio="none">
            <path d="M77 0 V25 Q77 32 87 32 H160 Q170 32 170 42 V64" />
            <path d="M263 0 V25 Q263 32 253 32 H180 Q170 32 170 42 V64" />
            <path
              className={`anim-flow flow-a ${scene.active === "a" ? "flowing" : ""}`}
              d="M77 0 V25 Q77 32 87 32 H160 Q170 32 170 42 V64"
            />
            <path
              className={`anim-flow flow-b ${scene.active === "b" ? "flowing" : ""}`}
              d="M263 0 V25 Q263 32 253 32 H180 Q170 32 170 42 V64"
            />
          </svg>
          {locked && (
            <span className="anim-lock">
              <LockKeyhole size={14} />
            </span>
          )}
        </div>
        <div className="anim-database">
          <span className="anim-db-icon">
            {isRequest ? (
              <Globe2 size={22} strokeWidth={1.6} />
            ) : (
              <Database size={22} strokeWidth={1.6} />
            )}
          </span>
          <div>
            <span>{isRequest ? scene.phase : "SHARED INVENTORY"}</span>
            <strong className={isRequest ? "anim-phase-value" : ""}>
              {isRequest ? (
                scene.value
              ) : (
                <>
                  {scene.stock}
                  <small> item remaining</small>
                </>
              )}
            </strong>
          </div>
          {scene.done && (
            <span
              className={`anim-result-icon ${locked || isRequest ? "success" : "warning"}`}
            >
              {locked || isRequest ? <Check size={18} /> : <X size={18} />}
            </span>
          )}
        </div>
        <div className="anim-stat-line">
          {isRequest ? <Globe2 size={14} /> : <ShoppingBag size={14} />}
          <span>
            {isRequest ? (
              "URL → DNS → HTTP → DOM → pixels"
            ) : (
              <>
                <b>{scene.orders}</b> successful{" "}
                {scene.orders === 1 ? "order" : "orders"}{" "}
                <span className="anim-stat-divider">/</span> 1 item available
              </>
            )}
          </span>
        </div>
        {scene.done && !isRequest && (
          <div className={`anim-verdict ${locked ? "safe" : "unsafe"}`}>
            {locked ? <Check size={13} /> : <X size={13} />}
            {locked ? "Consistent inventory" : "Race condition: oversold by 1"}
          </div>
        )}
      </div>
      <div className="anim-step-copy" aria-live="polite">
        <div>
          <span className="anim-step-number">
            {String(step + 1).padStart(2, "0")}
          </span>
          <h4>{scene.title}</h4>
        </div>
        <p>{scene.body}</p>
      </div>
      <div
        className="anim-progress"
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        {steps.map((_, i) => (
          <button
            key={i}
            className={i <= step ? "filled" : ""}
            aria-label={`Go to step ${i + 1}`}
            onClick={() => {
              setStep(i);
              setPlaying(false);
            }}
          />
        ))}
      </div>
      <div className="anim-controls">
        <button className="anim-play" onClick={play}>
          {playing ? (
            <Pause size={15} />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          {playing
            ? "Pause"
            : step === 0
              ? "Play animation"
              : step === steps.length - 1
                ? "Play again"
                : "Continue"}
        </button>
        <button
          className="anim-control-secondary"
          onClick={() => {
            setStep((s) => Math.min(s + 1, steps.length - 1));
            setPlaying(false);
          }}
          disabled={step === steps.length - 1}
        >
          <SkipForward size={16} /> Step
        </button>
        <button
          className="anim-replay"
          aria-label="Restart animation"
          onClick={() => {
            setStep(0);
            setPlaying(false);
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      {!isRequest && (
        <div className="anim-comparison">
          <span className={locked ? "" : "selected"}>
            <span className="anim-dot peach" />
            Without lock <b>2 orders</b>
          </span>
          <ArrowRight size={13} />
          <span className={locked ? "selected" : ""}>
            <span className="anim-dot blue" />
            With lock <b>1 order</b>
          </span>
        </div>
      )}
    </div>
  );
}
