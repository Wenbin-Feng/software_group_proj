import { useEffect, useRef } from "react";

// Decorative knowledge graph behind the sign-in page: materials, questions
// and notes drift and link up, and the pointer gently pushes them aside.
const COLORS = ["49,86,211", "126,104,214", "77,150,124"];
const LABELS = [
  "Race conditions",
  "Atomic update",
  "Week 04 · p.3",
  "Isolation levels",
  "Commit vs push",
  "Sequence diagram",
];

export default function AuthBackdrop() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return undefined;
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pointer = { x: -9999, y: -9999 };
    let nodes = [];
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(64, (width * height) / 22000));
      nodes = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: index < LABELS.length ? 4 : 1.6 + Math.random() * 2,
        color: COLORS[index % COLORS.length],
        label: width > 900 ? LABELS[index] : undefined,
      }));
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const reach = Math.min(170, width / 6);
      for (const node of nodes) {
        if (!still) {
          node.x += node.vx;
          node.y += node.vy;
        }
        if (node.x < -20 || node.x > width + 20) node.vx *= -1;
        if (node.y < -20 || node.y > height + 20) node.vy *= -1;
        const dx = node.x - pointer.x;
        const dy = node.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 130 && distance > 0) {
          node.x += (dx / distance) * 0.9;
          node.y += (dy / distance) * 0.9;
        }
      }
      context.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > reach) continue;
          context.strokeStyle = `rgba(${a.color},${0.16 * (1 - distance / reach)})`;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
        const node = nodes[i];
        const near = Math.hypot(node.x - pointer.x, node.y - pointer.y);
        if (near < 190) {
          context.strokeStyle = `rgba(49,86,211,${0.22 * (1 - near / 190)})`;
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }
      }
      context.font = "500 12px Inter, sans-serif";
      for (const node of nodes) {
        if (node.label) {
          context.fillStyle = `rgba(${node.color},0.12)`;
          context.beginPath();
          context.arc(node.x, node.y, node.r * 2.8, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = `rgba(${node.color},${node.label ? 0.8 : 0.42})`;
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fill();
        if (node.label) {
          context.fillStyle = "rgba(32,45,68,0.5)";
          context.fillText(node.label, node.x + 12, node.y + 4);
        }
      }
      if (!still && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const move = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const leave = () => {
      pointer.x = pointer.y = -9999;
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) draw();
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <span className="auth-aurora one" />
      <span className="auth-aurora two" />
      <span className="auth-aurora three" />
      <span className="auth-grid" />
      <canvas ref={canvasRef} />
      <span className="auth-veil" />
    </div>
  );
}
