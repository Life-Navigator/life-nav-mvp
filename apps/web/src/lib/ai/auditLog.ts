// AI audit logging. Every model decision/call emits a structured record. NEVER logs raw user content
// unless AI_AUDIT_DEV_CONTENT=true (dev only). No tokens/secrets are ever logged.

import type { AiAuditRecord } from './types';
import { aiConfig } from './modelRegistry';

export type AuditSink = (record: AiAuditRecord) => void;

// Default sink: structured console line (no PII beyond ids). Swap in prod for your log pipeline.
const defaultSink: AuditSink = (r) => {
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.debug('[ai.audit]', JSON.stringify(r));
  }
};

let sink: AuditSink = defaultSink;

/** Replace the audit sink (e.g. ship to your logging backend, or capture in tests). */
export function setAuditSink(fn: AuditSink): void {
  sink = fn;
}
export function resetAuditSink(): void {
  sink = defaultSink;
}

let counter = 0;
/** Deterministic-ish request id without Date.now()/Math.random() coupling (safe in any env). */
export function newRequestId(prefix = 'ai'): string {
  counter = (counter + 1) % 1_000_000;
  const t =
    typeof performance !== 'undefined' && performance.now ? Math.floor(performance.now()) : counter;
  return `${prefix}_${t.toString(36)}_${counter.toString(36)}`;
}

/** Emit an audit record, stripping any raw content unless dev-content logging is explicitly enabled. */
export function emitAiAudit(record: AiAuditRecord): AiAuditRecord {
  const safe: AiAuditRecord = { ...record };
  if (!aiConfig.auditDevContent) delete safe.promptPreview;
  sink(safe);
  return safe;
}
