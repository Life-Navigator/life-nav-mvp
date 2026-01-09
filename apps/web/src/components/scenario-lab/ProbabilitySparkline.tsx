'use client';

/**
 * Probability Sparkline Component
 * Lightweight SVG sparkline chart for trend visualization
 */

interface ProbabilitySparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export default function ProbabilitySparkline({
  data,
  width = 120,
  height = 40,
  color = '#3B82F6',
  className = '',
}: ProbabilitySparklineProps) {
  if (!data || data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#E5E7EB"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  // Normalize data
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Calculate points
  const padding = 4;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * effectiveWidth;
    const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  // Create area fill
  const firstPoint = points[0].split(',');
  const lastPoint = points[points.length - 1].split(',');
  const areaPath = `${pathData} L ${lastPoint[0]},${height - padding} L ${firstPoint[0]},${height - padding} Z`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Area fill */}
      <path
        d={areaPath}
        fill={color}
        fillOpacity="0.1"
      />

      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Last point highlight */}
      {points.length > 0 && (
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="3"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
