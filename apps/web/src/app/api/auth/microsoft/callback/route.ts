/**
 * Microsoft OAuth callback — registered redirect URI path (`/api/auth/microsoft/callback`).
 *
 * Azure App Registration is configured to redirect here. The actual, tested handler lives at
 * `/api/integrations/oauth/callback/microsoft` (token exchange → encrypted Supabase store via
 * `upsert_integration_token` → audit log → safe redirect). This thin alias reuses that handler verbatim;
 * it is path-independent (reads `code`/`state` from the query, builds redirects from `request.url`).
 * Mirrors the Google `/api/auth/google/callback` scheme for a consistent OAuth surface.
 */
export { GET } from '@/app/api/integrations/oauth/callback/microsoft/route';

export const dynamic = 'force-dynamic';
