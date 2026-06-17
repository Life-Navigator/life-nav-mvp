/**
 * Google OAuth callback — registered redirect URI path (`/api/auth/google/callback`).
 *
 * Google Cloud Console is configured to redirect here. The actual, tested handler lives at
 * `/api/integrations/oauth/callback/google` (token exchange → encrypted Supabase store via
 * `upsert_integration_token` → audit log → safe redirect). This route is a thin alias that reuses
 * that handler verbatim — no duplicated logic. The handler is path-independent (it reads `code`/`state`
 * from the query and builds redirects from `request.url`), so serving it here is safe.
 */
export { GET } from '@/app/api/integrations/oauth/callback/google/route';

export const dynamic = 'force-dynamic';
