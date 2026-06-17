'use client';

import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import type { LifeGraphNode, LifeGraphLink } from '@/types/lifeGraph';
import { DOMAIN_META } from '@/types/lifeGraph';

// react-force-graph-3d is client + WebGL only — never SSR it.
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

export interface LifeGraph3DHandle {
  focusNode: (id: string, distance?: number) => void;
  resetView: () => void;
  zoomToFit: () => void;
  zoomBy: (factor: number) => void;
}

interface Props {
  nodes: LifeGraphNode[];
  links: LifeGraphLink[];
  focusIds?: Set<string> | null; // when drilled-down, only these are vivid; others fade
  selectedId?: string | null;
  onSelect: (n: LifeGraphNode) => void;
  onExpand: (n: LifeGraphNode) => void;
}

function labelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = 44;
  ctx.font = `600 ${font}px Inter, system-ui, sans-serif`;
  const w = Math.max(64, ctx.measureText(text).width + 24);
  canvas.width = w;
  canvas.height = font + 24;
  ctx.font = `600 ${font}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 12, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sprite.scale.set((w / canvas.height) * 6, 6, 1);
  return sprite;
}

const LifeGraph3D = forwardRef<LifeGraph3DHandle, Props>(function LifeGraph3D(
  { nodes, links, focusIds, selectedId, onSelect, onExpand },
  ref
) {
  const fgRef = useRef<any>(null);
  const lastClick = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // graphData identity must be stable-ish; clone so force-graph can mutate positions.
  const data = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    }),
    [nodes, links]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Ambient "brain" particle cloud + soft lights, added once to the scene.
  const decorated = useRef(false);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || decorated.current) return;
    const t = setTimeout(() => {
      try {
        const scene = fg.scene?.();
        if (!scene) return;
        const N = 1400;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          // two lobes → vaguely brain-like cloud
          const lobe = Math.random() > 0.5 ? 1 : -1;
          const r = 120 + Math.random() * 90;
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          pos[i * 3] = r * Math.sin(ph) * Math.cos(th) + lobe * 55;
          pos[i * 3 + 1] = r * 0.7 * Math.sin(ph) * Math.sin(th);
          pos[i * 3 + 2] = r * Math.cos(ph);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          size: 1.4,
          color: new THREE.Color('#6d5bd0'),
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        scene.add(new THREE.Points(geo, mat));
        scene.add(new THREE.AmbientLight(0x8a7fff, 0.6));
        const p = new THREE.PointLight(0xa78bfa, 1.1, 600);
        p.position.set(120, 120, 160);
        scene.add(p);
        decorated.current = true;
      } catch {
        /* scene not ready */
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);

  useImperativeHandle(ref, () => ({
    focusNode: (id, distance = 90) => {
      const fg = fgRef.current;
      const n: any = (fg?.graphData?.().nodes || data.nodes).find((x: any) => x.id === id);
      if (!fg || !n || n.x == null) return;
      const d = 1 + distance / Math.hypot(n.x, n.y, n.z || 1);
      fg.cameraPosition({ x: n.x * d, y: n.y * d, z: (n.z || 0) * d + distance }, n, 1100);
    },
    resetView: () =>
      fgRef.current?.cameraPosition({ x: 0, y: 0, z: 320 }, { x: 0, y: 0, z: 0 }, 900),
    zoomToFit: () => fgRef.current?.zoomToFit(700, 60),
    zoomBy: (factor: number) => {
      const fg = fgRef.current;
      if (!fg) return;
      const cam = fg.camera();
      cam.position.multiplyScalar(factor);
    },
  }));

  const faded = (id: string) => focusIds && focusIds.size > 0 && !focusIds.has(id);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="#05060d"
        showNavInfo={false}
        nodeRelSize={4}
        nodeVal={(n: any) => 2 + (n.importance || 0.4) * 9}
        nodeLabel={(n: any) =>
          `<div style="font:600 12px Inter,sans-serif;color:#fff;background:rgba(10,12,20,.92);border:1px solid ${
            DOMAIN_META[n.domain as keyof typeof DOMAIN_META]?.color || '#888'
          }55;padding:6px 9px;border-radius:8px;backdrop-filter:blur(8px)">${n.label}<br/><span style="color:#94a3b8;font-weight:400">${
            DOMAIN_META[n.domain as keyof typeof DOMAIN_META]?.label || n.domain
          }${n.score != null ? ` · ${Math.round(n.score)}` : ''}</span></div>`
        }
        nodeThreeObject={(n: any) => {
          const meta = DOMAIN_META[n.domain as keyof typeof DOMAIN_META] || DOMAIN_META.core;
          const group = new THREE.Group();
          const dim = faded(n.id);
          const baseR = 2 + (n.importance || 0.4) * 7;
          const core = new THREE.Mesh(
            new THREE.SphereGeometry(baseR, 24, 24),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(meta.color),
              transparent: true,
              opacity: dim ? 0.12 : 0.95,
            })
          );
          group.add(core);
          // glow halo for important / selected nodes
          if (!dim && ((n.importance || 0) > 0.6 || n.id === selectedId)) {
            const halo = new THREE.Mesh(
              new THREE.SphereGeometry(baseR * 1.9, 20, 20),
              new THREE.MeshBasicMaterial({
                color: new THREE.Color(meta.glow),
                transparent: true,
                opacity: n.id === selectedId ? 0.28 : 0.16,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              })
            );
            group.add(halo);
          }
          if (n.id === selectedId) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(baseR * 2.3, 0.4, 8, 48),
              new THREE.MeshBasicMaterial({
                color: new THREE.Color('#ffffff'),
                transparent: true,
                opacity: 0.7,
              })
            );
            group.add(ring);
          }
          // labels only for root/cluster (and selected) to avoid clutter
          if (!dim && (n.type === 'root' || n.type === 'cluster' || n.id === selectedId)) {
            const s = labelSprite(
              n.label?.length > 22 ? n.label.slice(0, 21) + '…' : n.label,
              '#e2e8f0'
            );
            s.position.set(0, baseR + 5, 0);
            group.add(s);
          }
          return group;
        }}
        linkColor={(l: any) => {
          const m = DOMAIN_META[l.domain as keyof typeof DOMAIN_META] || DOMAIN_META.core;
          return m.color;
        }}
        linkWidth={(l: any) => 0.3 + (l.strength || 0.5) * 1.6}
        linkOpacity={0.35}
        linkDirectionalParticles={(l: any) => ((l.strength || 0) > 0.6 ? 2 : 0)}
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleSpeed={0.006}
        onNodeClick={(n: any) => {
          const now = Date.now();
          if (lastClick.current.id === n.id && now - lastClick.current.t < 350) {
            onExpand(n as LifeGraphNode);
            const fg = fgRef.current;
            if (fg && n.x != null) {
              const d = 1 + 70 / Math.hypot(n.x, n.y, n.z || 1);
              fg.cameraPosition({ x: n.x * d, y: n.y * d, z: (n.z || 0) * d + 70 }, n, 1000);
            }
          } else {
            onSelect(n as LifeGraphNode);
          }
          lastClick.current = { id: n.id, t: now };
        }}
        onBackgroundClick={() => {}}
      />
    </div>
  );
});

export default LifeGraph3D;
