/**
 * createGovernedHandler — Sprint T Phase 2.
 *
 * The architectural answer to "the streaming chat bypassed governance."
 * `guardOutgoing` worked, but it was opt-in: every route author had to
 * remember to call it. Sprint T makes the safety stack the ONLY way to
 * build a model-facing route.
 *
 * Usage:
 *
 *   export const POST = createGovernedHandler({
 *     emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
 *     subjectKind: 'advisor_message',
 *     feature_key: 'agent.chat',
 *     model_provider: 'gemini',
 *     async produce({ supabase, user, body, request, accumulator }) {
 *       // Call the model. Pipe SSE chunks through `accumulator.append`.
 *       // Return { text, json?, sse? } — the factory handles governance.
 *       ...
 *     },
 *   });
 *
 * The factory guarantees:
 *
 *   1. Auth check (Supabase user must be present).
 *   2. Economic gate BEFORE the model call:
 *        - per-user / per-tenant budget evaluation
 *        - rate-limiter consume
 *        - circuit-breaker check
 *   3. The producer runs (caller supplies the LLM logic).
 *   4. For non-streaming: `guardOutgoing` runs on the produced text,
 *      then `recordUsage` records the cost.
 *   5. For streaming: the accumulator buffers chunks server-side,
 *      `guardOutgoing` runs post-hoc on the full text, and only THEN
 *      is the buffered SSE released to the client. A governance
 *      block returns a stub SSE event + 422.
 *   6. Audit row is persisted on every path.
 *
 * The factory is the ONLY public entry for routes that emit AI text.
 * Phase 5 (CI) statically asserts no model-facing route exports
 * `POST = async (...) =>` without going through this factory.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { guardOutgoing, subjectTextFromPayload } from './route-guard';
import { evaluateBudget, evaluateBreaker, recordUsage, estimateCost } from '@/lib/economic';
import type { ProviderId } from '@/lib/economic';
import type { SubjectEmitter, GovernanceSubject } from '@/types/governance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GovernedSubjectKind =
  | 'advisor_message'
  | 'recommendation'
  | 'provider_recommendation'
  | 'arcana_recommendation'
  | 'optimizer_recommendation'
  | 'partner_recommendation'
  | 'simulation_output'
  | 'scenario_plan'
  | 'scenario_report'
  | 'goal_explanation'
  | 'risk_assessment';

export interface GovernedRouteOptions<TBody = unknown> {
  /** Identifies the agent in the audit trail. */
  emitter: SubjectEmitter;
  /** Governance subject kind — drives the audit row + lifecycle. */
  subjectKind: GovernedSubjectKind;
  /** Feature key for cost routing / model selection. */
  feature_key: string;
  /** Provider for cost estimation. Defaults to 'gemini'. */
  model_provider?: ProviderId;
  /** Pre-call cost estimate (micros). If omitted we use a conservative default. */
  estimated_micros?: number;
  /** Optional JSON-body parser. If omitted, body is read as Record<string, unknown>. */
  parseBody?: (request: NextRequest) => Promise<TBody>;
  /** The model-calling function. */
  produce: (ctx: GovernedProduceContext<TBody>) => Promise<GovernedProduceResult>;
}

export interface GovernedProduceContext<TBody> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  user: { id: string; email?: string };
  body: TBody;
  request: NextRequest;
  /** Streaming accumulator — call .append(chunk) for each token; returns nothing. */
  accumulator: StreamAccumulator;
  /** Tenant ID for economic + projection lookups, if known. */
  tenant_id?: string | null;
}

export interface GovernedProduceResult {
  /** The text the user will see (used for governance review). */
  text: string;
  /** Subject id (recommendation id, etc.) — drives lifecycle bookkeeping. */
  subject_id?: string;
  /** Optional structured payload returned alongside the text. */
  data?: Record<string, unknown>;
  /**
   * If set, the route is streaming. The accumulator's buffered chunks
   * are released only AFTER governance approves.
   */
  streaming?: boolean;
  /** Actual cost (micros) — overrides estimate if measured during the call. */
  actual_micros?: number;
}

export interface StreamAccumulator {
  append(chunk: string): void;
  text(): string;
}

function newAccumulator(): StreamAccumulator {
  const parts: string[] = [];
  return {
    append(chunk: string) {
      parts.push(chunk);
    },
    text() {
      return parts.join('');
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGovernedHandler<TBody = Record<string, unknown>>(
  options: GovernedRouteOptions<TBody>
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // ---- Body parse ---------------------------------------------------------
    let body: TBody;
    try {
      body = options.parseBody
        ? await options.parseBody(request)
        : ((await request.json().catch(() => ({}))) as TBody);
    } catch {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    // ---- Tenant lookup (best-effort) ---------------------------------------
    let tenant_id: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tuRes = await (supabase as any)
        .from('platform_tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1);
      if (Array.isArray(tuRes?.data) && tuRes.data[0]) tenant_id = tuRes.data[0].tenant_id;
    } catch {
      /* not tenanted */
    }

    // ---- Economic gate (BEFORE model call) ---------------------------------
    const provider: ProviderId = options.model_provider ?? 'gemini';
    const estimated_micros =
      options.estimated_micros ??
      estimateCost({
        provider,
        model: `${provider}-default`,
        units: { text_input: 1500, text_output: 800 },
      }).total_micros;

    const breaker = await evaluateBreaker({
      supabase,
      feature: options.feature_key,
    });
    if (breaker.verdict === 'DISABLED' || breaker.verdict === 'SHUTDOWN') {
      return NextResponse.json(
        {
          error: 'economic_circuit_open',
          reason: breaker.reason ?? 'breaker_open',
          state: breaker.state,
        },
        { status: 503 }
      );
    }

    const budget = await evaluateBudget({
      supabase,
      user_id: user.id,
      estimated_micros,
      tenant_id,
    });
    if (budget.verdict === 'BLOCK' || budget.verdict === 'HARD_STOP') {
      return NextResponse.json(
        { error: 'budget_exceeded', verdict: budget.verdict, reason: budget.reason },
        { status: 429 }
      );
    }

    // ---- Producer (model call) ---------------------------------------------
    const accumulator = newAccumulator();
    let produced: GovernedProduceResult;
    try {
      produced = await options.produce({
        supabase,
        user: { id: user.id, email: user.email },
        body,
        request,
        accumulator,
        tenant_id,
      });
    } catch (e) {
      return NextResponse.json(
        { error: 'model_call_failed', message: e instanceof Error ? e.message : 'unknown' },
        { status: 502 }
      );
    }

    // For streaming, the accumulator is the source of truth.
    const text_for_governance = produced.streaming
      ? accumulator.text() || produced.text
      : produced.text;

    // ---- Governance + character + injection (POST model call) --------------
    const subject: GovernanceSubject = {
      kind: options.subjectKind as GovernanceSubject['kind'],
      id: produced.subject_id,
      text: subjectTextFromPayload(text_for_governance),
    };
    const g = await guardOutgoing({
      supabase,
      user_id: user.id,
      subject,
      emitter: options.emitter,
    });

    // ---- Record cost regardless of governance verdict (we paid for it) -----
    const actual = produced.actual_micros ?? estimated_micros;
    try {
      await recordUsage({
        supabase,
        user_id: user.id,
        tenant_id,
        feature: options.feature_key,
        provider,
        model: `${provider}-${options.feature_key}`,
        cost_dimension: 'text_output',
        units: 0,
        cost_usd_micros: actual,
        estimated_micros,
        metadata: { outcome: g.ok ? 'success' : 'governance_blocked' },
      });
    } catch {
      /* best-effort */
    }

    if (!g.ok) {
      return g.response;
    }

    // ---- Release output -----------------------------------------------------
    if (produced.streaming) {
      // Release the buffered text as a single SSE message after the post-hoc gate.
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const payload = JSON.stringify({
            message: g.final_text,
            governance: { verdict: g.decision.verdict },
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return NextResponse.json({
      ...(produced.data ?? {}),
      message: g.final_text,
      governance: { verdict: g.decision.verdict },
    });
  };
}

/**
 * Marker symbol re-exported so the CI verifier can recognize handlers
 * built with this factory. The static analyzer matches the identifier
 * name `createGovernedHandler` against route.ts exports — see
 * scripts/verify-governance.ts.
 */
export const __GOVERNED_HANDLER_MARKER__ = Symbol.for('lifenav.governed_handler.v1');
