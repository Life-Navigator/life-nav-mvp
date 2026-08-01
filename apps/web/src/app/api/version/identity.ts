/**
 * Web release identity — pure resolution, no framework imports.
 *
 * Split from route.ts deliberately: the resolver is the part that carries the correctness rules
 * (fail loudly where identity is gated, never leak infrastructure detail), and it must be testable
 * without pulling in `next/server`'s web globals. route.ts is then a thin HTTP shell over this.
 *
 * See route.ts for the full rationale on why the SHA is baked in at build time.
 */

/** Environments where an unproven identity is a hard failure, mirroring core-api. */
const IDENTITY_REQUIRED = new Set(['production', 'staging', 'candidate']);

export const DEV_PLACEHOLDER = 'development-unbuilt';

export type ReleaseIdentityResult =
  | { ok: true; status: 200; body: Record<string, string> }
  | { ok: false; status: 503; body: { error: string } };

export function resolveWebReleaseIdentity(
  env: NodeJS.ProcessEnv = process.env
): ReleaseIdentityResult {
  const environment = (env.NEXT_PUBLIC_LN_ENVIRONMENT || env.VERCEL_ENV || 'development')
    .trim()
    .toLowerCase();

  const commitSha = (env.NEXT_PUBLIC_LN_COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA || '').trim();
  const buildTime = (env.NEXT_PUBLIC_LN_BUILD_TIME || '').trim();
  const version = (env.NEXT_PUBLIC_LN_APP_VERSION || '').trim();

  if (!commitSha) {
    if (IDENTITY_REQUIRED.has(environment)) {
      // Loud, not silent — an identity endpoint that answers "unknown" looks like an answer.
      return {
        ok: false,
        status: 503,
        body: {
          error:
            'release identity unavailable: NEXT_PUBLIC_LN_COMMIT_SHA was not injected at build ' +
            `time and environment '${environment}' requires a provable commit`,
        },
      };
    }
    return {
      ok: true,
      status: 200,
      body: {
        service: 'lifenavigator-web',
        commit_sha: DEV_PLACEHOLDER,
        build_time: buildTime || 'unknown',
        environment,
      },
    };
  }

  const body: Record<string, string> = {
    service: 'lifenavigator-web',
    commit_sha: commitSha,
    build_time: buildTime || 'unknown',
    environment,
  };
  if (version) body.version = version;

  return { ok: true, status: 200, body };
}
