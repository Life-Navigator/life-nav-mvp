'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Points } from '@react-three/drei';

export function BrainShell() {
  // Procedural ambient shell only — NOT graph content and NOT user data. Pure visual atmosphere.
  const points = useMemo(() => {
    const vertices: number[] = [];

    for (let i = 0; i < 1400; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const brainBias = 1 + 0.18 * Math.sin(theta * 2) - 0.12 * Math.cos(phi * 3);

      const x = Math.sin(phi) * Math.cos(theta) * 170 * brainBias;
      const y = Math.sin(phi) * Math.sin(theta) * 90 * brainBias;
      const z = Math.cos(phi) * 95 * brainBias;

      if (x > -155 || y < 25) {
        vertices.push(x, y, z);
      }
    }

    return new Float32Array(vertices);
  }, []);

  return (
    <Points positions={points}>
      <pointsMaterial
        size={0.85}
        color="#60a5fa"
        transparent
        opacity={0.23}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}
