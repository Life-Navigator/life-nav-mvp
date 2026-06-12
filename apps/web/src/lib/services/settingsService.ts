// Settings/Preferences service — writes to public.profiles (theme/locale/timezone/display_name)
// and public.user_preferences (notification + dashboard prefs), RLS-isolated by the authenticated
// session. Mirrors the alias+whitelist pattern used by careerService / familyService:
//   friendly form fields -> explicit alias mapping -> column WHITELIST (toRow) -> RLS write.
// Owned by Agent 3 (Profile/Settings). No other agent edits this file.
type SB = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Helpers ──────────────────────────────────────────────────────────────────
function nz(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

// ── profiles row (display preferences only — NO PII; PII lives in auth.user_metadata) ──
// Friendly settings-form names -> real public.profiles columns. Only allow-listed columns.
const THEMES = new Set(['light', 'dark', 'system']);
export function toProfilePrefsRow(body: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const theme = nz(body.theme);
  if (theme && THEMES.has(theme)) row.theme = theme;
  // friendly "language" (e.g. "en") -> locale ("en-US"); also accept a full locale.
  const language = nz(body.language);
  const locale = nz(body.locale);
  if (locale) row.locale = locale;
  else if (language) row.locale = language.includes('-') ? language : `${language}-US`;
  const timezone = nz(body.timezone);
  if (timezone) row.timezone = timezone;
  const colorScheme = nz(body.colorScheme ?? body.color_scheme);
  if (colorScheme) row.color_scheme = colorScheme;
  return row;
}

// ── user_preferences row (notification + dashboard prefs) ──────────────────────
// Friendly names -> real public.user_preferences columns. Unknown keys are dropped.
export function toUserPreferencesRow(
  userId: string,
  body: Record<string, unknown>,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  const prev = existing ?? {};
  // master "notificationsEnabled" toggle from the Preferences page gates the channel flags.
  const master = body.notificationsEnabled;
  const row: Record<string, unknown> = {
    user_id: userId,
    email_notifications: asBool(
      body.emailNotifications ?? (master !== undefined ? master : undefined),
      asBool(prev.email_notifications, true)
    ),
    push_notifications: asBool(
      body.pushNotifications ?? (master !== undefined ? master : undefined),
      asBool(prev.push_notifications, true)
    ),
    sms_notifications: asBool(body.smsNotifications, asBool(prev.sms_notifications, false)),
    daily_digest: asBool(body.dailyDigest, asBool(prev.daily_digest, false)),
    weekly_digest: asBool(
      body.weeklyDigest ?? body.weeklySummary,
      asBool(prev.weekly_digest, true)
    ),
    enable_gamification: asBool(body.enableGamification, asBool(prev.enable_gamification, true)),
    enable_social_features: asBool(
      body.enableSocialFeatures,
      asBool(prev.enable_social_features, false)
    ),
    updated_at: new Date().toISOString(),
  };
  // dashboard_layout is JSONB; persist friendly settings (layout choice, formats, currency) there
  // so the Preferences page round-trips without needing new columns.
  const layout: Record<string, unknown> = {
    ...(typeof prev.dashboard_layout === 'object' && prev.dashboard_layout
      ? (prev.dashboard_layout as Record<string, unknown>)
      : {}),
  };
  if (nz(body.dashboardLayout)) layout.layout = nz(body.dashboardLayout);
  if (nz(body.currency)) layout.currency = nz(body.currency);
  if (nz(body.timeFormat)) layout.timeFormat = nz(body.timeFormat);
  if (nz(body.dateFormat)) layout.dateFormat = nz(body.dateFormat);
  row.dashboard_layout = layout;
  return row;
}

export async function getUserPreferences(sb: SB, userId: string) {
  const { data, error } = await sb
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Upsert under the user session (RLS: user_id must equal auth.uid()). Stamps user_id from the
// verified session, never from the payload.
export async function upsertUserPreferences(sb: SB, userId: string, body: Record<string, unknown>) {
  const existing = await getUserPreferences(sb, userId);
  const row = toUserPreferencesRow(userId, body, existing ?? undefined);
  const { data, error } = await sb
    .from('user_preferences')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Map a stored user_preferences + profiles row back to the friendly shape the UI expects.
export function preferencesToApiShape(
  profile: Record<string, unknown> | null,
  prefs: Record<string, unknown> | null
) {
  const layout = (prefs?.dashboard_layout as Record<string, unknown> | undefined) ?? {};
  return {
    theme: (profile?.theme as string) || 'system',
    language: ((profile?.locale as string) || 'en-US').split('-')[0] || 'en',
    currency: (layout.currency as string) || 'USD',
    notificationsEnabled:
      prefs?.email_notifications !== undefined ? Boolean(prefs.email_notifications) : true,
    dashboardLayout: (layout.layout as string) || 'default',
    timeFormat: (layout.timeFormat as string) || '12h',
    dateFormat: (layout.dateFormat as string) || 'MM/DD/YYYY',
    emailNotifications:
      prefs?.email_notifications !== undefined ? Boolean(prefs.email_notifications) : true,
    pushNotifications:
      prefs?.push_notifications !== undefined ? Boolean(prefs.push_notifications) : true,
    smsNotifications: Boolean(prefs?.sms_notifications),
    dailyDigest: Boolean(prefs?.daily_digest),
    weeklyDigest: prefs?.weekly_digest !== undefined ? Boolean(prefs.weekly_digest) : true,
  };
}
