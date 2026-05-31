/**
 * GoalPathService
 *
 * Given a user_id and a root_goal_id, traverse the six goal-hierarchy
 * tables (from migration 076) and produce an "optimal pathway graph":
 *
 *   - required   — goals the root depends on (PREREQUISITE_FOR / DEPENDS_ON)
 *   - supporting — goals that help the root (SUPPORTS / ACCELERATES)
 *   - optional   — goals nested under the root (PARENT_OF subtree)
 *   - blocked    — goals that block the root (BLOCKS / CONFLICTS_WITH / DELAYED_BY)
 *
 * Plus a topological ordering and cycle detection so downstream callers
 * (AdvisorReasoningService, simulation evaluator) can reason safely.
 *
 * The module is split into pure resolver logic (`resolvePathway`) and
 * the Supabase loader (`loadGoalEdges`) so the resolver is unit-testable
 * with fixture edges and the loader carries the I/O cost.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  GoalEdge,
  GoalHierarchyTable,
  GoalPathway,
  GoalRelationshipType,
  PathwayClassification,
  PathwayEdge,
  PathwayNode,
} from '@/types/goal-hierarchy';

// ---------------------------------------------------------------------------
// Edge classification — which relationships count toward which bucket.
// "Direction" is interpreted relative to the root.
//
//   incoming(root)  edges (* → root): supporting/blocking/prerequisite
//   outgoing(root)  edges (root → *): optional/depends_on
// ---------------------------------------------------------------------------

const INCOMING_SUPPORTING: GoalRelationshipType[] = ['SUPPORTS', 'ACCELERATES'];
const INCOMING_BLOCKING: GoalRelationshipType[] = [
  'BLOCKS',
  'CONFLICTS_WITH',
  'COMPETES_FOR_RESOURCES',
  'DELAYED_BY',
];
const INCOMING_REQUIRED: GoalRelationshipType[] = ['PREREQUISITE_FOR'];
const OUTGOING_REQUIRED: GoalRelationshipType[] = ['DEPENDS_ON'];
const OUTGOING_OPTIONAL: GoalRelationshipType[] = ['PARENT_OF'];

const ALL_TABLES: GoalHierarchyTable[] = [
  'goal_hierarchies',
  'goal_dependencies',
  'goal_conflicts',
  'goal_priorities',
  'goal_relationships',
  'goal_pathways',
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load every goal-edge row for `user_id` from all six tables in one round-trip.
 * Returns a flat `GoalEdge[]` regardless of source table so the resolver
 * can treat the storage as one heterogeneous graph.
 */
export async function loadGoalEdges(supabase: SupabaseClient, userId: string): Promise<GoalEdge[]> {
  const results = await Promise.all(
    ALL_TABLES.map((table) =>
      supabase
        .from(table)
        .select(
          'id, user_id, parent_goal_id, child_goal_id, relationship_type, strength_score, confidence_score, source'
        )
        .eq('user_id', userId)
        .then((res) => {
          if (res.error) throw res.error;
          return (res.data ?? []).map((row) => ({
            ...row,
            strength_score: row.strength_score == null ? 1 : Number(row.strength_score),
            confidence_score: row.confidence_score == null ? 1 : Number(row.confidence_score),
            source_table: table,
          })) as GoalEdge[];
        })
    )
  );
  return results.flat();
}

// ---------------------------------------------------------------------------
// Resolver — pure
// ---------------------------------------------------------------------------

interface AdjacencyMaps {
  outgoing: Map<string, GoalEdge[]>; // parent → edges
  incoming: Map<string, GoalEdge[]>; // child  → edges
}

function buildAdjacency(edges: GoalEdge[]): AdjacencyMaps {
  const outgoing = new Map<string, GoalEdge[]>();
  const incoming = new Map<string, GoalEdge[]>();
  for (const e of edges) {
    if (!e.parent_goal_id || !e.child_goal_id) continue;
    if (!outgoing.has(e.parent_goal_id)) outgoing.set(e.parent_goal_id, []);
    if (!incoming.has(e.child_goal_id)) incoming.set(e.child_goal_id, []);
    outgoing.get(e.parent_goal_id)!.push(e);
    incoming.get(e.child_goal_id)!.push(e);
  }
  return { outgoing, incoming };
}

interface BfsResult {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
}

/**
 * Generic BFS that walks edges matching `acceptLabel` from `start` in
 * the requested `direction`, classifying every reachable node with
 * `classification` and stopping if `cycleGuard.has(node)`.
 */
function bfs(
  start: string,
  direction: 'incoming' | 'outgoing',
  adj: AdjacencyMaps,
  acceptLabel: (l: GoalRelationshipType) => boolean,
  classification: PathwayClassification,
  cycleGuard: Set<string>
): BfsResult {
  const nodes: Map<string, PathwayNode> = new Map();
  const edgeOut: PathwayEdge[] = [];
  const queue: Array<{ id: string; depth: number; strength: number; via: string[] }> = [
    { id: start, depth: 0, strength: 1, via: [] },
  ];
  const seen = new Set<string>([start]);

  while (queue.length) {
    const { id, depth, strength, via } = queue.shift()!;
    const edges = direction === 'incoming' ? adj.incoming.get(id) : adj.outgoing.get(id);
    if (!edges) continue;
    for (const e of edges) {
      if (!acceptLabel(e.relationship_type)) continue;
      const neighbor = direction === 'incoming' ? e.parent_goal_id : e.child_goal_id;
      if (neighbor === start) continue;
      if (seen.has(neighbor)) {
        cycleGuard.add(neighbor);
        continue;
      }
      seen.add(neighbor);
      const nextStrength = strength * e.strength_score;
      const nextVia = [...via, e.id];
      nodes.set(neighbor, {
        goal_id: neighbor,
        classification,
        depth: depth + 1,
        via_edges: nextVia,
        cumulative_strength: nextStrength,
      });
      edgeOut.push({
        source: e.parent_goal_id,
        target: e.child_goal_id,
        label: e.relationship_type,
        strength: e.strength_score,
        confidence: e.confidence_score,
        source_table: e.source_table,
      });
      queue.push({ id: neighbor, depth: depth + 1, strength: nextStrength, via: nextVia });
    }
  }
  return { nodes: Array.from(nodes.values()), edges: edgeOut };
}

/**
 * Tarjan's SCC against the *combined* directed graph (all tables).
 * Any SCC of size > 1 is a cycle (or one node with self-loop, which the
 * NOT-self-loop CHECK rules out).
 */
function detectCycles(edges: GoalEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.parent_goal_id)) adj.set(e.parent_goal_id, []);
    adj.get(e.parent_goal_id)!.push(e.child_goal_id);
  }
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let nextIndex = 0;

  const strongConnect = (v: string) => {
    index.set(v, nextIndex);
    lowlink.set(v, nextIndex);
    nextIndex += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      if (scc.length > 1) cycles.push(scc);
    }
  };

  for (const v of adj.keys()) {
    if (!index.has(v)) strongConnect(v);
  }
  return cycles;
}

/**
 * Topological order over the required + optional subgraph. Blocked and
 * supporting buckets are excluded from the order; they're attached as
 * metadata. Returns the order with the root pinned first.
 */
function topoOrder(rootGoalId: string, required: PathwayNode[], optional: PathwayNode[]): string[] {
  const sorted = [
    rootGoalId,
    ...[...required, ...optional].sort((a, b) => a.depth - b.depth).map((n) => n.goal_id),
  ];
  // De-dup while preserving order.
  const seen = new Set<string>();
  return sorted.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}

/**
 * Resolve the optimal pathway graph rooted at `rootGoalId`.
 * Pure function — easy to test with fixture edges.
 */
export function resolvePathway(rootGoalId: string, userId: string, edges: GoalEdge[]): GoalPathway {
  const adj = buildAdjacency(edges);
  const cycleGuard = new Set<string>();

  const supporting = bfs(
    rootGoalId,
    'incoming',
    adj,
    (l) => INCOMING_SUPPORTING.includes(l),
    'supporting',
    cycleGuard
  );
  const requiredFromIncoming = bfs(
    rootGoalId,
    'incoming',
    adj,
    (l) => INCOMING_REQUIRED.includes(l),
    'required',
    cycleGuard
  );
  const requiredFromOutgoing = bfs(
    rootGoalId,
    'outgoing',
    adj,
    (l) => OUTGOING_REQUIRED.includes(l),
    'required',
    cycleGuard
  );
  const optional = bfs(
    rootGoalId,
    'outgoing',
    adj,
    (l) => OUTGOING_OPTIONAL.includes(l),
    'optional',
    cycleGuard
  );
  const blocked = bfs(
    rootGoalId,
    'incoming',
    adj,
    (l) => INCOMING_BLOCKING.includes(l),
    'blocked',
    cycleGuard
  );

  // Merge required-from-both-directions, de-duped by goal_id.
  const requiredMap = new Map<string, PathwayNode>();
  for (const n of [...requiredFromIncoming.nodes, ...requiredFromOutgoing.nodes]) {
    const existing = requiredMap.get(n.goal_id);
    if (!existing || n.cumulative_strength > existing.cumulative_strength) {
      requiredMap.set(n.goal_id, n);
    }
  }
  const required = Array.from(requiredMap.values());

  const allEdges = [
    ...supporting.edges,
    ...requiredFromIncoming.edges,
    ...requiredFromOutgoing.edges,
    ...optional.edges,
    ...blocked.edges,
  ];
  // De-dup edges by (source,target,label).
  const edgeKey = (e: PathwayEdge) => `${e.source}::${e.target}::${e.label}`;
  const seenEdgeKeys = new Set<string>();
  const dedupedEdges = allEdges.filter((e) => {
    const k = edgeKey(e);
    if (seenEdgeKeys.has(k)) return false;
    seenEdgeKeys.add(k);
    return true;
  });

  const cycles = detectCycles(edges);

  return {
    root_goal_id: rootGoalId,
    user_id: userId,
    required,
    supporting: supporting.nodes,
    optional: optional.nodes,
    blocked: blocked.nodes,
    edges: dedupedEdges,
    topological_order: topoOrder(rootGoalId, required, optional.nodes),
    cycles,
    computed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service entrypoint — combines loader + resolver.
// ---------------------------------------------------------------------------

export interface GoalPathServiceOptions {
  /**
   * Persist the resolved pathway as `goal_pathways` rows so the
   * AdvisorReasoningService can re-read without recomputing. Default false.
   */
  persist?: boolean;
}

export async function computeGoalPathway(
  supabase: SupabaseClient,
  userId: string,
  rootGoalId: string,
  options: GoalPathServiceOptions = {}
): Promise<GoalPathway> {
  const edges = await loadGoalEdges(supabase, userId);
  const pathway = resolvePathway(rootGoalId, userId, edges);

  if (options.persist) {
    const rows = pathway.topological_order
      .filter((g) => g !== rootGoalId)
      .map((g, idx) => ({
        user_id: userId,
        parent_goal_id: rootGoalId,
        child_goal_id: g,
        relationship_type: 'PATHWAY_STEP' as const,
        strength_score:
          pathway.required.find((n) => n.goal_id === g)?.cumulative_strength ??
          pathway.optional.find((n) => n.goal_id === g)?.cumulative_strength ??
          0.5,
        confidence_score: 0.7,
        sequence_index: idx,
        source: 'goal_path_service',
        metadata: {
          classification: pathway.required.find((n) => n.goal_id === g)
            ? 'required'
            : pathway.optional.find((n) => n.goal_id === g)
              ? 'optional'
              : 'other',
          via:
            pathway.required.find((n) => n.goal_id === g)?.via_edges ??
            pathway.optional.find((n) => n.goal_id === g)?.via_edges ??
            [],
        },
      }));
    if (rows.length) {
      const { error } = await supabase
        .from('goal_pathways')
        .upsert(rows, { onConflict: 'user_id,parent_goal_id,child_goal_id,sequence_index' });
      if (error) throw error;
    }
  }

  return pathway;
}
