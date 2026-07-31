/**
 * Typed client for advisor-response reporting — audit finding R-3 / B-22.
 *
 * THE TRUST BOUNDARY THIS MODULE ENFORCES
 * ---------------------------------------
 * The request body carries exactly three fields. Identity, tenant, model, prompt version,
 * deployment version, routing, policy outcomes, feature flags and evidence metadata are ALL
 * resolved server-side from the authenticated session and the stored turn. Sending any of them
 * from the browser would make forged metadata indistinguishable from real metadata in a record
 * whose entire purpose is investigating what actually happened.
 *
 * `turn_id` is server-issued (core API `_finish()`). It is never generated, defaulted, or derived
 * here from an index, timestamp, conversation id or UUID.
 */

export const REPORT_CATEGORIES = [
  'wrong_or_unsupported',
  'inappropriate_or_harmful',
  'incorrect_or_irrelevant_citation',
  'outdated_information',
  'misunderstood_my_situation',
  'privacy_concern',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Human labels. Exported so the dialog cannot invent its own wording for a category. */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  wrong_or_unsupported: 'Wrong or unsupported',
  inappropriate_or_harmful: 'Inappropriate or harmful',
  incorrect_or_irrelevant_citation: 'Incorrect or irrelevant citation',
  outdated_information: 'Outdated information',
  misunderstood_my_situation: 'Misunderstood my situation',
  privacy_concern: 'Privacy concern',
  other: 'Other',
};

export const MAX_EXPLANATION_LENGTH = 4000;

/** The complete request body. Anything beyond these three fields is server-authoritative. */
export interface ResponseReportRequest {
  turn_id: string;
  category: ReportCategory;
  explanation?: string;
}

export type ResponseReportOutcome =
  | { kind: 'submitted'; reportId: string }
  | { kind: 'duplicate'; reportId: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'session_expired' }
  | { kind: 'unavailable' }
  | { kind: 'rate_limited'; retryAfterSeconds?: number }
  | { kind: 'server_error'; status: number }
  | { kind: 'network_error' };

/** Outcomes where retrying the same submission is sensible. */
export function isRetryable(outcome: ResponseReportOutcome): boolean {
  return (
    outcome.kind === 'network_error' ||
    outcome.kind === 'server_error' ||
    outcome.kind === 'rate_limited'
  );
}

export interface SubmitOptions {
  signal?: AbortSignal;
  /** Injected in tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export const RESPONSE_REPORT_ENDPOINT = '/api/life/advisor/response-report';

/**
 * Submit a report against one advisor response.
 *
 * Never throws for an expected API outcome — every case is a typed result, so a caller cannot
 * accidentally treat a rejected submission as success.
 */
export async function submitResponseReport(
  input: ResponseReportRequest,
  options: SubmitOptions = {}
): Promise<ResponseReportOutcome> {
  const { signal, fetchImpl = fetch } = options;

  // Guard the two things the server would reject anyway, so the user sees a message instead of a 400.
  if (!input.turn_id) return { kind: 'invalid', message: 'This response cannot be reported.' };
  if (!REPORT_CATEGORIES.includes(input.category)) {
    return { kind: 'invalid', message: 'Choose a category.' };
  }
  if (input.explanation && input.explanation.length > MAX_EXPLANATION_LENGTH) {
    return {
      kind: 'invalid',
      message: `Please keep your note under ${MAX_EXPLANATION_LENGTH} characters.`,
    };
  }

  // Built field-by-field, never spread from a wider object — a spread is how caller-supplied
  // tenant_id or model metadata would silently reach the wire.
  const body: ResponseReportRequest = {
    turn_id: input.turn_id,
    category: input.category,
  };
  if (input.explanation && input.explanation.trim()) body.explanation = input.explanation.trim();

  let res: Response;
  try {
    res = await fetchImpl(RESPONSE_REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    // Includes offline and abort. The caller keeps the user's explanation and offers retry.
    return { kind: 'network_error' };
  }

  if (res.status === 401 || res.status === 403) return { kind: 'session_expired' };
  if (res.status === 404) return { kind: 'unavailable' };
  if (res.status === 429) {
    const header = res.headers?.get?.('Retry-After');
    const parsed = header ? Number(header) : NaN;
    return {
      kind: 'rate_limited',
      retryAfterSeconds: Number.isFinite(parsed) ? parsed : undefined,
    };
  }

  if (res.status === 400) {
    const payload = await safeJson(res);
    return {
      kind: 'invalid',
      message: readDetail(payload) ?? 'Please check your report and try again.',
    };
  }

  if (res.status === 201 || res.status === 200) {
    const payload = await safeJson(res);
    const reportId = typeof payload?.report_id === 'string' ? payload.report_id : '';
    return payload?.duplicate === true
      ? { kind: 'duplicate', reportId }
      : { kind: 'submitted', reportId };
  }

  return { kind: 'server_error', status: res.status };
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readDetail(payload: Record<string, unknown> | null): string | null {
  const detail = payload?.detail;
  return typeof detail === 'string' && detail ? detail : null;
}
