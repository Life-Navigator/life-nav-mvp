// Transient-error retry for Gemini calls. Kept in its own module so it can be
// unit-tested without importing the function's serve() entrypoint.
//
// Retry only transient provider failures: rate limit (429), provider overload
// (503), internal (500). Auth (401/403), validation (400), and safety blocks
// are NOT retried — safety blocks arrive as HTTP 200 with a blockReason, so
// they never reach this retry path.

export const GEMINI_RETRY_STATUSES = new Set([429, 500, 503]);
export const GEMINI_MAX_RETRIES = 3;
export const GEMINI_BACKOFF_MS = [400, 1000, 2200];
export const GEMINI_TIMEOUT_MS = 20_000;

export interface GeminiRetryOpts {
  maxRetries?: number;
  backoffMs?: number[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

/**
 * fetch() wrapper that retries transient Gemini failures with exponential
 * backoff + jitter. Hardened for the beta:
 *  - retries transient HTTP statuses (429/500/503) AND thrown errors (network
 *    drops, DNS, and per-attempt timeouts) — the latter were previously fatal
 *    and a leading cause of the chat 502s.
 *  - applies a per-attempt AbortSignal.timeout so a hung upstream can't stall.
 *  - if every attempt throws, returns a synthetic 503 Response (never throws),
 *    so callers' uniform `resp.ok` check handles it gracefully.
 * Logs only `label + status/error + attempt` — never prompts, payloads, user
 * data, or secrets.
 */
export async function geminiFetch(
  url: string,
  init: RequestInit,
  label: string,
  opts: GeminiRetryOpts = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? GEMINI_MAX_RETRIES;
  const backoff = opts.backoffMs ?? GEMINI_BACKOFF_MS;
  const timeoutMs = opts.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const rand = opts.rand ?? Math.random;

  const attemptFetch = (): Promise<Response> => {
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? (AbortSignal as { timeout(ms: number): AbortSignal }).timeout(timeoutMs)
        : undefined;
    return doFetch(url, signal ? { ...init, signal } : init);
  };

  let lastStatus = 0;
  let lastErr = '';
  // Total attempts = maxRetries + 1.
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let transient = false;
    try {
      const resp = await attemptFetch();
      if (resp.ok || !GEMINI_RETRY_STATUSES.has(resp.status)) return resp;
      lastStatus = resp.status;
      await resp.body?.cancel().catch(() => {});
      transient = true;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      transient = true; // network error / timeout — retry
    }
    if (!transient || attempt === maxRetries) break;
    const base = backoff[attempt] ?? backoff[backoff.length - 1];
    const delay = base + Math.floor(rand() * (base / 2)); // +0..50% jitter
    console.warn(
      `gemini ${label}: transient ${lastStatus || lastErr}; retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
    );
    await sleep(delay);
  }

  return new Response(
    JSON.stringify({ error: `gemini ${label} failed after retries`, status: lastStatus, detail: lastErr }),
    { status: lastStatus || 503, headers: { 'Content-Type': 'application/json' } },
  );
}
