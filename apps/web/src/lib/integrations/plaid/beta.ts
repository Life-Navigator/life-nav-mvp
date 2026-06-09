import { NextResponse } from 'next/server';

/**
 * Sprint 42B — during beta, real bank linking is DISABLED. Users select an approved Plaid sandbox
 * persona instead (see /api/integrations/plaid/activate-persona). Real link flows (link-token,
 * exchange) are blocked unless ALLOW_REAL_PLAID_LINK=true (admin/dev escape hatch).
 */
export const BETA_SANDBOX_NOTICE =
  'During beta, LifeNavigator uses Plaid sandbox personas so you can test the platform safely without connecting real accounts.';

export function realLinkingDisabled(): boolean {
  return process.env.ALLOW_REAL_PLAID_LINK !== 'true';
}

/** Returns a 403 NextResponse if real linking is disabled, else null. */
export function blockRealLinkIfBeta(): NextResponse | null {
  if (!realLinkingDisabled()) return null;
  return NextResponse.json(
    {
      error: 'real_linking_disabled_in_beta',
      message: BETA_SANDBOX_NOTICE,
      use: '/api/integrations/plaid/activate-persona',
    },
    { status: 403 }
  );
}
