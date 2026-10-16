import { ArrowUpRight, Circle, Network } from 'lucide-react';
import { useMemo } from 'react';
import { wikiLinks, type Note } from '../lib/domain';
import { Empty } from './UI';

export function KnowledgeGraph({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  const graph = useMemo(() => {
    const visible = notes.slice(0, 18);
    const nodes = visible.map((note, i) => {
      if (i === 0) return { note, x: 335, y: 205 };
      const angle = ((i - 1) / Math.max(1, visible.length - 1)) * Math.PI * 2 - Math.PI / 2;
      return { note, x: 335 + Math.cos(angle) * 235, y: 205 + Math.sin(angle) * 140 };
    });
    const edges = nodes.flatMap((n) =>
      wikiLinks(n.note.content).flatMap((title) => {
        const target = nodes.find((t) => t.note.title.toLowerCase() === title.toLowerCase());
        return target ? [{ from: n, to: target }] : [];
      }),
    );
    return { nodes, edges };
  }, [notes]);
  if (!notes.length)
    return (
      <Empty
        title="Every connection begins with a note"
        description="Create a few notes and link them with [[Note Title]] to grow your graph."
      />
    );
  return (
    <div className="knowledge-graph">
      <div className="graph-intro">
        <span className="graph-icon">
          <Network size={25} />
        </span>
        <div>
          <h2>See the bigger picture.</h2>
          <p>Every line is a connection you made. Follow one and see where it leads.</p>
        </div>
        <span className="badge sage">
          {graph.nodes.length} ideas · {graph.edges.length} links
        </span>
      </div>
      <div className="graph-canvas">
        <svg
          viewBox="0 0 670 420"
          role="img"
          aria-label="Knowledge graph derived from your note links"
        >
          <defs>
            <pattern id="graph-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#dce5df" />
            </pattern>
            <radialGradient id="node-glow">
              <stop stopColor="#d3e7da" />
              <stop offset="1" stopColor="#f4f8f3" />
            </radialGradient>
          </defs>
          <rect width="670" height="420" fill="url(#graph-dots)" />
          {graph.edges.map((edge, i) => (
            <line
              key={i}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="#bfd3c5"
              strokeWidth="1.5"
            />
          ))}
          {graph.nodes.map(({ note, x, y }, i) => {
            const words = note.title.split(' ');
            const halfway = Math.ceil(words.length / 2);
            const lines =
              note.title.length > 22
                ? [words.slice(0, halfway).join(' '), words.slice(halfway).join(' ')]
                : [note.title];
            return (
              <g
                className="graph-node"
                key={note.id}
                role="button"
                tabIndex={0}
                aria-label={`Open note: ${note.title}`}
                onClick={() => onOpen(note.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(note.id);
                  }
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={i === 0 ? 43 : 25}
                  fill={
                    i === 0
                      ? 'url(#node-glow)'
                      : i % 3 === 0
                        ? '#eee8f5'
                        : i % 3 === 1
                          ? '#e0ece3'
                          : '#f7e9dd'
                  }
                  stroke={i === 0 ? '#719e83' : '#c8d8cb'}
                  strokeWidth="1.5"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={i === 0 ? 10 : 6}
                  fill={
                    i === 0
                      ? '#39775e'
                      : i % 3 === 0
                        ? '#9a80b2'
                        : i % 3 === 1
                          ? '#719e83'
                          : '#c69770'
                  }
                />
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={x}
                    y={y + (i === 0 ? 64 : 46) + li * 15}
                    textAnchor="middle"
                    fill="#405348"
                    fontSize={i === 0 ? 13 : 11.5}
                    fontWeight={i === 0 ? 600 : 450}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
        <div className="graph-canvas-label">YOUR KNOWLEDGE, CONNECTED</div>
      </div>
      <div className="graph-footer">
        <span>
          <Circle size={10} fill="#719e83" strokeWidth={0} />
          Personal notes
        </span>
        <span>Click a node to follow an idea.</span>
        {notes.length > 18 && <span>Showing first 18 notes</span>}
      </div>
      <div className="graph-note-list">
        {graph.nodes.map(({ note }) => (
          <button key={note.id} onClick={() => onOpen(note.id)}>
            <span className="status-dot" />
            {note.title}
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}
