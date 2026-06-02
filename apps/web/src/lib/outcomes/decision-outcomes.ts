/**
 * Recommendation outcome tracking — Sprint O.0 Phase 6.
 *
 * One row per recommendation in `public.decision_outcomes`. Each state
 * transition appends a row to `public.decision_outcome_events` so the
 * trail is reconstructible.
 *
 * State machine (one-direction only — outcomes do not regress):
 *
 *   generated → viewed → accepted ─┐
 *                       → ignored  ├─→ completed
 *                       → dismissed┘
 */

export type DecisionOutcomeState =
  | 'generated'
  | 'viewed'
  | 'accepted'
  | 'ignored'
  | 'dismissed'
  | 'completed';

interface CommonRefs {
  user_id: string;
  recommendation_id: string;
  governance_audit_id?: string | null;
}

export async function recordRecommendationGenerated(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  refs: CommonRefs,
  metadata?: Record<string, unknown>
): Promise<{ id: string } | null> {
  try {
    const ins = await supabase
      .from('decision_outcomes_v')
      .insert({
        recommendation_id: refs.recommendation_id,
        user_id: refs.user_id,
        governance_audit_id: refs.governance_audit_id ?? null,
        state: 'generated',
        generated_at: new Date().toISOString(),
        metadata: metadata ?? {},
      })
      .select('id')
      .single();
    if (ins.error || !ins.data) return null;
    await appendOutcomeEvent(supabase, {
      decision_outcome_id: ins.data.id,
      user_id: refs.user_id,
      from_state: null,
      to_state: 'generated',
      metadata: metadata ?? {},
    });
    return { id: ins.data.id };
  } catch {
    return null;
  }
}

export async function transitionOutcome(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  refs: { user_id: string; recommendation_id: string },
  to_state: Exclude<DecisionOutcomeState, 'generated'>,
  metadata?: Record<string, unknown>
): Promise<void> {
  const column = `${to_state}_at`;
  try {
    // Update only when the destination column is still NULL (idempotent
    // forward transition). We also push the state forward.
    const upd = await supabase
      .from('decision_outcomes_v')
      .update({
        state: to_state,
        [column]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('recommendation_id', refs.recommendation_id)
      .eq('user_id', refs.user_id)
      .select('id, state')
      .single();
    if (upd.error || !upd.data) return;
    await appendOutcomeEvent(supabase, {
      decision_outcome_id: upd.data.id,
      user_id: refs.user_id,
      from_state: null,
      to_state,
      metadata: metadata ?? {},
    });
  } catch {
    /* best-effort */
  }
}

interface AppendInputs {
  decision_outcome_id: string;
  user_id: string;
  from_state: DecisionOutcomeState | null;
  to_state: DecisionOutcomeState;
  metadata: Record<string, unknown>;
}

async function appendOutcomeEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: AppendInputs
): Promise<void> {
  try {
    await supabase.from('decision_outcome_events').insert({
      decision_outcome_id: input.decision_outcome_id,
      user_id: input.user_id,
      from_state: input.from_state,
      to_state: input.to_state,
      metadata: input.metadata,
    });
  } catch {
    /* best-effort */
  }
}

export async function setOutcomeScore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  refs: { user_id: string; recommendation_id: string },
  score: number,
  user_feedback?: string
): Promise<void> {
  if (score < 0 || score > 1) return;
  try {
    await supabase
      .from('decision_outcomes_v')
      .update({
        outcome_score: score,
        user_feedback: user_feedback ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('recommendation_id', refs.recommendation_id)
      .eq('user_id', refs.user_id);
  } catch {
    /* best-effort */
  }
}
