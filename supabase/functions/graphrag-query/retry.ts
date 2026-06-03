// Transient-error retry for Gemini calls. Kept in its own module so it can be
// unit-tested without importing the function's serve() entrypoint.
//
// Retry only transient provider failures: rate limit (429), provider overload
// (503), internal (500). Auth (401/403), validation (400), and safety blocks
// are NOT retried — safety blocks arrive as HTTP 200 with a blockReason, so
// they never reach this retry path.

export const GEMINI_RETRY_STATUSES = new Set([429, 500, 503]);
export const GEMINI_MAX_RETRIES = 2;
export const GEMINI_BACKOFF_MS = [500, 1500];

export interface GeminiRetryOpts {
  maxRetries?: number;
  backoffMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

/**
 * fetch() wrapper that retries transient Gemini errors with exponential
 * backoff + jitter (default max 2 retries: ~500ms, then ~1500ms). Returns the
 * final Response either way — callers still check `resp.ok`. Logs only
 * `label + status + attempt` — never prompts, payloads, user data, or secrets.
 */
export async function geminiFetch(
  url: string,
  init: RequestInit,
  label: string,
  opts: GeminiRetryOpts = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? GEMINI_MAX_RETRIES;
  const backoff = opts.backoffMs ?? GEMINI_BACKOFF_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const rand = opts.rand ?? Math.random;

  let resp = await doFetch(url, init);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (resp.ok || !GEMINI_RETRY_STATUSES.has(resp.status)) return resp;
    // Release the failed response body before retrying (avoid leaks).
    await resp.body?.cancel().catch(() => {});
    const base = backoff[attempt] ?? backoff[backoff.length - 1];
    const delay = base + Math.floor(rand() * (base / 2)); // +0..50% jitter
    console.warn(
      `gemini ${label}: transient ${resp.status}; retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
    );
    await sleep(delay);
    resp = await doFetch(url, init);
  }
  return resp;
}
