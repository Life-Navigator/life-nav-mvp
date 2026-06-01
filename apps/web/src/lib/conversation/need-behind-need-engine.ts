/**
 * NeedBehindNeedEngine — DETERMINISTIC.
 *
 * Implements Achieve Global's "What? What? Why?" drill-down. Given a
 * conversation transcript on a specific domain, the engine returns:
 *
 *   * a structured tree of nodes (depth 0 = stated_goal, then
 *     iterating up to `max_depth`)
 *   * the next prompt the agent should issue (or null when the
 *     drill-down has terminated)
 *   * the inferred root goal + confidence
 *
 * Termination rules:
 *
 *   1. max_depth reached (default 3)
 *   2. the current node already contains a values statement
 *      (regex matches: "because", "I value", "matters to me", "always
 *      wanted", "feel like I have to") — values_reached
 *   3. the current node names a consequence ("can't afford to", "if I
 *      don't", "people will think", "miss out on") — consequence_reached
 *   4. the current node is so short (< 3 tokens) that there's no signal
 *      to drill into — low_signal
 *
 * No LLM. Same inputs → same drill-down.
 */

import { inferDrivers } from './driver-inference-engine';
import { nextPromptKind, selectPrompt } from './domain-prompts';
import type {
  DiscoveryDomain,
  DominantDriver,
  DriverScores,
  NeedBehindNeedDrillDown,
  NeedBehindNeedNode,
  PromptKind,
} from '@/types/conversation-intel';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface DrillDownTurn {
  prompt_kind: PromptKind;
  /** User answer at this turn. */
  answer: string;
}

export interface DrillDownInputs {
  domain: DiscoveryDomain;
  /** The "What do you want?" answer + every subsequent turn. Index 0 = depth 0. */
  history: DrillDownTurn[];
  max_depth?: number;
}

// ---------------------------------------------------------------------------
// Termination heuristics
// ---------------------------------------------------------------------------

const VALUES_PATTERNS: RegExp[] = [
  /\bbecause\b/i,
  /\bI\s+value\b/i,
  /\bmatters?\s+(to\s+me|because)\b/i,
  /\balways\s+wanted\b/i,
  /\bfeels?\s+like\s+I\s+have\s+to\b/i,
  /\bnever\s+had\b/i,
  /\b(my|the)\s+identity\b/i,
];

const CONSEQUENCE_PATTERNS: RegExp[] = [
  /\bcan'?t\s+afford\s+to\b/i,
  /\bif\s+I\s+don'?t\b/i,
  /\b(people|they)\s+will\s+(think|see|judge)\b/i,
  /\bmiss\s+out\b/i,
  /\brun\s+out\b/i,
  /\bend\s+up\b/i,
];

export function detectStop(answer: string): NeedBehindNeedNode['reason_to_stop'] | undefined {
  const a = answer.trim();
  if (a.split(/\s+/).filter((w) => w.length > 0).length < 3) return 'low_signal';
  for (const p of VALUES_PATTERNS) if (p.test(a)) return 'values_reached';
  for (const p of CONSEQUENCE_PATTERNS) if (p.test(a)) return 'consequence_reached';
  return undefined;
}

// ---------------------------------------------------------------------------
// Build tree
// ---------------------------------------------------------------------------

function buildNode(
  turn: DrillDownTurn,
  depth: number,
  perTurnHistory: DriverScores[],
  maxDepth: number
): NeedBehindNeedNode {
  const inferred = inferDrivers({
    current_text: turn.answer,
    prior_per_turn_scores: perTurnHistory,
  });
  const reason_to_stop = depth >= maxDepth ? 'max_depth' : detectStop(turn.answer);
  return {
    depth,
    prompt_kind: turn.prompt_kind,
    claim: turn.answer.trim(),
    drivers_at_node: inferred.per_turn,
    should_continue: reason_to_stop === undefined,
    reason_to_stop,
  };
}

// ---------------------------------------------------------------------------
// Pure entrypoint
// ---------------------------------------------------------------------------

export function buildDrillDown(inputs: DrillDownInputs): NeedBehindNeedDrillDown {
  const maxDepth = inputs.max_depth ?? 3;
  const nodes: NeedBehindNeedNode[] = [];
  const perTurnHistory: DriverScores[] = [];

  for (let i = 0; i < inputs.history.length; i += 1) {
    const turn = inputs.history[i];
    const node = buildNode(turn, i, perTurnHistory, maxDepth);
    nodes.push(node);
    perTurnHistory.push(node.drivers_at_node);
  }

  const last = nodes[nodes.length - 1];
  const currentDepth = nodes.length;

  // Determine dominant driver across the session for prompt selection.
  const inferred = inferDrivers({
    current_text: '',
    prior_per_turn_scores: perTurnHistory,
  });

  let next_prompt: NeedBehindNeedDrillDown['next_prompt'];
  let inferred_root_goal: string | undefined;
  let inferred_root_confidence: number | undefined;

  if (!last || last.should_continue) {
    const nextKind = nextPromptKind(currentDepth, maxDepth);
    next_prompt = {
      prompt_kind: nextKind,
      text: selectPrompt(inputs.domain, nextKind, inferred.dominant),
      rationale:
        nextKind === 'why_important'
          ? `At depth ${currentDepth}, the methodology asks "why" to surface the underlying value.`
          : `Drill-down at depth ${currentDepth}; next step is ${nextKind}.`,
    };
  } else {
    // Drill-down has terminated. Synthesize root goal from the deepest node.
    inferred_root_goal = synthesizeRootGoal(inputs.history, last.reason_to_stop, inputs.domain);
    inferred_root_confidence = confidenceForRoot(nodes, last.reason_to_stop);
  }

  return {
    domain: inputs.domain,
    nodes,
    next_prompt,
    inferred_root_goal,
    inferred_root_confidence,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function synthesizeRootGoal(
  history: DrillDownTurn[],
  reason: NeedBehindNeedNode['reason_to_stop'],
  domain: DiscoveryDomain
): string {
  // For values_reached / consequence_reached, the LAST answer is the root.
  // For max_depth / low_signal, we combine the last answer with the
  // initial stated goal for context.
  const first = history[0]?.answer.trim();
  const last = history[history.length - 1]?.answer.trim();
  if (!first && !last) return `Unspecified ${domain} goal`;
  if (!last) return first ?? `Unspecified ${domain} goal`;
  if (reason === 'values_reached' || reason === 'consequence_reached') return last;
  if (!first) return last;
  return `${last} (rooted in: "${first}")`;
}

function confidenceForRoot(
  nodes: NeedBehindNeedNode[],
  reason: NeedBehindNeedNode['reason_to_stop']
): number {
  // Base confidence by termination reason.
  const base =
    reason === 'values_reached'
      ? 0.85
      : reason === 'consequence_reached'
        ? 0.7
        : reason === 'max_depth'
          ? 0.6
          : 0.4; // low_signal
  // Boost slightly for deeper trees (more evidence accumulated).
  const depthBoost = Math.min(0.1, 0.025 * nodes.length);
  return Math.min(1, base + depthBoost);
}

/**
 * Convenience: given a terminated drill-down, return only the
 * driver-tuned root goal + reason ready to mirror into goals.root_goal.
 */
export function summarizeDrillDown(d: NeedBehindNeedDrillDown): {
  root_goal: string;
  reason: NeedBehindNeedNode['reason_to_stop'];
  dominant_driver?: DominantDriver;
} {
  const last = d.nodes[d.nodes.length - 1];
  const inferred = inferDrivers({
    current_text: '',
    prior_per_turn_scores: d.nodes.map((n) => n.drivers_at_node),
  });
  return {
    root_goal: d.inferred_root_goal ?? last?.claim ?? '',
    reason: last?.reason_to_stop,
    dominant_driver: inferred.dominant,
  };
}

export const __test = {
  detectStop,
  buildNode,
  buildDrillDown,
  summarizeDrillDown,
  synthesizeRootGoal,
  confidenceForRoot,
};
