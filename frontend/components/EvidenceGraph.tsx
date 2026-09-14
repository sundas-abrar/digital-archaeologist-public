export default function EvidenceGraph() {
  return (
    <div className="relative aspect-square w-full border border-white/10 bg-soil-900/30 p-4 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-600">
      <span className="absolute left-4 top-3">X / 04.17</span>
      <span className="absolute right-4 top-3">Y / 81.09</span>
      <span className="absolute bottom-3 left-4">Collection ref. 7f-21</span>

      <svg
        viewBox="0 0 400 400"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* faint grid */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 50}
            y1={0}
            x2={i * 50}
            y2={400}
            stroke="#232324"
            strokeWidth={0.5}
            opacity={0.5}
          />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 50}
            x2={400}
            y2={i * 50}
            stroke="#232324"
            strokeWidth={0.5}
            opacity={0.5}
          />
        ))}

        {/* connections between evidence nodes */}
        <g stroke="#C08A4E" strokeWidth={1} strokeDasharray="3 4" opacity={0.6}>
          <line x1={120} y1={150} x2={200} y2={100} />
          <line x1={120} y1={150} x2={90} y2={260} />
          <line x1={200} y1={100} x2={300} y2={140} />
          <line x1={300} y1={140} x2={250} y2={220} />
          <line x1={250} y1={220} x2={90} y2={260} />
          <line x1={250} y1={220} x2={310} y2={280} />
        </g>

        {/* orbit around the central finding */}
        <ellipse
          cx={200}
          cy={210}
          rx={70}
          ry={45}
          fill="none"
          stroke="#A8743D"
          strokeWidth={0.75}
          strokeDasharray="2 3"
          opacity={0.5}
        />

        {/* central "key finding" node, pulsing */}
        <circle cx={200} cy={210} r={16} fill="none" stroke="#C08A4E" strokeWidth={0.75} opacity={0.35}>
          <animate attributeName="r" values="10;18;10" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <circle cx={200} cy={210} r={10} fill="#0A0A0B" stroke="#C08A4E" strokeWidth={2} />
        <circle cx={200} cy={210} r={3.5} fill="#C08A4E" />

        {/* evidence nodes */}
        {[
          { x: 120, y: 150, label: "F-17", sub: "document" },
          { x: 200, y: 100, label: "P-04", sub: "person" },
          { x: 300, y: 140, label: "L-21", sub: "location" },
          { x: 250, y: 220, label: "E-09", sub: "event" },
          { x: 90, y: 260, label: "N-12", sub: "note" },
          { x: 310, y: 280, label: "R-08", sub: "revision" },
        ].map((node) => (
          <g key={node.label}>
            <rect
              x={node.x - 6}
              y={node.y - 6}
              width={12}
              height={12}
              fill="#0A0A0B"
              stroke="#8A8A85"
              strokeWidth={1.25}
            />
            <circle cx={node.x} cy={node.y} r={2} fill="#DCD7CB" />
            <text
              x={node.x + 12}
              y={node.y - 2}
              fill="#8A8A85"
              fontSize={9}
              fontFamily="monospace"
              letterSpacing="0.05em"
            >
              {node.label}
            </text>
            <text
              x={node.x + 12}
              y={node.y + 9}
              fill="#63625E"
              fontSize={7}
              fontFamily="monospace"
              letterSpacing="0.05em"
            >
              {node.sub.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>

      <p className="absolute bottom-3 right-4 text-right leading-tight">
        Relationship detected
        <br />6 records cross-linked
      </p>
    </div>
  );
}
