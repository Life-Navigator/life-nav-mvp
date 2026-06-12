'use client';

import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { LifeGraphNode } from '../types';

interface PositionedNode extends LifeGraphNode {
  x: number;
  y: number;
  z: number;
}

interface Props {
  node: PositionedNode;
  relevance: number;
  selected: boolean;
  focused: boolean;
  dimmed: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

const domainColors: Record<string, string> = {
  finance: '#22c55e',
  career: '#a855f7',
  education: '#06b6d4',
  health: '#fb7185',
  family: '#f59e0b',
  estate: '#60a5fa',
  insurance: '#84cc16',
  general: '#38bdf8',
};

export function GraphNodeMesh({
  node,
  relevance,
  selected,
  focused,
  dimmed,
  onClick,
  onDoubleClick,
}: Props) {
  const baseImportance = node.importance ?? 0.5;
  const confidence = node.confidence ?? 0.5;

  const size = 4 + baseImportance * 9 + relevance * 12 + (selected ? 4 : 0) + (focused ? 8 : 0);

  const color = domainColors[node.domain ?? 'general'] ?? '#38bdf8';
  const opacity = dimmed ? 0.16 : 0.9;
  const emissiveIntensity = 0.25 + relevance * 1.5 + (selected ? 0.9 : 0);

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh onClick={onClick} onDoubleClick={onDoubleClick}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={new THREE.Color(color)}
          emissiveIntensity={emissiveIntensity}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>

      {(selected || focused || relevance > 0.55) && (
        <mesh>
          <sphereGeometry args={[size * 1.65, 32, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.11 + relevance * 0.18}
            depthWrite={false}
          />
        </mesh>
      )}

      <Html distanceFactor={110} center>
        <div
          className={[
            'pointer-events-none whitespace-nowrap rounded-lg border px-2 py-1 text-center text-xs shadow-xl backdrop-blur',
            selected
              ? 'border-white/40 bg-white/15 text-white'
              : 'border-white/10 bg-slate-950/70 text-slate-200',
            dimmed ? 'opacity-25' : 'opacity-100',
          ].join(' ')}
        >
          <div className="font-medium">{node.label}</div>
          {node.score != null && (
            <div className="text-[10px] text-slate-300">Score {node.score}</div>
          )}
          {node.confidence != null && (
            <div className="text-[10px] text-slate-400">
              {Math.round(confidence * 100)}% confidence
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
