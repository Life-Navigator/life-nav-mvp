/**
 * Root-Goal Discovery State Machine.
 *
 * Given a stated goal and an evolving transcript, decides:
 *   - whether the engine has enough confidence to summarize, or
 *   - which discovery prompt to ask next (what/what/why/success/etc.)
 *
 * The engine is LLM-agnostic. Today it runs against the deterministic
 * scorer in lib/discovery/scoring.ts and the canned prompt templates in
 * lib/discovery/prompts.ts. Swap in an LLM adapter by replacing
 * `pickPromptText` and `inferRootGoal` — the rest of the state machine
 * (when to ask what, when to stop, how to summarize) stays the same.
 */

import { scoreAnswer, accumulateScores, dominantDrivers, driverConfidence } from './scoring';
import { PROMPT_LIBRARY } from './prompts';
import type {
  AgentPersona,
  DiscoverySessionState,
  DiscoverySummary,
  DiscoveryTurn,
  NextPromptResult,
  PromptKind,
  Urgency,
} from '@/types/discovery';

/** Confidence threshold above which we stop drilling. */
export const CONFIDENCE_STOP_THRESHOLD = 0.7;

/** Hard cap on how many drill turns we'll ask before forcing a confirmation. */
export const MAX_DRILL_TURNS = 6;

/**
 * Start a new discovery session for a stated goal. The first turn is the
 * user's stated goal — recorded as the answer to `what_accomplish`.
 */
export function startSession(args: {
  stated_goal: string;
  agent_persona: AgentPersona;
  session_id?: string;
  goal_id?: string | null;
}): DiscoverySessionState {
  const session_id = args.session_id ?? crypto.randomUUID();
  const firstTurn: DiscoveryTurn = {
    turn_index: 0,
    prompt_kind: 'what_accomplish',
    prompt_text: pickPromptText(args.agent_persona, 'what_accomplish'),
    user_answer: args.stated_goal,
    detected_drivers: scoreAnswer(args.stated_goal),
    agent_persona: args.agent_persona,
  };
  const scores = accumulateScores([{ text: args.stated_goal, index: 0 }]);
  return {
    session_id,
    goal_id: args.goal_id ?? null,
    agent_persona: args.agent_persona,
    stated_goal: args.stated_goal,
    driver_scores: scores,
    confidence: driverConfidence(scores, 1),
    done: false,
    turns: [firstTurn],
  };
}

/**
 * Decide the next prompt. Returns `{ done: true }` when the engine has
 * gathered enough to summarize.
 */
export function nextPrompt(state: DiscoverySessionState): NextPromptResult {
  if (state.done) return { done: true };

  // Have we hit the hard cap or the confidence threshold?
  const turnsAsked = state.turns.length;
  if (turnsAsked >= MAX_DRILL_TURNS) return { done: true };
  if (
    state.confidence >= CONFIDENCE_STOP_THRESHOLD &&
    state.success_definition &&
    state.consequence_of_inaction
  ) {
    return { done: true };
  }

  // Pick the next prompt kind based on what we already have.
  const nextKind = chooseNextPromptKind(state);
  if (!nextKind) return { done: true };

  return {
    done: false,
    prompt: {
      kind: nextKind,
      text: pickPromptText(state.agent_persona, nextKind),
      persona: state.agent_persona,
    },
  };
}

/**
 * Record the user's answer to the most-recently-asked prompt and update
 * the running session state. Returns the updated state for the caller to
 * persist via /api/onboarding/goal-discovery.
 */
export function recordAnswer(
  state: DiscoverySessionState,
  args: { prompt_kind: PromptKind; prompt_text: string; answer: string }
): DiscoverySessionState {
  const turn: DiscoveryTurn = {
    turn_index: state.turns.length,
    prompt_kind: args.prompt_kind,
    prompt_text: args.prompt_text,
    user_answer: args.answer,
    detected_drivers: scoreAnswer(args.answer),
    agent_persona: state.agent_persona,
  };

  // Capture per-kind fields onto the session state.
  const patch: Partial<DiscoverySessionState> = { turns: [...state.turns, turn] };

  switch (args.prompt_kind) {
    case 'what_unlock':
      patch.need_behind_need = args.answer.trim();
      break;
    case 'why_important':
      // The "why" usually exposes the root goal.
      patch.root_goal = inferRootGoal({
        stated_goal: state.stated_goal,
        need_behind_need: state.need_behind_need ?? null,
        why: args.answer,
      });
      break;
    case 'success_definition':
      patch.success_definition = args.answer.trim();
      break;
    case 'consequence_of_inaction':
      patch.consequence_of_inaction = args.answer.trim();
      break;
    case 'urgency':
      patch.urgency = normalizeUrgency(args.answer);
      break;
    default:
      break;
  }

  // Recompute driver scores + confidence over the full transcript.
  const allAnswers = patch.turns!.map((t, i) => ({
    text: t.user_answer ?? '',
    index: i,
  }));
  const scores = accumulateScores(allAnswers);
  const confidence = driverConfidence(scores, allAnswers.length);
  turn.confidence_after_turn = confidence;
  turn.inferred_root_goal = patch.root_goal ?? state.root_goal;

  const next: DiscoverySessionState = {
    ...state,
    ...patch,
    driver_scores: scores,
    confidence,
  };

  // Decide if we're done.
  const probe = nextPrompt(next);
  next.done = probe.done;
  return next;
}

/**
 * Produce the human-readable summary the UI shows in the confirmation
 * card and persists onto public.goals.
 */
export function summarize(state: DiscoverySessionState): DiscoverySummary {
  const { dominant, secondary } = dominantDrivers(state.driver_scores);
  return {
    stated_goal: state.stated_goal,
    root_goal: state.root_goal ?? null,
    success_definition: state.success_definition ?? null,
    consequence_of_inaction: state.consequence_of_inaction ?? null,
    urgency: state.urgency ?? null,
    dominant_driver: dominant,
    secondary_driver: secondary,
    driver_scores: state.driver_scores,
    confidence: state.confidence,
    agent_persona: state.agent_persona,
  };
}

// ----- internals -------------------------------------------------------

function chooseNextPromptKind(state: DiscoverySessionState): PromptKind | null {
  const have = new Set(state.turns.map((t) => t.prompt_kind));
  if (!have.has('what_unlock')) return 'what_unlock';
  if (!have.has('why_important')) return 'why_important';
  if (!state.success_definition) return 'success_definition';
  if (!state.consequence_of_inaction) return 'consequence_of_inaction';
  if (!state.urgency) return 'urgency';
  return null;
}

function pickPromptText(persona: AgentPersona, kind: PromptKind): string {
  const lib = PROMPT_LIBRARY[persona]?.[kind] ?? PROMPT_LIBRARY.general[kind];
  if (!lib || lib.length === 0) return 'Tell me more about that.';
  // Deterministic pick — first variant. An LLM-backed engine will choose
  // freely; the canned engine wants reproducibility for tests.
  return lib[0];
}

/**
 * Stub root-goal inference. Returns a concatenation of the most
 * information-bearing turns. An LLM-backed engine should replace this
 * with a structured rewrite call.
 */
function inferRootGoal(args: {
  stated_goal: string;
  need_behind_need: string | null;
  why: string;
}): string {
  const why = args.why.trim();
  const need = (args.need_behind_need ?? '').trim();
  if (need && why) return `${why} — by way of: ${need}`;
  if (why) return why;
  return args.stated_goal;
}

function normalizeUrgency(raw: string): Urgency {
  const t = raw.toLowerCase();
  if (/\b(now|asap|immediately|today|this\s+week|critical)\b/.test(t)) return 'critical';
  if (/\b(this\s+month|months?|weeks?|soon|q1|q2|q3|q4)\b/.test(t)) return 'high';
  if (/\b(this\s+year|years?|6\s+months?|\d+\s+years?)\b/.test(t)) return 'medium';
  return 'low';
}
