/**
 * Connected-data visual: the user's life domains feeding a central
 * decision-intelligence core. SVG with a slowly-rotating conic halo behind the
 * core, glowing nodes, and draw-on links (all reduced-motion safe). `tone`
 * controls light/dark surfaces; `className` is forwarded to the wrapper.
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
  const line = tone === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(11,11,15,0.12)';
  const nodeFill = tone === 'dark' ? '#0e0f16' : '#ffffff';
  const nodeStroke = tone === 'dark' ? 'rgba(255,255,255,0.12)' : 'var(--brand-line)';
  const label = tone === 'dark' ? 'rgba(255,255,255,0.78)' : 'var(--brand-ink)';

  return (
    <div className={`relative ${className}`}>
      {/* rotating halo behind the core */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2">
        <div className="conic-halo spin-slow h-full w-full rounded-full opacity-40 blur-2xl" />
      </div>

      <svg
        viewBox="0 0 400 310"
        className="relative w-full"
        role="img"
        aria-label="Your life domains feeding one decision-intelligence core"
      >
        <defs>
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* base links */}
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
        {/* animated accent links (draw on) */}
        {NODES.map((n, i) => (
          <line
            key={n.label}
            x1={n.x}
            y1={n.y}
            x2={CX}
            y2={CY}
            stroke="var(--brand-accent)"
            strokeWidth="1.5"
            opacity="0.6"
            className="draw"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
        {/* traveling pulses toward the core */}
        {NODES.map((n, i) => (
          <circle key={`p-${n.label}`} r="2.4" fill="var(--brand-accent)">
            <animateMotion
              dur="2.6s"
              begin={`${i * 0.35}s`}
              repeatCount="indefinite"
              path={`M${n.x},${n.y} L${CX},${CY}`}
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="linear"
            />
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur="2.6s"
              begin={`${i * 0.35}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* core */}
        <circle cx={CX} cy={CY} r="58" fill="url(#core-glow)" />
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
            <circle cx={n.x} cy={n.y} r="3.5" fill="var(--brand-accent)" />
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
    </div>
  );
}
