import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Focus,
  Minus,
  Network,
  Plus,
} from "lucide-react";
import { buildWikiGraph } from "../lib/wikiLinks";
import "./wiki-graph.css";

const WIDTH = 920;
const HEIGHT = 600;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function positionGraph(graph) {
  const size = graph.nodes.length;
  const degree = new Map(graph.nodes.map((note) => [note.id, 0]));
  graph.edges.forEach(({ source, target }) => {
    degree.set(source, (degree.get(source) || 0) + 1);
    degree.set(target, (degree.get(target) || 0) + 1);
  });
  const nodes = graph.nodes.map((note, index) => {
    const angle = (index / Math.max(size, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      ...note,
      x:
        size === 1
          ? WIDTH / 2
          : WIDTH / 2 + Math.cos(angle) * Math.min(245, 70 + size * 17),
      y:
        size === 1
          ? HEIGHT / 2
          : HEIGHT / 2 + Math.sin(angle) * Math.min(190, 60 + size * 12),
      degree: degree.get(note.id),
    };
  });
  const byId = new Map(nodes.map((note) => [note.id, note]));
  for (let iteration = 0; iteration < 180; iteration++) {
    const motion = new Map(nodes.map((note) => [note.id, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j];
        const dx = a.x - b.x || 0.1,
          dy = a.y - b.y || 0.1;
        const distance = Math.max(25, Math.hypot(dx, dy));
        const force = Math.min(12, 14000 / (distance * distance));
        motion.get(a.id).x += (dx / distance) * force;
        motion.get(a.id).y += (dy / distance) * force;
        motion.get(b.id).x -= (dx / distance) * force;
        motion.get(b.id).y -= (dy / distance) * force;
      }
    }
    for (const edge of graph.edges) {
      const a = byId.get(edge.source),
        b = byId.get(edge.target);
      if (!a || !b || a === b) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - 180) * 0.018;
      motion.get(a.id).x += (dx / distance) * force;
      motion.get(a.id).y += (dy / distance) * force;
      motion.get(b.id).x -= (dx / distance) * force;
      motion.get(b.id).y -= (dy / distance) * force;
    }
    const cooling = 1 - iteration / 200;
    nodes.forEach((node) => {
      const shift = motion.get(node.id);
      node.x = clamp(
        node.x + (shift.x + (WIDTH / 2 - node.x) * 0.004) * cooling,
        145,
        WIDTH - 145,
      );
      node.y = clamp(
        node.y + (shift.y + (HEIGHT / 2 - node.y) * 0.004) * cooling,
        80,
        HEIGHT - 100,
      );
    });
  }
  return { nodes, byId };
}

function labelLines(title, max) {
  const words = String(title || "Untitled")
    .split(" ")
    .flatMap((word) => {
      const characters = Array.from(word);
      if (characters.length <= max) return [word];
      const chunks = [];
      for (let i = 0; i < characters.length; i += max)
        chunks.push(characters.slice(i, i + max).join(""));
      return chunks;
    });
  const lines = [""];
  for (const word of words) {
    const last = lines.length - 1;
    if (lines[last] && `${lines[last]} ${word}`.length > max) lines.push(word);
    else lines[last] += `${lines[last] ? " " : ""}${word}`;
  }
  return lines
    .slice(0, 2)
    .map((line, index) =>
      index === 1 && lines.length > 2 ? `${line.slice(0, max - 1)}…` : line,
    );
}

function fitGraph(layout, width, height, compact) {
  if (!layout.nodes.length) return { nodes: [], byId: new Map() };
  const minX = Math.min(...layout.nodes.map((node) => node.x));
  const maxX = Math.max(...layout.nodes.map((node) => node.x));
  const minY = Math.min(...layout.nodes.map((node) => node.y));
  const maxY = Math.max(...layout.nodes.map((node) => node.y));
  const narrow = !compact && width < 500;
  const fontSize = compact ? 10.5 : narrow ? 11.5 : 12.5;
  const maxCharacters = compact ? (width < 240 ? 16 : 19) : narrow ? 18 : 32;
  const marginX = Math.min(
    width * (narrow ? 0.2 : 0.3),
    compact ? 62 : narrow ? 60 : 116,
  );
  const marginTop = compact ? 27 : 55;
  const marginBottom = compact ? 63 : 80;
  const scale = Math.min(
    Math.max(1, width - marginX * 2) / Math.max(1, maxX - minX),
    Math.max(1, height - marginTop - marginBottom) / Math.max(1, maxY - minY),
  );
  // A tall phone canvas has room to separate labels vertically.
  const verticalScale = narrow
    ? Math.max(1, height - marginTop - marginBottom) / Math.max(1, maxY - minY)
    : scale;
  const middleX = (minX + maxX) / 2;
  const middleY = (minY + maxY) / 2;
  const centerY = marginTop + (height - marginTop - marginBottom) / 2;
  const nodes = layout.nodes.map((node) => ({
    ...node,
    x: width / 2 + (node.x - middleX) * scale,
    y: centerY + (node.y - middleY) * verticalScale,
    radius: compact
      ? clamp(4 + node.degree * 0.35, 4, 6)
      : clamp(5.5 + node.degree, 6, 11),
    lines: labelLines(node.title, maxCharacters),
    fontSize,
  }));
  const placed = [];
  const overlap = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  // Keep labels in canvas coordinates so their font never shrinks with the layout.
  nodes.forEach((node) => {
    const lineHeight = fontSize * 1.35;
    const labelWidth =
      Math.max(...node.lines.map((line) => Array.from(line).length)) *
      fontSize *
      0.57;
    const labelHeight = fontSize + (node.lines.length - 1) * lineHeight;
    const candidates = [
      { x: node.x, y: node.y + node.radius + fontSize + 7 },
      {
        x: node.x,
        y: node.y - node.radius - 8 - (node.lines.length - 1) * lineHeight,
      },
      { x: node.x + labelWidth / 2 + 14, y: node.y + fontSize / 3 },
      { x: node.x - labelWidth / 2 - 14, y: node.y + fontSize / 3 },
    ].map((candidate, index) => {
      const x = clamp(
        candidate.x,
        labelWidth / 2 + 8,
        width - labelWidth / 2 - 8,
      );
      const y = clamp(
        candidate.y,
        fontSize + 8,
        height - (node.lines.length - 1) * lineHeight - 12,
      );
      const box = {
        left: x - labelWidth / 2 - 3,
        right: x + labelWidth / 2 + 3,
        top: y - fontSize - 2,
        bottom: y - fontSize + labelHeight + 3,
      };
      const collisions =
        placed.reduce((sum, prior) => sum + overlap(box, prior), 0) +
        nodes.reduce(
          (sum, other) =>
            other.id === node.id
              ? sum
              : sum +
                overlap(box, {
                  left: other.x - 9,
                  right: other.x + 9,
                  top: other.y - 9,
                  bottom: other.y + 9,
                }),
          0,
        );
      return {
        x,
        y,
        box,
        score:
          collisions * 100 +
          index * 3 +
          Math.abs(x - candidate.x) +
          Math.abs(y - candidate.y),
      };
    });
    const chosen = candidates.sort((a, b) => a.score - b.score)[0];
    node.labelX = chosen.x;
    node.labelY = chosen.y;
    placed.push(chosen.box);
  });
  return { nodes, byId: new Map(nodes.map((node) => [node.id, node])) };
}

export default function WikiGraph({
  notes = [],
  activeId,
  onSelect,
  compact = false,
}) {
  const graph = useMemo(() => buildWikiGraph(notes), [notes]);
  const rawLayout = useMemo(() => positionGraph(graph), [graph]);
  const [viewport, setViewport] = useState({
    width: compact ? 250 : WIDTH,
    height: compact ? 216 : HEIGHT,
  });
  const layout = useMemo(
    () => fitGraph(rawLayout, viewport.width, viewport.height, compact),
    [rawLayout, viewport, compact],
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const svg = useRef(null);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0)
        setViewport((previous) =>
          Math.abs(previous.width - width) < 1 &&
          Math.abs(previous.height - height) < 1
            ? previous
            : { width, height },
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);
  const uid = useId().replace(/:/g, "");
  const focusId = hovered || activeId;
  const neighbours = useMemo(() => {
    const result = new Set([focusId]);
    graph.edges.forEach((edge) => {
      if (edge.source === focusId) result.add(edge.target);
      if (edge.target === focusId) result.add(edge.source);
    });
    return result;
  }, [graph, focusId]);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const select = (id) => {
    if (!suppressClick.current) onSelect?.(id);
  };

  return (
    <section
      className={`vault-graph ${compact ? "is-compact" : ""}`}
      aria-label={compact ? "Local knowledge graph" : "Knowledge graph"}
    >
      {!compact && (
        <div className="vault-graph-heading">
          <div>
            <span className="vault-graph-heading-icon">
              <Network size={19} />
            </span>
            <div>
              <h2>Graph view</h2>
              <p>
                {notes.length} notes · {graph.edges.length}{" "}
                {graph.edges.length === 1 ? "connection" : "connections"}
              </p>
            </div>
          </div>
          <span className="vault-graph-legend">
            <i /> Selected note <i /> Linked note
          </span>
        </div>
      )}
      <div className="vault-graph-canvas">
        <svg
          ref={svg}
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          role="group"
          aria-label={`${notes.length} notes linked by ${graph.edges.length} directed connections. Select a note to open it.`}
          onPointerDown={(event) => {
            if (event.button !== 0 || event.target.closest("[data-graph-node]"))
              return;
            drag.current = { x: event.clientX, y: event.clientY, pan };
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || !svg.current) return;
            const bounds = svg.current.getBoundingClientRect();
            const dx = event.clientX - drag.current.x,
              dy = event.clientY - drag.current.y;
            if (Math.hypot(dx, dy) > 3) suppressClick.current = true;
            setPan({
              x: drag.current.pan.x + (dx * viewport.width) / bounds.width,
              y: drag.current.pan.y + (dy * viewport.height) / bounds.height,
            });
          }}
          onPointerUp={() => {
            drag.current = null;
            setTimeout(() => {
              suppressClick.current = false;
            }, 0);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <defs>
            <pattern
              id={`graph-dots-${uid}`}
              width={compact ? 14 : 27}
              height={compact ? 14 : 27}
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.75" fill="currentColor" />
            </pattern>
            <marker
              id={`graph-arrow-${uid}`}
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path
                d="M 0 1 L 8 5 L 0 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </marker>
          </defs>
          <rect
            width={viewport.width}
            height={viewport.height}
            fill={`url(#graph-dots-${uid})`}
            className="vault-graph-dots"
          />
          <g
            transform={`translate(${viewport.width / 2 + pan.x},${viewport.height / 2 + pan.y}) scale(${zoom}) translate(${-viewport.width / 2},${-viewport.height / 2})`}
          >
            {graph.edges.map((edge) => {
              const from = layout.byId.get(edge.source),
                to = layout.byId.get(edge.target);
              const related =
                edge.source === focusId || edge.target === focusId;
              const loopWidth = compact ? 22 : 42,
                loopHeight = compact ? 32 : 60;
              return from && to ? (
                <path
                  key={`${edge.source}-${edge.target}`}
                  className={`vault-graph-edge ${related ? "is-related" : ""}`}
                  d={
                    from === to
                      ? `M ${from.x - 5} ${from.y - 6} C ${from.x - loopWidth} ${from.y - loopHeight}, ${from.x + loopWidth} ${from.y - loopHeight}, ${from.x + 5} ${from.y - 6}`
                      : `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                  }
                  markerEnd={`url(#graph-arrow-${uid})`}
                />
              ) : null;
            })}
            {layout.nodes.map((node) => {
              const selected = node.id === activeId;
              const related = neighbours.has(node.id);
              const radius = selected ? (compact ? 6.5 : 10) : node.radius;
              return (
                <g
                  key={node.id}
                  data-graph-node="true"
                  className={`vault-graph-node ${selected ? "is-active" : ""} ${related ? "is-related" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${node.title}, ${node.degree} ${node.degree === 1 ? "link" : "links"}`}
                  aria-pressed={selected}
                  onClick={() => select(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(node.id);
                    }
                  }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(node.id)}
                  onBlur={() => setHovered(null)}
                >
                  <title>{node.title}</title>
                  <circle
                    className="vault-graph-hit"
                    cx={node.x}
                    cy={node.y}
                    r={24}
                  />
                  <circle
                    className="vault-graph-halo"
                    cx={node.x}
                    cy={node.y}
                    r={radius + (compact ? 5 : 8)}
                  />
                  <circle
                    className="vault-graph-dot"
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                  />
                  <text
                    x={node.labelX}
                    y={node.labelY}
                    textAnchor="middle"
                    style={{ fontSize: node.fontSize }}
                  >
                    {node.lines.map((line, index) => (
                      <tspan
                        x={node.labelX}
                        dy={index ? "1.35em" : 0}
                        key={index}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {!notes.length && (
          <div className="vault-graph-empty">
            <Network size={32} />
            <strong>Your graph starts here</strong>
            <span>Create a note and connect it with [[wiki links]].</span>
          </div>
        )}
        {!compact && (
          <div className="vault-graph-hint">
            Click a note to open · Drag to move the graph
          </div>
        )}
        <div className="vault-graph-controls" aria-label="Graph controls">
          <button
            type="button"
            aria-label="Zoom in graph"
            disabled={zoom >= 2}
            onClick={() =>
              setZoom((value) => Math.min(2, +(value + 0.2).toFixed(1)))
            }
          >
            <Plus size={16} />
          </button>
          {!compact && (
            <output aria-label="Graph zoom">{Math.round(zoom * 100)}%</output>
          )}
          <button
            type="button"
            aria-label="Zoom out graph"
            disabled={zoom <= 0.6}
            onClick={() =>
              setZoom((value) => Math.max(0.6, +(value - 0.2).toFixed(1)))
            }
          >
            <Minus size={16} />
          </button>
          <button type="button" aria-label="Reset graph view" onClick={reset}>
            <Focus size={16} />
          </button>
        </div>
      </div>
      <div className="vault-graph-list">
        <button
          type="button"
          className="vault-graph-list-toggle"
          aria-expanded={listOpen}
          aria-controls={`graph-list-${uid}`}
          onClick={() => setListOpen(!listOpen)}
        >
          <FileText size={13} /> Browse {notes.length} notes{" "}
          <ChevronDown size={14} className={listOpen ? "is-open" : ""} />
        </button>
        {listOpen && (
          <div id={`graph-list-${uid}`} className="vault-graph-note-list">
            {layout.nodes.map((node) => (
              <button
                type="button"
                className={node.id === activeId ? "is-active" : ""}
                key={node.id}
                onClick={() => onSelect?.(node.id)}
              >
                <span>{node.title}</span>
                <small>
                  {node.degree} {node.degree === 1 ? "link" : "links"}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
