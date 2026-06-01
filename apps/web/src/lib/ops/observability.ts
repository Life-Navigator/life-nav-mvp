/**
 * Observability helpers — Sprint M Phase 5.
 *
 * Single-file facade for Sentry + OpenTelemetry + the LLM/governance
 * counters. Vendor SDKs are loaded lazily and gated on env so the
 * surface is a no-op in development and in tests.
 *
 * Counters:
 *   recordLlmUsage(...)          → ops.llm_usage_meter
 *   recordGovernanceIntervention → derived from decision_governance_audit
 *   recordCrisisDetection        → derived from decision_governance_audit
 *
 * Span wrappers:
 *   withSpan(name, fn)           → optional OTel; always returns fn() result
 */

// ---------------------------------------------------------------------------
// Sentry — capture
// ---------------------------------------------------------------------------

interface SentryShape {
  captureException(err: unknown, ctx?: Record<string, unknown>): void;
  captureMessage(msg: string, ctx?: Record<string, unknown>): void;
}

let SENTRY: SentryShape | null = null;
let sentryAttempted = false;

async function loadSentry(): Promise<SentryShape | null> {
  if (sentryAttempted) return SENTRY;
  sentryAttempted = true;
  if (!process.env.SENTRY_DSN) return null;
  try {
    // String-indirected dynamic import so the TS compiler does not
    // try to resolve @sentry/nextjs at type-check time. The package
    // is an optional runtime dependency.
    const importer = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const mod = await importer('@sentry/nextjs');
    SENTRY = mod as SentryShape;
  } catch {
    SENTRY = null;
  }
  return SENTRY;
}

export async function captureException(err: unknown, ctx?: Record<string, unknown>): Promise<void> {
  const s = await loadSentry();
  if (!s) return;
  try {
    s.captureException(err, ctx);
  } catch {
    /* swallow */
  }
}

export async function captureMessage(msg: string, ctx?: Record<string, unknown>): Promise<void> {
  const s = await loadSentry();
  if (!s) return;
  try {
    s.captureMessage(msg, ctx);
  } catch {
    /* swallow */
  }
}

// ---------------------------------------------------------------------------
// OpenTelemetry — minimal "span" wrapper that becomes a no-op when the
// OTel SDK is absent. We DELIBERATELY avoid importing the OTel API at
// module load so the package is optional.
// ---------------------------------------------------------------------------

export interface SpanResult<T> {
  value: T;
  latency_ms: number;
}

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<SpanResult<T>> {
  const t0 = Date.now();
  let value: T;
  try {
    value = await fn();
  } catch (e) {
    await captureException(e, { span: name, attributes });
    throw e;
  }
  const latency_ms = Date.now() - t0;
  // Future: forward to OTel collector if OTEL_EXPORTER_OTLP_ENDPOINT is set.
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // The intent is documented; actual exporter wiring lives in a
    // future migration that adds @opentelemetry/sdk-node + instrumentation.
  }
  return { value, latency_ms };
}

// ---------------------------------------------------------------------------
// LLM usage meter
// ---------------------------------------------------------------------------

export interface LlmUsageInput {
  user_id?: string | null;
  provider: 'gemini' | 'openai' | 'anthropic' | 'local' | 'other';
  model: string;
  operation_kind: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms?: number;
  /** Cost expressed in millionths of a USD (integer math). */
  cost_usd_micros: number;
  request_id?: string;
  governance_audit_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordLlmUsage(supabase: any, input: LlmUsageInput): Promise<void> {
  try {
    await supabase.from('ops_llm_usage_meter').insert({
      user_id: input.user_id ?? null,
      provider: input.provider,
      model: input.model,
      operation_kind: input.operation_kind,
      tokens_in: Math.max(0, Math.round(input.tokens_in)),
      tokens_out: Math.max(0, Math.round(input.tokens_out)),
      latency_ms: input.latency_ms ?? null,
      cost_usd_micros: Math.max(0, Math.round(input.cost_usd_micros)),
      request_id: input.request_id ?? null,
      governance_audit_id: input.governance_audit_id ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    /* meter is best-effort */
  }
}

/**
 * Estimator for the Gemini family — published rates as of writing.
 * Callers should pass the actual token usage; rates here are a
 * conservative ceiling and live in code so we can replace them when
 * pricing changes without touching the meter call sites.
 *
 * cost_usd_micros = tokens_in * input_rate + tokens_out * output_rate
 */
export const GEMINI_RATES_MICROS = {
  // micros per 1,000 tokens (= micro-USD per Ktok)
  'gemini-2.5-pro': { in: 1_250, out: 5_000 },
  'gemini-2.5-flash': { in: 75, out: 300 },
  'gemini-1.5-pro': { in: 1_250, out: 5_000 },
  'gemini-1.5-flash': { in: 75, out: 300 },
} as const;

export function estimateGeminiCostMicros(
  model: keyof typeof GEMINI_RATES_MICROS,
  tokens_in: number,
  tokens_out: number
): number {
  const r = GEMINI_RATES_MICROS[model] ?? GEMINI_RATES_MICROS['gemini-1.5-flash'];
  return Math.round((tokens_in / 1000) * r.in + (tokens_out / 1000) * r.out);
}

// ---------------------------------------------------------------------------
// Governance / Crisis counters — derived from the audit log, so the
// "counter" here is a small helper that emits a tagged metadata field
// when the route adds a row. The dashboards aggregate from the audit
// log directly.
// ---------------------------------------------------------------------------

export function tagGovernanceIntervention(
  meta: Record<string, unknown> | undefined,
  kind: 'blocked' | 'modification' | 'redirection' | 'safe_fallback'
) {
  return { ...(meta ?? {}), governance_intervention_kind: kind };
}

export function tagCrisisDetection(
  meta: Record<string, unknown> | undefined,
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
) {
  return { ...(meta ?? {}), crisis_level: level };
}

export const __test = {
  estimateGeminiCostMicros,
  GEMINI_RATES_MICROS,
  tagGovernanceIntervention,
  tagCrisisDetection,
};
