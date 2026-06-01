/**
 * Conversation Explainers — DETERMINISTIC.
 *
 *   explainTradeoff(recommendation)        → structured tradeoff dialog
 *   explainSimulation(scenarios)           → narrate hierarchy-aware results
 *   explainProbability(distribution)       → uncertainty language + range
 *   challengeAssumption(assumption)        → Socratic challenge
 *   askFollowup(context)                   → structured follow-up question
 *
 * Each function returns a strongly-typed `ExplainerOutput<Body>` with:
 *
 *   * a deterministic `headline`
 *   * a structured `body`
 *   * `uncertainty_language[]` hedge phrases the UI should expose
 *   * `follow_ups[]` next questions
 *   * `phrasing_hint` optional driver-tuned hint for the LLM phrasing layer
 *   * `citations[]` real sources
 *
 * The LLM phrasing layer (the Gemini `LlmExplainer` from Sprint A) is
 * allowed to rephrase the headline + body text but not to mutate the
 * structured fields — same bypass-guard contract as the conversation
 * agent.
 */

import type { RecommendationOutput } from '@/types/advisor';
import type { DecisionImpact, ProbabilityDistribution, TimeHorizon } from '@/types/decision-impact';
import type {
  ExplainerOutput,
  TradeoffExplanationBody,
  SimulationExplanationBody,
  ProbabilityExplanationBody,
  AssumptionChallengeExplanationBody,
  FollowupExplanationBody,
  ChallengeKind,
  DominantDriver,
  PromptKind,
} from '@/types/conversation-intel';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function driverHint(d?: DominantDriver): ExplainerOutput<unknown>['phrasing_hint'] {
  return d ?? undefined;
}

function citationsFromRecommendation(
  rec: RecommendationOutput
): ExplainerOutput<unknown>['citations'] {
  const ev = rec.supporting_evidence ?? [];
  return ev.slice(0, 5).map((e) => ({
    label: e.label,
    source: e.kind,
    citation_reference: e.citation_reference,
    confidence: e.confidence,
  }));
}

// ---------------------------------------------------------------------------
// 1. explainTradeoff
// ---------------------------------------------------------------------------

export interface ExplainTradeoffInputs {
  recommendation: RecommendationOutput;
  dominant_driver?: DominantDriver;
}

export function explainTradeoff(
  inputs: ExplainTradeoffInputs
): ExplainerOutput<TradeoffExplanationBody> {
  const r = inputs.recommendation;
  const tradeoffs = r.tradeoffs ?? [];
  const framings: TradeoffExplanationBody['framings'] = tradeoffs.map((t) => ({
    summary: t.summary,
    gives_up: t.gives_up,
    gains: t.gains,
    net_assessment: netAssessment(t.gives_up, t.gains, inputs.dominant_driver),
  }));
  const hardWarnings: string[] = [];
  if (r.assumptions.some((a) => /hard\s+constraint/i.test(a))) {
    hardWarnings.push('Hard constraints currently bound the action space.');
  }
  return {
    kind: 'tradeoff',
    headline:
      tradeoffs.length === 0
        ? 'No material tradeoffs surfaced for this recommendation.'
        : `${tradeoffs.length} tradeoff${tradeoffs.length === 1 ? '' : 's'} to weigh before committing.`,
    body: { framings, hard_constraint_warnings: hardWarnings },
    uncertainty_language: [
      'Tradeoff weights are estimates; actual experience depends on follow-through.',
      'Re-evaluating after one acted-upon action will sharpen the picture.',
    ],
    follow_ups: tradeoffs.slice(0, 2).map((t) => ({
      question: `Are you OK giving up ${t.gives_up} in exchange for ${t.gains}?`,
      prompt_kind: 'confirmation' as PromptKind,
    })),
    phrasing_hint: driverHint(inputs.dominant_driver),
    citations: citationsFromRecommendation(r),
  };
}

function netAssessment(givesUp: string, gains: string, driver?: DominantDriver): string {
  // A simple deterministic verdict template. Driver-tuned phrasing only.
  if (driver === 'financial_security') {
    return `You trade ${givesUp.toLowerCase()} for greater certainty on ${gains.toLowerCase()}.`;
  }
  if (driver === 'image') {
    return `Net: ${gains} — the kind of move that’s visible to people who matter.`;
  }
  if (driver === 'performance') {
    return `Net: more progress on ${gains.toLowerCase()}, less slack on ${givesUp.toLowerCase()}.`;
  }
  return `Net: gains "${gains}", costs "${givesUp}".`;
}

// ---------------------------------------------------------------------------
// 2. explainSimulation
// ---------------------------------------------------------------------------

export interface ExplainSimulationInputs {
  recommendation: RecommendationOutput;
  /** Ranked scenarios from the HierarchyAwareEvaluator (Sprint Goal Progress). */
  ranked: Array<{ scenario_id: string; rank: number; score: number; note?: string }>;
  cycles_count?: number;
  dominant_driver?: DominantDriver;
}

export function explainSimulation(
  inputs: ExplainSimulationInputs
): ExplainerOutput<SimulationExplanationBody> {
  const ranked = inputs.ranked.slice().sort((a, b) => a.rank - b.rank);
  const best = ranked[0];
  const cycles_warning =
    (inputs.cycles_count ?? 0) > 0
      ? `Goal graph contains ${inputs.cycles_count} cycle(s) — interpret the ranking cautiously.`
      : undefined;
  return {
    kind: 'simulation',
    headline: best
      ? `Best-ranked scenario scored ${best.score.toFixed(2)} (of a possible 1.0).`
      : 'No scenarios were ranked — run the simulator first.',
    body: {
      evaluated_scenarios: ranked.length,
      best_scenario_id: best?.scenario_id,
      best_scenario_summary: best?.note,
      best_scenario_score: best?.score,
      ranked_summary: ranked.slice(0, 5),
      cycles_warning,
    },
    uncertainty_language: [
      'Scenario scores are deterministic snapshots, not predictions.',
      'A scenario that looks worse over 1 year may dominate over 10.',
    ],
    follow_ups: best
      ? [
          {
            question: 'Want to see the assumptions that drove this ranking?',
            prompt_kind: 'free_text' as PromptKind,
          },
        ]
      : [],
    phrasing_hint: driverHint(inputs.dominant_driver),
    citations: citationsFromRecommendation(inputs.recommendation),
  };
}

// ---------------------------------------------------------------------------
// 3. explainProbability
// ---------------------------------------------------------------------------

export interface ExplainProbabilityInputs {
  distribution: ProbabilityDistribution;
  dominant_driver?: DominantDriver;
}

export function explainProbability(
  inputs: ExplainProbabilityInputs
): ExplainerOutput<ProbabilityExplanationBody> {
  const d = inputs.distribution;
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const horizon = humanHorizon(d.time_horizon);
  const most_likely_text = `Most likely you land near ${pct(d.most_likely)} ${horizon}.`;
  const range_text = `Range: worst case ${pct(d.worst_case)}, best case ${pct(d.best_case)}.`;
  const confidence_text = `Our confidence in that estimate: ${pct(d.confidence)}.`;
  const variance_summary = summarizeVariance(d);

  const what_would_change = d.explanation.what_would_change_estimate ?? [];

  return {
    kind: 'probability',
    headline: `${pct(d.most_likely)} most-likely outcome ${horizon} (range ${pct(d.worst_case)}–${pct(d.best_case)}).`,
    body: {
      time_horizon: d.time_horizon,
      most_likely_text,
      range_text,
      confidence_text,
      variance_summary,
      what_would_change,
    },
    uncertainty_language: [
      'These quantiles are scenario-based estimates, not statistical confidence intervals.',
      'Longer horizons inherently widen the range because future decisions remain unmade.',
    ],
    follow_ups: what_would_change.slice(0, 2).map((w) => ({
      question: `Would you be willing to ${w.toLowerCase().replace(/\.+$/, '')}?`,
      prompt_kind: 'free_text' as PromptKind,
    })),
    phrasing_hint: driverHint(inputs.dominant_driver),
    citations: (d.explanation.evidence ?? []).slice(0, 5).map((e) => ({
      label: e.label,
      source: e.source,
      citation_reference: e.citation_reference,
      confidence: e.confidence,
    })),
  };
}

function humanHorizon(h: TimeHorizon): string {
  switch (h) {
    case 'immediate':
      return 'right now';
    case '3_month':
      return 'in 3 months';
    case '1_year':
      return 'in 1 year';
    case '3_year':
      return 'in 3 years';
    case '5_year':
      return 'in 5 years';
    case '10_year':
      return 'in 10 years';
    case '20_year':
      return 'in 20 years';
  }
}

function summarizeVariance(d: ProbabilityDistribution): string {
  const factors = d.explanation.variance_factors ?? [];
  if (factors.length === 0) return 'No specific variance factors surfaced.';
  const narrowers = factors.filter((f) => f.effect > 0).length;
  const wideners = factors.filter((f) => f.effect < 0).length;
  return `${narrowers} factor(s) narrow the range, ${wideners} widen it.`;
}

// ---------------------------------------------------------------------------
// 4. challengeAssumption
// ---------------------------------------------------------------------------

export interface ChallengeAssumptionInputs {
  assumption_text: string;
  /** Sensitivity from AssumptionEngine. Higher → harder challenge. */
  sensitivity?: number;
  /** Optional related evidence labels to surface against. */
  counter_evidence?: string[];
  /** What the recommendation would become if the assumption flipped. */
  what_changes_if_flipped?: string;
  dominant_driver?: DominantDriver;
}

export function challengeAssumption(
  inputs: ChallengeAssumptionInputs
): ExplainerOutput<AssumptionChallengeExplanationBody> {
  const kind = pickChallengeKind(inputs.assumption_text);
  const prompt = buildChallengePrompt(kind, inputs.assumption_text);
  return {
    kind: 'assumption_challenge',
    headline: 'Worth checking this assumption before acting on it.',
    body: {
      assumption_text: inputs.assumption_text,
      challenge_kind: kind,
      prompt,
      what_changes_if_flipped:
        inputs.what_changes_if_flipped ??
        'If this assumption is wrong, the recommendation should be reconsidered.',
      evidence_against: inputs.counter_evidence ?? [],
    },
    uncertainty_language: [
      'Challenging an assumption is not the same as rejecting the recommendation.',
      'If the assumption survives the challenge, confidence in the rec goes UP.',
    ],
    follow_ups: [
      {
        question: prompt,
        prompt_kind: 'free_text' as PromptKind,
      },
    ],
    phrasing_hint: driverHint(inputs.dominant_driver),
    citations: (inputs.counter_evidence ?? []).map((label) => ({
      label,
      source: 'central_ontology' as const,
      confidence: 0.7,
    })),
  };
}

function pickChallengeKind(assumptionText: string): ChallengeKind {
  if (/structural\s+life\s+event|never|always/i.test(assumptionText)) return 'what_if';
  if (/no\s+(matching|historical|supporting)/i.test(assumptionText)) return 'counter_evidence';
  if (/horizon|long-?term|future/i.test(assumptionText)) return 'time_pressure';
  if (/recent|just\s+happened/i.test(assumptionText)) return 'recency_bias';
  return 'why_assume';
}

function buildChallengePrompt(kind: ChallengeKind, text: string): string {
  switch (kind) {
    case 'what_if':
      return `What if "${text}" turned out to be wrong — how would your plan change?`;
    case 'counter_evidence':
      return `What evidence would convince you that "${text}" is not the right framing?`;
    case 'time_pressure':
      return `Are you under time pressure that\'s making "${text}" feel more locked in than it should?`;
    case 'recency_bias':
      return `Is "${text}" driven by something that happened recently, or by a longer-term pattern?`;
    case 'why_assume':
      return `Why is "${text}" the assumption we should make, rather than the opposite?`;
  }
}

// ---------------------------------------------------------------------------
// 5. askFollowup
// ---------------------------------------------------------------------------

export interface AskFollowupInputs {
  reason: 'missing_info' | 'contradiction' | 'discover_root_goal' | 'clarify';
  field?: string; // user-graph field to fill
  question_text: string;
  options?: string[];
  binds_to?: string;
  why: string;
  dominant_driver?: DominantDriver;
}

export function askFollowup(inputs: AskFollowupInputs): ExplainerOutput<FollowupExplanationBody> {
  const kind: PromptKind =
    inputs.reason === 'discover_root_goal'
      ? 'why_important'
      : inputs.options
        ? 'confirmation'
        : 'free_text';
  return {
    kind: 'followup',
    headline: `A quick clarifying question on: ${inputs.field ?? inputs.reason.replace(/_/g, ' ')}`,
    body: {
      question: inputs.question_text,
      prompt_kind: kind,
      why: inputs.why,
      binds_to: inputs.binds_to,
      options: inputs.options,
    },
    uncertainty_language: [
      'You can skip this and we will use a default — confidence will be lower.',
    ],
    follow_ups: [],
    phrasing_hint: driverHint(inputs.dominant_driver),
    citations: [],
  };
}

// ---------------------------------------------------------------------------
// Determinism contract — all five functions are pure.
// ---------------------------------------------------------------------------

export const __test = {
  explainTradeoff,
  explainSimulation,
  explainProbability,
  challengeAssumption,
  askFollowup,
  pickChallengeKind,
  buildChallengePrompt,
  humanHorizon,
  summarizeVariance,
};
