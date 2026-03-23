/**
 * Auth Journey Event Logger
 *
 * Lightweight observability for user authentication and onboarding flows.
 * Logs events that help diagnose "where did the user disappear?" during beta.
 *
 * In production, these can be forwarded to:
 * - Supabase security_audit_log table
 * - PostHog / Mixpanel / Amplitude
 * - Vercel Analytics custom events
 *
 * For now, logs to console in development and is a no-op in production
 * until an analytics provider is wired up.
 */

type AuthEvent =
  | 'signup_started'
  | 'signup_success'
  | 'signup_error'
  | 'login_started'
  | 'login_success'
  | 'login_error'
  | 'oauth_started'
  | 'oauth_callback_success'
  | 'oauth_callback_error'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_reset_error'
  | 'logout'
  | 'session_expired'
  | 'session_refreshed'
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_abandoned'
  | 'protected_route_blocked'
  | 'redirect_to_onboarding';

interface EventPayload {
  event: AuthEvent;
  userId?: string;
  provider?: string;
  step?: string | number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an auth journey event.
 * Safe to call from both client and server contexts.
 */
export function trackAuthEvent(payload: EventPayload): void {
  const timestamp = new Date().toISOString();
  const entry = { ...payload, timestamp };

  // Development: log to console for debugging
  if (process.env.NODE_ENV === 'development') {
    const icon = payload.event.includes('error')
      ? '!!'
      : payload.event.includes('success')
        ? 'OK'
        : '>>';
    console.log(`[auth:${icon}] ${payload.event}`, payload.metadata || '');
  }

  // Production: fire-and-forget to analytics endpoint
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Non-blocking POST to internal analytics endpoint
    fetch('/api/internal/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Analytics should never break the user flow
    });
  }
}
