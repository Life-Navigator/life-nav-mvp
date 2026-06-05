/**
 * Connected-data-nodes visual: the user's life domains feeding a central
 * decision-intelligence core. Pure SVG, animated dashed links (reduced-motion
 * safe via the .dash class in globals.css). tone controls light/dark surfaces.
 */
const NODES = [
  { label: 'Finance', x: 90, y: 60 },
  { label: 'Career', x: 310, y: 50 },
  { label: 'Education', x: 360, y: 160 },
  { label: 'Health', x: 300, y: 250 },
  { label: 'Family', x: 90, y: 250 },
  { label: 'Goals', x: 40, y: 160 },
];
const CX = 200;
const CY = 155;

export default function DataConnectionMap({
  tone = 'dark',
  className = '',
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const line = tone === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(11,11,15,0.14)';
  const nodeFill = tone === 'dark' ? '#12131b' : '#ffffff';
  const nodeStroke = tone === 'dark' ? 'rgba(255,255,255,0.12)' : 'var(--brand-line)';
  const label = tone === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--brand-ink)';
  return (
    <svg
      viewBox="0 0 400 310"
      className={`w-full ${className}`}
      role="img"
      aria-label="Your life domains feeding one decision-intelligence core"
    >
      {NODES.map((n) => (
        <line
          key={n.label}
          x1={n.x}
          y1={n.y}
          x2={CX}
          y2={CY}
          stroke="var(--brand-accent)"
          strokeWidth="1.5"
          className="dash"
          opacity="0.55"
        />
      ))}
      {NODES.map((n) => (
        <line
          key={`b-${n.label}`}
          x1={n.x}
          y1={n.y}
          x2={CX}
          y2={CY}
          stroke={line}
          strokeWidth="1"
        />
      ))}
      {/* center core */}
      <circle
        cx={CX}
        cy={CY}
        r="40"
        fill={nodeFill}
        stroke="var(--brand-accent)"
        strokeWidth="1.5"
      />
      <circle cx={CX} cy={CY} r="40" fill="var(--brand-accent)" opacity="0.08" />
      <text x={CX} y={CY - 3} textAnchor="middle" fontSize="11" fontWeight="600" fill={label}>
        Decision
      </text>
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize="11" fontWeight="600" fill={label}>
        Intelligence
      </text>
      {/* domain nodes */}
      {NODES.map((n) => (
        <g key={`n-${n.label}`}>
          <circle cx={n.x} cy={n.y} r="26" fill={nodeFill} stroke={nodeStroke} strokeWidth="1" />
          <circle cx={n.x} cy={n.y} r="3" fill="var(--brand-accent)" />
          <text
            x={n.x}
            y={n.y + 18}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="500"
            fill={label}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
