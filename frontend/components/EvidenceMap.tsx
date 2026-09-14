"use client";

const NODES = [
  { id: "P-04", label: "PERSON", x: 150, y: 55 },
  { id: "F-17", label: "DOCUMENT", x: 40, y: 110 },
  { id: "L-21", label: "LOCATION", x: 300, y: 95 },
  { id: "E-09", label: "EVENT", x: 235, y: 160 },
  { id: "N-12", label: "NOTE", x: 70, y: 225 },
  { id: "R-08", label: "RECORD", x: 260, y: 230 },
];

const LINKS: [number, number][] = [
  [0, 1],
  [0, 3],
  [2, 3],
  [3, 5],
  [4, 3],
];

export default function EvidenceMap() {
  return (
    <div className="relative w-full border border-white/10 bg-soil-900/40 p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-bone-600">
        <span>X / 04.17</span>
        <span>Y / 81.09</span>
      </div>

      <svg viewBox="0 0 340 260" className="w-full">
        {/* dashed connective lines */}
        {LINKS.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            stroke="#232324"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* central hub */}
        <circle cx="170" cy="150" r="34" fill="none" stroke="#232324" strokeDasharray="3 5" />
        <circle cx="170" cy="150" r="9" fill="#0A0A0B" stroke="#C08A4E" strokeWidth="1.5" />
        <circle cx="170" cy="150" r="2.5" fill="#C08A4E" />

        {NODES.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x - 7}
              y={n.y - 7}
              width="14"
              height="14"
              fill="#0A0A0B"
              stroke="#A8743D"
              strokeWidth="1.2"
            />
            <circle cx={n.x} cy={n.y} r="2" fill="#C08A4E" />
            <text
              x={n.x + 12}
              y={n.y + 3}
              fill="#DCD7CB"
              fontSize="9"
              fontFamily="var(--font-mono)"
              letterSpacing="0.05em"
            >
              {n.id}
            </text>
            <text
              x={n.x + 12}
              y={n.y + 13}
              fill="#63625E"
              fontSize="7"
              fontFamily="var(--font-mono)"
              letterSpacing="0.05em"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
        <span>Collection ref. 7F-21</span>
        <span className="text-brass-400">Relationships detected</span>
      </div>
    </div>
  );
}
