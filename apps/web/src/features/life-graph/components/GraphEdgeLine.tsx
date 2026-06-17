'use client';

import { Line } from '@react-three/drei';
import type { EdgeProvenance } from '../types';

interface Positioned {
  x: number;
  y: number;
  z: number;
}

interface Props {
  source: Positioned;
  target: Positioned;
  strength: number;
  confidence: number;
  relevance: number;
  isFocused: boolean;
  provenance: EdgeProvenance;
}

export function GraphEdgeLine({
  source,
  target,
  strength,
  confidence,
  relevance,
  isFocused,
  provenance,
}: Props) {
  // Persisted edges are solid; computed connections (derived via a shared node) are dashed so the user
  // can always tell a stored relationship from an inferred-but-cited one.
  const computed = provenance !== 'persisted_edge';

  const opacity = isFocused ? 0.95 : relevance > 0 ? 0.75 : computed ? 0.12 : 0.18;
  const width = 0.4 + strength * 2.2 + relevance * 2.4;
  const color = isFocused || relevance > 0 ? '#93c5fd' : computed ? '#475569' : '#334155';

  const points: [number, number, number][] = [
    [source.x, source.y, source.z],
    [
      (source.x + target.x) / 2,
      (source.y + target.y) / 2 + 8 * strength,
      (source.z + target.z) / 2,
    ],
    [target.x, target.y, target.z],
  ];

  return (
    <Line
      points={points}
      color={color}
      lineWidth={width}
      transparent
      opacity={opacity * (confidence || 0.5)}
      dashed={computed}
      dashSize={4}
      gapSize={3}
    />
  );
}
