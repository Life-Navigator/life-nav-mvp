/**
 * AdvisorConversationAgent
 *
 * Front-of-house surface that converts free-form user messages into
 * structured `ConversationTurn`s. Three layered guarantees:
 *
 *   1. **Deterministic core**. The agent delegates reasoning to
 *      `AdvisorReasoningService.reason()`. The resulting
 *      `RecommendationOutput` is surfaced on every turn that needs
 *      one — root goal, action ids, sequence, confidence, tradeoffs,
 *      timeline.
 *
 *   2. **LLM (Gemini) explanation only**. Callers may inject an
 *      `LlmExplainer` to phrase the deterministic output as natural
 *      language. The LLM is allowed to fill `explain.text`, `ask.why`,
 *      and `propose.summary`. Everything else is computed in-process.
 *
 *   3. **Bypass guard**. After the LLM returns, the agent diffs the
 *      proposed structure against the deterministic core. Any attempt
 *      to mutate `root_goal`, `required_actions`, `recommended_sequence`,
 *      `confidence_score`, `tradeoffs`, `cross_domain_impacts`, or
 *      `pathway` is **rejected** — the field is replaced with the
 *      deterministic value and the attempt is recorded in
 *      `trace.llm_rejected_mutations`.
 *
 * The agent itself does not call Gemini. It calls the injected
 * `LlmExplainer` which the route handler is responsible for wiring up.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { reason as runReasoning } from '@/lib/advisor/advisor-reasoning-service';
import type { PersonalGraphRetriever } from '@/lib/advisor/advisor-reasoning-service';
import type { AdvisorInputs, PersonalContext, RecommendationOutput } from '@/types/advisor';
import type {
  AdvisorConversationInputs,
  AskBlock,
  ContradictionFlag,
  ConversationMessage,
  ConversationTurn,
  ExplainBlock,
  MissingInfoFlag,
  ProposeBlock,
  TurnIntent,
  TurnKind,
} from '@/types/conversation';

// ---------------------------------------------------------------------------
// LLM explainer interface — injected, optional. Without it the agent
// falls back to deterministic phrasing helpers.
// ---------------------------------------------------------------------------

export interface LlmExplainer {
  /**
   * Phrase a deterministic plan as conversational text.
   * Implementations must NOT invent new actions or change strengths;
   * the bypass guard will reject anything they try to overwrite.
   */
  explain(input: {
    user_message: string;
    intent: TurnIntent;
    recommendation: RecommendationOutput;
    personal_context: PersonalContext;
    history: ConversationMessage[];
  }): Promise<{
    ask?: { question: string; why: string };
    explain?: { text: string };
    propose?: { summary: string };
  }>;
}

const NOOP_EXPLAINER: LlmExplainer = {
  async explain() {
    return {};
  },
};

// ---------------------------------------------------------------------------
// Intent classification — deterministic, no LLM.
// ---------------------------------------------------------------------------

const INTENT_PATTERNS: Array<{ intent: TurnIntent; pattern: RegExp }> = [
  {
    intent: 'discover_root_goal',
    pattern: /\b(my\s+(real|true|core)\s+goal|what\s+do\s+i\s+want|why\s+do\s+i\s+want)\b/i,
  },
  {
    intent: 'explain_recommendation',
    pattern: /\b(why\s+(this|that|recommend)|explain|how\s+come|reasoning|what\s+makes)\b/i,
  },
  {
    intent: 'explain_tradeoff',
    pattern: /\b(tradeoff|trade-?off|give\s+up|cost\s+of|downside|risk\s+of)\b/i,
  },
  {
    intent: 'resolve_contradiction',
    pattern: /\b(but\s+i|however|conflict|doesn'?t\s+make\s+sense|inconsistent)\b/i,
  },
  {
    intent: 'challenge_assumption',
    pattern: /\b(assume|assumption|what\s+if|are\s+you\s+sure|prove)\b/i,
  },
  {
    intent: 'gather_missing_info',
    pattern: /\b(don'?t\s+know|haven'?t\s+decided|not\s+sure|need\s+more)\b/i,
  },
  { intent: 'clarify', pattern: /\b(what\s+do\s+you\s+mean|clarify|repeat|rephrase)\b/i },
];

export function classifyIntent(message: string): TurnIntent {
  const m = message.trim();
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(m)) return intent;
  }
  // Heuristic: a question mark → likely clarify; otherwise small talk.
  if (m.endsWith('?')) return 'clarify';
  return 'small_talk';
}

// ---------------------------------------------------------------------------
// Contradiction + missing-info detectors — pure functions over personal
// context and the deterministic recommendation.
// ---------------------------------------------------------------------------

export function detectMissingInfo(personal: PersonalContext): MissingInfoFlag[] {
  const out: MissingInfoFlag[] = [];
  if (personal.constraints.length === 0) {
    out.push({
      field: 'user_constraints',
      why_it_matters:
        'Without constraints the recommendation is unbounded — we may propose actions that violate your hard limits.',
    });
  }
  if (personal.capabilities.length === 0) {
    out.push({
      field: 'user_capabilities',
      why_it_matters:
        'Without capabilities we cannot weight feasibility; high-effort actions may be over-prioritized.',
    });
  }
  if (personal.decision_preferences.length === 0) {
    out.push({
      field: 'user_decision_preferences',
      why_it_matters:
        'Without speed/certainty/flexibility/upside weights we default to a balanced profile that may not match you.',
    });
  }
  if (personal.commitment_levels.length === 0) {
    out.push({
      field: 'user_commitment_levels',
      why_it_matters:
        'Without hours-per-week per domain we cannot tell which actions are realistic this quarter.',
    });
  }
  if (personal.domain_risk_tolerance.length === 0) {
    out.push({
      field: 'user_domain_risk_tolerance',
      why_it_matters:
        'Without per-domain risk tolerance we apply moderate defaults to every recommendation.',
    });
  }
  return out;
}

export function detectContradictions(
  recommendation: RecommendationOutput | undefined,
  personal: PersonalContext
): ContradictionFlag[] {
  const out: ContradictionFlag[] = [];
  if (!recommendation) return out;

  const rootName = recommendation.root_goal.inferred_true_goal.toLowerCase();

  // Home ownership goal + hard constraint on money/time
  if (/home\s+ownership|down\s+payment|house/.test(rootName)) {
    const hardMoney = personal.constraints.find(
      (c) => c.severity === 'hard' && c.domain === 'money'
    );
    if (hardMoney) {
      out.push({
        field: 'user_constraints',
        observed: `hard money constraint: ${hardMoney.label}`,
        conflicts_with: `root_goal: ${recommendation.root_goal.inferred_true_goal}`,
        severity: 'hard',
      });
    }
  }

  // Entrepreneurship goal + low risk tolerance
  if (/entrepreneur|start.*business|venture/.test(rootName)) {
    const r = personal.domain_risk_tolerance.find((r) => r.domain === 'entrepreneurship');
    if (r && r.tolerance < 0.35) {
      out.push({
        field: 'user_domain_risk_tolerance',
        observed: `entrepreneurship tolerance=${r.tolerance.toFixed(2)}`,
        conflicts_with: `root_goal: ${recommendation.root_goal.inferred_true_goal}`,
        severity: 'soft',
      });
    }
  }

  // Career-advancement goal + 0 hours/week committed to career
  if (/career|promotion|income\s+growth/.test(rootName)) {
    const c = personal.commitment_levels.find((c) => c.area === 'career');
    if (c && c.level === 0) {
      out.push({
        field: 'user_commitment_levels',
        observed: `career hours_per_week=0`,
        conflicts_with: `root_goal: ${recommendation.root_goal.inferred_true_goal}`,
        severity: 'soft',
      });
    }
  }

  // Cycles in the goal pathway are a contradiction
  if (recommendation.pathway && recommendation.pathway.cycles.length > 0) {
    out.push({
      field: 'goal_hierarchy',
      observed: `${recommendation.pathway.cycles.length} cycle(s) in goal graph`,
      conflicts_with: 'a directed pathway from root to leaf',
      severity: 'hard',
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Deterministic phrasing helpers (fallback when no LLM is wired).
// ---------------------------------------------------------------------------

function fallbackAsk(
  intent: TurnIntent,
  rec: RecommendationOutput,
  missing: MissingInfoFlag[]
): AskBlock | undefined {
  if (intent === 'discover_root_goal') {
    return {
      question: rec.root_goal.stated_goal
        ? `You said you want "${rec.root_goal.stated_goal}". What would having that actually unlock for you?`
        : 'What outcome are you trying to reach in the next 1-5 years?',
      why: 'Naming the deeper outcome lets us reason past surface-level goals.',
      expected_kind: 'free_text',
      binds_to: 'goals.root_goal',
    };
  }
  if (missing.length > 0) {
    const top = missing[0];
    return {
      question: `Quick gap to fill: I don't have your ${top.field.replace(/_/g, ' ')} on file. Can you share it now or skip?`,
      why: top.why_it_matters,
      options: ['Share now', 'Skip for now'],
      expected_kind: 'choice',
      binds_to: top.field,
    };
  }
  return undefined;
}

function fallbackExplain(rec: RecommendationOutput): ExplainBlock {
  const top3 = rec.required_actions
    .slice(0, 3)
    .map((a) => `- ${a.title} (${a.domain})`)
    .join('\n');
  const citations = rec.required_actions
    .slice(0, 3)
    .flatMap((a) => a.related_central_entity_ids.map((id) => ({ central_entity_id: id })));
  return {
    text:
      `Root goal: ${rec.root_goal.inferred_true_goal}.\n` +
      `Top actions:\n${top3}\n` +
      `Confidence: ${(rec.confidence_score * 100).toFixed(0)}%.`,
    citations,
    explanation_confidence: rec.confidence_score,
  };
}

function fallbackSummary(rec: RecommendationOutput): string {
  return `Proposed plan with ${rec.required_actions.length} actions, confidence ${(rec.confidence_score * 100).toFixed(0)}%.`;
}

// ---------------------------------------------------------------------------
// LLM bypass guard.
//
// We never let the LLM produce a `RecommendationOutput`. The structures
// it returns are limited to free-text + question fields. The guard
// records what the LLM asked for and what we accepted.
// ---------------------------------------------------------------------------

interface LlmRaw {
  ask?: { question?: unknown; why?: unknown };
  explain?: { text?: unknown };
  propose?: { summary?: unknown };
  // Any other field is ignored. Below we record which "other fields"
  // appeared so trace.llm_rejected_mutations is informative.
  [k: string]: unknown;
}

const ALLOWED_LLM_PATHS = new Set(['ask.question', 'ask.why', 'explain.text', 'propose.summary']);

function sanitizeLlmOutput(raw: unknown): {
  cleaned: {
    ask?: { question: string; why: string };
    explain?: { text: string };
    propose?: { summary: string };
  };
  rejected: string[];
} {
  const rejected: string[] = [];
  const cleaned: ReturnType<typeof sanitizeLlmOutput>['cleaned'] = {};
  if (!raw || typeof raw !== 'object') {
    return { cleaned, rejected };
  }
  const r = raw as LlmRaw;

  for (const key of Object.keys(r)) {
    if (!['ask', 'explain', 'propose'].includes(key)) {
      rejected.push(key);
    }
  }

  if (r.ask && typeof r.ask === 'object') {
    const a = r.ask as Record<string, unknown>;
    for (const k of Object.keys(a)) {
      if (!ALLOWED_LLM_PATHS.has(`ask.${k}`)) rejected.push(`ask.${k}`);
    }
    if (typeof a.question === 'string' && typeof a.why === 'string') {
      cleaned.ask = { question: a.question, why: a.why };
    }
  }
  if (r.explain && typeof r.explain === 'object') {
    const e = r.explain as Record<string, unknown>;
    for (const k of Object.keys(e)) {
      if (!ALLOWED_LLM_PATHS.has(`explain.${k}`)) rejected.push(`explain.${k}`);
    }
    if (typeof e.text === 'string') {
      cleaned.explain = { text: e.text };
    }
  }
  if (r.propose && typeof r.propose === 'object') {
    const p = r.propose as Record<string, unknown>;
    for (const k of Object.keys(p)) {
      if (!ALLOWED_LLM_PATHS.has(`propose.${k}`)) rejected.push(`propose.${k}`);
    }
    if (typeof p.summary === 'string') {
      cleaned.propose = { summary: p.summary };
    }
  }
  return { cleaned, rejected };
}

// ---------------------------------------------------------------------------
// Decide the turn kind (ask / explain / propose / acknowledge).
// ---------------------------------------------------------------------------

function decideTurnKind(
  intent: TurnIntent,
  recommendation: RecommendationOutput | undefined,
  missing: MissingInfoFlag[],
  contradictions: ContradictionFlag[]
): TurnKind {
  if (intent === 'discover_root_goal') return 'ask';
  if (intent === 'gather_missing_info' || missing.length >= 3) return 'ask';
  if (contradictions.some((c) => c.severity === 'hard')) return 'ask';
  if (intent === 'explain_recommendation' || intent === 'explain_tradeoff') return 'explain';
  if (recommendation) return 'propose';
  return 'acknowledge';
}

// ---------------------------------------------------------------------------
// Top-level entrypoint.
// ---------------------------------------------------------------------------

export interface ConversationOptions {
  explainer?: LlmExplainer;
  retriever?: PersonalGraphRetriever;
}

export async function respond(
  supabase: SupabaseClient,
  inputs: AdvisorConversationInputs,
  options: ConversationOptions = {}
): Promise<ConversationTurn> {
  const explainer = options.explainer ?? NOOP_EXPLAINER;

  // 1. Intent
  const intent = classifyIntent(inputs.message);

  // 2. Deterministic recommendation (skip if just acknowledging)
  let recommendation: RecommendationOutput | undefined = inputs.pending_recommendation;
  let personal: PersonalContext = {
    constraints: [],
    capabilities: [],
    motivations: [],
    decision_preferences: [],
    domain_risk_tolerance: [],
    commitment_levels: [],
  };

  const needsRec = intent !== 'small_talk';
  if (needsRec) {
    const advisorInputs: AdvisorInputs = {
      user_id: inputs.user_id,
      stated_goal_claim: inputs.message,
      root_goal_id_override: inputs.root_goal_id_override,
    };
    recommendation = await runReasoning(supabase, advisorInputs, { retriever: options.retriever });
  }

  // 3. Best-effort load personal context for diagnostics. Failures are
  //    non-fatal — we still respond.
  try {
    const { data: cons } = await supabase
      .from('user_constraints')
      .select('id, dimension, severity, description')
      .eq('user_id', inputs.user_id)
      .eq('is_active', true)
      .limit(50);
    const { data: caps } = await supabase
      .from('user_capabilities')
      .select('id, capability_name, domain, proficiency_level')
      .eq('user_id', inputs.user_id)
      .limit(100);
    const { data: prefs } = await supabase
      .from('user_decision_preferences')
      .select('id, axis, weight')
      .eq('user_id', inputs.user_id)
      .limit(10);
    const { data: comm } = await supabase
      .from('user_commitment_levels')
      .select('id, domain, hours_per_week')
      .eq('user_id', inputs.user_id)
      .limit(10);
    const { data: risk } = await supabase
      .from('user_domain_risk_tolerance')
      .select('id, domain, tolerance_score')
      .eq('user_id', inputs.user_id)
      .limit(10);
    personal = {
      constraints: (cons ?? []).map((r) => ({
        id: r.id,
        label: r.description,
        severity: r.severity ?? undefined,
        domain: r.dimension ?? undefined,
      })),
      capabilities: (caps ?? []).map((r) => ({
        id: r.id,
        label: r.capability_name,
        level: r.proficiency_level ?? undefined,
        domain: r.domain ?? undefined,
      })),
      motivations: [],
      decision_preferences: (prefs ?? []).map((r) => ({
        id: r.id,
        pattern: r.axis,
        strength: r.weight == null ? undefined : Number(r.weight),
      })),
      domain_risk_tolerance: (risk ?? []).map((r) => ({
        id: r.id,
        domain: r.domain,
        tolerance: Number(r.tolerance_score ?? 0.5),
      })),
      commitment_levels: (comm ?? []).map((r) => ({
        id: r.id,
        area: r.domain,
        level: Number(r.hours_per_week ?? 0),
      })),
    };
  } catch {
    // swallow — diagnostic block is best-effort
  }

  // 4. Diagnostics
  const missing = detectMissingInfo(personal);
  const contradictions = detectContradictions(recommendation, personal);

  // 5. Decide turn kind
  const kind = decideTurnKind(intent, recommendation, missing, contradictions);

  // 6. LLM phrasing (optional, guarded)
  let llmCalls = 0;
  let rejected: string[] = [];
  let llmAsk: { question: string; why: string } | undefined;
  let llmExplain: { text: string } | undefined;
  let llmSummary: string | undefined;

  if (recommendation && explainer !== NOOP_EXPLAINER) {
    llmCalls = 1;
    try {
      const raw = await explainer.explain({
        user_message: inputs.message,
        intent,
        recommendation,
        personal_context: personal,
        history: inputs.history ?? [],
      });
      const { cleaned, rejected: rej } = sanitizeLlmOutput(raw);
      rejected = rej;
      llmAsk = cleaned.ask;
      llmExplain = cleaned.explain;
      llmSummary = cleaned.propose?.summary;
    } catch {
      // LLM failure is non-fatal; fall through to deterministic phrasing.
    }
  }

  // 7. Assemble turn blocks
  let ask: AskBlock | undefined;
  let explain: ExplainBlock | undefined;
  let propose: ProposeBlock | undefined;
  let acknowledge: { text: string } | undefined;

  if (kind === 'ask') {
    const fb = recommendation ? fallbackAsk(intent, recommendation, missing) : undefined;
    ask = fb && llmAsk ? { ...fb, question: llmAsk.question, why: llmAsk.why } : fb;
  } else if (kind === 'explain' && recommendation) {
    const fb = fallbackExplain(recommendation);
    explain = llmExplain ? { ...fb, text: llmExplain.text } : fb;
  } else if (kind === 'propose' && recommendation) {
    propose = {
      recommendation, // deterministic — never overwritten
      summary: llmSummary ?? fallbackSummary(recommendation),
    };
  } else {
    acknowledge = { text: 'Got it.' };
  }

  return {
    kind,
    intent,
    ask,
    explain,
    propose,
    acknowledge,
    contradictions,
    missing_info: missing,
    deterministic_recommendation: recommendation,
    trace: {
      classified_intent: intent,
      used_llm: explainer !== NOOP_EXPLAINER,
      llm_calls: llmCalls,
      llm_rejected_mutations: rejected,
    },
  };
}

// ---------------------------------------------------------------------------
// Re-exports for tests.
// ---------------------------------------------------------------------------
export const __test = { sanitizeLlmOutput, decideTurnKind, fallbackAsk, fallbackExplain };
