import { useEffect, useRef, useState } from "react";
import "./slide-frame.css";

// SlideMaker previews are fixed 1280×720 slides. The sandboxed frame cannot run
// scripts, so the page measures the space and scales the whole frame instead.
const SLIDE_W = 1280,
  SLIDE_H = 720,
  GAP = 28,
  FRAME_W = SLIDE_W + GAP * 2;

export const isSlidemakerHtml = (html) =>
  /<meta name="generator" content="slidemaker">/.test(html || "");

export default function SlideFrame({ html, title }) {
  const box = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = box.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const count = Math.max(1, (html.match(/<section class="slide"/g) || []).length);
  const height = GAP + count * (SLIDE_H + GAP);
  const scale = width ? width / FRAME_W : 0;
  return (
    <div
      ref={box}
      className="slide-frame"
      style={{ height: scale ? height * scale : undefined }}
    >
      {scale > 0 && (
        <iframe
          title={title}
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{
            width: FRAME_W,
            height,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}
