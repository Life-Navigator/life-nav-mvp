// Model router — resolves a ModelRouteRequest to a concrete ModelRoute (provider + model + fallback chain).
// Pure decision logic: no network, no secrets. Honors feature flags, risk floors, empathy/critic overrides,
// region availability, and a guaranteed Gemini fallback for beta safety.

import type { AiAuditRecord, ModelRoute, ModelRouteRequest, RiskLevel } from './types';
import { AGENT_PROFILES, FINANCE_MATH_USES_LLM } from './agentProfiles';
import { type ModelKey, descriptor, isModelEnabled, aiConfig } from './modelRegistry';
import { resolveChain } from './fallbacks';
import { emitAiAudit, newRequestId } from './auditLog';

const RANK = { basic: 0, standard: 1, deep: 2 } as const;

function floorForRisk(risk: RiskLevel | undefined, deepRequested?: boolean): keyof typeof RANK {
  if (risk === 'regulated' || deepRequested) return 'deep';
  if (risk === 'high') return 'standard';
  return 'basic';
}

/** A Gemini key that meets the reasoning floor (used to upgrade cheap models off high-risk tasks). */
function geminiForFloor(floor: keyof typeof RANK): ModelKey {
  return floor === 'deep'
    ? 'gemini-reasoning'
    : floor === 'standard'
      ? 'gemini-default'
      : 'gemini-cheap';
}

/** Resolve the desired primary logical model after applying overrides (risk / empathy / critic). */
function resolveDesired(req: ModelRouteRequest): { key: ModelKey; note: string } {
  const profile = AGENT_PROFILES[req.agent];
  // Unknown agent → safe default (router is total over AgentKey, but guard for runtime safety).
  if (!profile) return { key: 'gemini-default', note: 'unknown agent → safe default' };

  let key = profile.primary;
  let note = `agent default (${req.agent})`;

  // High-stakes critic escalation → Opus when enabled (else stays Sonnet/Gemini via fallback chain).
  if (
    req.requiresCritic &&
    (req.riskLevel === 'regulated' || req.requiresDeepReasoning) &&
    isModelEnabled('claude-opus')
  ) {
    return { key: 'claude-opus', note: 'high-stakes critic → opus' };
  }

  // Empathy nudge → Sonnet for sensitive/narrative work (gated; falls back to Gemini if disabled).
  if (req.requiresEmpathy && key !== 'claude-sonnet' && req.latencyTier !== 'realtime') {
    key = 'claude-sonnet';
    note = 'empathy required → sonnet';
  }

  // Risk floor: regulated/high-risk (or explicit deep) must not run on a model below the floor.
  const floor = floorForRisk(req.riskLevel, req.requiresDeepReasoning);
  if (RANK[descriptor(key).reasoning] < RANK[floor]) {
    const upgraded = geminiForFloor(floor);
    return { key: upgraded, note: `${note} → upgraded for ${req.riskLevel || 'deep'} risk` };
  }
  return { key, note };
}

export function routeModel(req: ModelRouteRequest): ModelRoute {
  // Single-model safety mode.
  if (!aiConfig.routerEnabled) {
    const d = descriptor('gemini-default');
    return {
      provider: d.provider,
      model: d.model,
      fallbackModels: [],
      reason: 'router disabled → default model',
    };
  }

  const profile = AGENT_PROFILES[req.agent];
  const { key: desired, note } = resolveDesired(req);
  const chain = resolveChain(
    desired,
    profile?.fallbacks ?? ['gemini-default'],
    aiConfig.vertexLocation
  );

  const reasonBits = [note];
  if (chain.fellBack && chain.fallbackReason) reasonBits.push(`fallback: ${chain.fallbackReason}`);
  if (req.domain) reasonBits.push(`domain=${req.domain}`);

  return {
    provider: chain.primary.provider,
    model: chain.primary.model,
    fallbackModels: chain.fallbacks,
    reason: reasonBits.join(' · '),
  };
}

export interface RouteContext {
  userId?: string | null;
  promptVersion?: string;
  responseSchemaVersion?: string;
  promptPreview?: string; // dropped from audit unless AI_AUDIT_DEV_CONTENT=true
}

/** Resolve a route AND emit the audit record in one call (use this from API routes / the backend). */
export function routeAndAudit(
  req: ModelRouteRequest,
  ctx: RouteContext = {}
): { route: ModelRoute; audit: AiAuditRecord } {
  const route = routeModel(req);
  const fellBack =
    route.model !== descriptor(AGENT_PROFILES[req.agent]?.primary ?? 'gemini-default').model;
  const audit = emitAiAudit({
    requestId: newRequestId(),
    timestamp: new Date().toISOString(),
    userId: ctx.userId ?? null,
    agent: req.agent,
    domain: req.domain,
    provider: route.provider,
    model: route.model,
    fallbackUsed: fellBack,
    fallbackReason: fellBack ? route.reason : undefined,
    riskLevel: req.riskLevel ?? 'low',
    latencyTier: req.latencyTier ?? 'normal',
    costTier: req.costTier ?? 'standard',
    promptVersion: ctx.promptVersion,
    responseSchemaVersion: ctx.responseSchemaVersion,
    promptPreview: ctx.promptPreview,
  });
  return { route, audit };
}

/** Hard guard exposed to the finance flow: core math must use deterministic code, never an LLM. */
export function assertFinanceMathNotLlm(): void {
  if (FINANCE_MATH_USES_LLM) {
    throw new Error('Invariant violated: core financial math must never be computed by an LLM.');
  }
}

export { FINANCE_MATH_USES_LLM };
