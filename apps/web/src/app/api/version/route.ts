/**
 * Web release identity.
 *
 * GET /api/version — WHAT COMMIT IS ACTUALLY SERVING. Nothing else.
 *
 * Counterpart to core-api's GET /version. Together they let anyone — including an auditor with no
 * platform credentials — prove that the reviewed candidate SHA is the SHA running on both tiers.
 * The 2026-07-30 beta audit could not answer that question for either tier, which left Gate H
 * ("deployment confidence") unverifiable and every other gate result provisional.
 *
 * SHA SOURCE. Vercel injects VERCEL_GIT_COMMIT_SHA at build time. We re-export it through
 * NEXT_PUBLIC_LN_COMMIT_SHA in next.config.ts so the value is baked into the build output rather
 * than read from the runtime environment — a runtime read would report whatever the serving
 * environment happens to hold, which is exactly the ambiguity this endpoint exists to remove.
 *
 * WHAT MUST NEVER APPEAR HERE: private environment variables, hostnames, project or team ids,
 * deployment URLs, database names, or any dependency status. This route is publicly reachable by
 * design; the moment it carries infrastructure detail it becomes a reconnaissance surface.
 *
 * Resolution logic lives in ./identity.ts so it is testable without next/server's web globals.
 */
import { NextResponse } from 'next/server';

import { resolveWebReleaseIdentity } from './identity';

// Identity must reflect the build, never a cached edge object.
export const dynamic = 'force-dynamic';

export async function GET() {
  const identity = resolveWebReleaseIdentity();
  const response = NextResponse.json(identity.body, { status: identity.status });
  // Also expose it as a header so the SHA is readable from a HEAD request and from any proxy log
  // that never parses the body.
  if (identity.ok) {
    response.headers.set('X-LifeNavigator-Commit', identity.body.commit_sha);
  }
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
