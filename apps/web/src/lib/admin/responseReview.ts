/**
 * Typed reviewer client for the advisor-response review queue (R-3 / B-27).
 *
 * THE SERVER REMAINS AUTHORITATIVE. This client cannot grant capability, cannot bypass a transition
 * rule, and deliberately exposes NO method for deleting a report, editing evidence, changing a
 * reporter/tenant/turn/category, touching feature flags, prompts, models, cohorts, or suspending a
 * user. Those operations are absent rather than guarded — an API you cannot call is stronger than
 * one you check for.
 *
 * A 403 is surfaced as `forbidden`, never as an empty queue. Rendering "no reports" for a denied
 * reviewer would hide an authorization failure behind a plausible empty state.
 */

export const REVIEW_STATUSES = [
  'new',
  'investigating',
  'resolved',
  'dismissed',
  'duplicate',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SEVERITIES = ['unclassified', 'low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Mirrors the server transition table. Advisory only — the server re-validates every transition. */
export const ALLOWED_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  new: ['investigating', 'dismissed', 'duplicate'],
  investigating: ['resolved', 'dismissed', 'duplicate'],
  resolved: ['investigating'],
  dismissed: ['investigating'],
  duplicate: ['investigating'],
};

/** Reopening a terminal state requires a reason; the server refuses without one. */
export const REOPEN_FROM: ReviewStatus[] = ['resolved', 'dismissed', 'duplicate'];

export function nextStatuses(current: ReviewStatus): ReviewStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function requiresReason(current: ReviewStatus): boolean {
  return REOPEN_FROM.includes(current);
}

/** Queue row — minimized by the API. No question/response snapshot, no explanation. */
export interface ReportSummary {
  report_id: string;
  turn_id: string;
  category: string;
  severity: Severity;
  review_status: ReviewStatus;
  assigned_to: string | null;
  created_at: string;
  deployment_version: string | null;
  prompt_version: string | null;
  model_name: string | null;
  duplicate_of: string | null;
}

export interface AuditEvent {
  event_id: string;
  action: string;
  actor_email: string;
  previous_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

/** Detail — preserved evidence, loaded only when a reviewer deliberately opens one report. */
export interface ReportDetail extends ReportSummary {
  explanation: string | null;
  question_snapshot: string | null;
  response_snapshot: string | null;
  citation_refs: unknown[] | null;
  retrieval_channels: unknown[] | null;
  model_provider: string | null;
  resolution_notes: string | null;
  conversation_id: string | null;
}

export interface QueueFilters {
  category?: string;
  review_status?: string;
  severity?: string;
  deployment_version?: string;
  prompt_version?: string;
  model_name?: string;
  assigned_to?: string;
}

export type ReviewOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'forbidden' }
  | { kind: 'not_found' }
  | { kind: 'rejected'; message: string }
  | { kind: 'error'; status: number }
  | { kind: 'network_error' };

export interface ReviewUpdate {
  assigned_to?: string;
  severity?: Severity;
  review_status?: ReviewStatus;
  note?: string;
  duplicate_of?: string;
  escalate?: boolean;
}

export const MAX_PAGE_SIZE = 100;

interface Options {
  fetchImpl?: typeof fetch;
}

export async function listReports(
  filters: QueueFilters = {},
  page: { limit?: number; offset?: number } = {},
  { fetchImpl = fetch }: Options = {}
): Promise<ReviewOutcome<{ reports: ReportSummary[]; limit: number; offset: number }>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  qs.set('limit', String(Math.min(page.limit ?? 25, MAX_PAGE_SIZE)));
  if (page.offset) qs.set('offset', String(page.offset));
  return request(`/api/admin/response-reports?${qs}`, { fetchImpl });
}

export async function getReport(
  reportId: string,
  { fetchImpl = fetch }: Options = {}
): Promise<ReviewOutcome<{ report: ReportDetail; audit_history: AuditEvent[] }>> {
  return request(`/api/admin/response-reports/${encodeURIComponent(reportId)}`, { fetchImpl });
}

export async function updateReport(
  reportId: string,
  update: ReviewUpdate,
  { fetchImpl = fetch }: Options = {}
): Promise<ReviewOutcome<{ report_id: string; updated: string[]; events: number }>> {
  // Built field-by-field — never spread — so no caller object can smuggle an evidence column.
  const body: ReviewUpdate = {};
  if (update.assigned_to) body.assigned_to = update.assigned_to;
  if (update.severity) body.severity = update.severity;
  if (update.review_status) body.review_status = update.review_status;
  if (update.note) body.note = update.note;
  if (update.duplicate_of) body.duplicate_of = update.duplicate_of;
  if (update.escalate) body.escalate = true;

  return request(`/api/admin/response-reports/${encodeURIComponent(reportId)}`, {
    fetchImpl,
    init: {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  });
}

async function request<T>(
  url: string,
  { fetchImpl, init }: { fetchImpl: typeof fetch; init?: RequestInit }
): Promise<ReviewOutcome<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch {
    return { kind: 'network_error' };
  }
  // 403 is surfaced explicitly. Collapsing it into an empty result would hide an authorization
  // failure behind a plausible "no reports" screen.
  if (res.status === 401 || res.status === 403) return { kind: 'forbidden' };
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 400) {
    const body = await safeJson(res);
    return { kind: 'rejected', message: readDetail(body) ?? 'That change was rejected.' };
  }
  if (res.status >= 200 && res.status < 300) {
    return { kind: 'ok', data: ((await safeJson(res)) ?? {}) as T };
  }
  return { kind: 'error', status: res.status };
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readDetail(body: Record<string, unknown> | null): string | null {
  const d = body?.detail;
  return typeof d === 'string' && d ? d : null;
}
