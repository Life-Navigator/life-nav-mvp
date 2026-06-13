'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { forceSimulation, forceManyBody, forceCenter, forceLink } from 'd3-force-3d';
import type { LifeGraphEdge, LifeGraphNode } from '../types';
import { BrainShell } from './BrainShell';
import { GraphNodeMesh } from './GraphNodeMesh';
import { GraphEdgeLine } from './GraphEdgeLine';

export interface GraphCameraApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

interface Props {
  nodes: LifeGraphNode[];
  edges: LifeGraphEdge[];
  nodeRelevance: Record<string, number>;
  selectedNode: LifeGraphNode | null;
  focusedId: string | null;
  onSelectNode: (node: LifeGraphNode | null) => void;
  onDrill: (node: LifeGraphNode) => void;
  apiRef?: React.MutableRefObject<GraphCameraApi | null>;
}

type PositionedNode = LifeGraphNode & { x: number; y: number; z: number };

function buildLayout(nodes: LifeGraphNode[], edges: LifeGraphEdge[]): PositionedNode[] {
  const simNodes = nodes.map((node) => ({ ...node })) as any[];
  const ids = new Set(nodes.map((n) => n.id));

  // Only simulate links whose endpoints both exist — never fabricate a connection.
  const simLinks = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target, strength: edge.strength ?? 0.5 }));

  const simulation = forceSimulation(simNodes, 3)
    .force('charge', forceManyBody().strength(-180))
    .force(
      'link',
      forceLink(simLinks)
        .id((d: any) => d.id)
        .distance((d: any) => 55 + (1 - (d.strength ?? 0.5)) * 80)
        .strength((d: any) => Math.max(0.05, d.strength ?? 0.4))
    )
    .force('center', forceCenter(0, 0, 0))
    .stop();

  for (let i = 0; i < 220; i++) simulation.tick();

  return simNodes.map((node) => ({ ...node, x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 }));
}

function CameraFocus({ focusedNode }: { focusedNode: PositionedNode | null }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (!focusedNode) return;
    target.current.set(focusedNode.x, focusedNode.y, focusedNode.z);
    const direction = new THREE.Vector3(
      focusedNode.x || 1,
      focusedNode.y || 1,
      focusedNode.z || 1
    ).normalize();
    const desiredPosition = target.current.clone().add(direction.multiplyScalar(110));
    camera.position.lerp(desiredPosition, 0.045);
    camera.lookAt(target.current);
  });

  return null;
}

// Bridges the imperative zoom/fit controls (used by the analytics strip) into the r3f scene.
function ControlsBridge({
  apiRef,
  controlsRef,
}: {
  apiRef?: React.MutableRefObject<GraphCameraApi | null>;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    if (!apiRef) return;
    const targetOf = () => controlsRef.current?.target ?? new THREE.Vector3(0, 0, 0);
    apiRef.current = {
      zoomIn: () => {
        camera.position.lerp(targetOf(), 0.25);
        controlsRef.current?.update?.();
      },
      zoomOut: () => {
        const t = targetOf();
        camera.position.copy(t.clone().add(camera.position.clone().sub(t).multiplyScalar(1.3)));
        controlsRef.current?.update?.();
      },
      fit: () => {
        camera.position.set(0, 0, 360);
        controlsRef.current?.target?.set(0, 0, 0);
        controlsRef.current?.update?.();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [camera, apiRef, controlsRef]);
  return null;
}

export function LifeGraphCanvas({
  nodes,
  edges,
  nodeRelevance,
  selectedNode,
  focusedId,
  onSelectNode,
  onDrill,
  apiRef,
}: Props) {
  const positionedNodes = useMemo(() => buildLayout(nodes, edges), [nodes, edges]);
  const controlsRef = useRef<any>(null);

  const nodeMap = useMemo(
    () => Object.fromEntries(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes]
  );
  const focusedNode = focusedId ? (nodeMap[focusedId] ?? null) : null;

  return (
    <Canvas camera={{ position: [0, 0, 360], fov: 55 }}>
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.55} />
      <pointLight position={[100, 100, 100]} intensity={1.2} />
      <Stars radius={400} depth={80} count={1600} factor={4} saturation={0} fade />

      <BrainShell />

      {edges.map((edge) => {
        const source = nodeMap[edge.source];
        const target = nodeMap[edge.target];
        if (!source || !target) return null;
        const relevance = Math.max(nodeRelevance[source.id] ?? 0, nodeRelevance[target.id] ?? 0);
        return (
          <GraphEdgeLine
            key={edge.id}
            source={source}
            target={target}
            strength={edge.strength ?? 0.5}
            confidence={edge.confidence ?? 0.5}
            provenance={edge.provenance ?? 'persisted_edge'}
            relevance={relevance}
            isFocused={
              focusedNode ? source.id === focusedNode.id || target.id === focusedNode.id : false
            }
          />
        );
      })}

      {positionedNodes.map((node) => (
        <GraphNodeMesh
          key={node.id}
          node={node}
          relevance={nodeRelevance[node.id] ?? 0}
          selected={selectedNode?.id === node.id}
          focused={focusedNode?.id === node.id}
          dimmed={Object.keys(nodeRelevance).length > 0 && (nodeRelevance[node.id] ?? 0) <= 0}
          onClick={() => onSelectNode(node)}
          onDoubleClick={() => onDrill(node)}
        />
      ))}

      <CameraFocus focusedNode={focusedNode} />
      <ControlsBridge apiRef={apiRef} controlsRef={controlsRef} />
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
