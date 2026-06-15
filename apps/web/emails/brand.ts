/**
 * LifeNavigator email brand — the single source of truth for the transactional email system.
 *
 * Visual identity: "dark luxury, navy base + teal accent" (the app's real teal, no invented gold).
 * Logo + fonts are the app's actual assets:
 *   - logo: apps/web/public/LifeNavigator.png, served publicly (used here by absolute URL so email
 *     clients can load it)
 *   - display type: Newsreader (the app's --font-display); body: the app's system/Geist stack
 *
 * Every email (auth templates rendered to Supabase HTML + Resend-sent Welcome/Activation) pulls colour,
 * type, logo, copy, and domain from here so branding stays consistent in one place.
 */

export const BRAND = {
  name: 'LifeNavigator',
  tagline: 'Your Personal Decision Intelligence Platform',
  eyebrow: 'DECISION INTELLIGENCE FOR LIFE',
  // Public absolute URL for the REAL app logo (apps/web/public/LifeNavigator.png).
  logoUrl: 'https://lifenavigator.tech/LifeNavigator.png',
  domain: 'lifenavigator.tech',
  appUrl: 'https://app.lifenavigator.tech',
  marketingUrl: 'https://lifenavigator.tech',
  supportEmail: 'support@lifenavigator.tech',
  privacyUrl: 'https://lifenavigator.tech/legal/privacy',
} as const;

/** Navy base + the app's real teal accent (no invented gold). Mirrors the app's dark-mode teal #2dd4bf. */
export const COLORS = {
  // navy depths (outer → card → panel)
  pageBg: '#060c16',
  cardBgTop: '#122b49',
  cardBgMid: '#0c1c33',
  cardBgBottom: '#081320',
  headerBg: '#081627',
  panelBg: 'rgba(255,255,255,0.045)',
  panelBorder: 'rgba(255,255,255,0.10)',
  hairline: 'rgba(255,255,255,0.08)',
  // type
  ink: '#eaf1fb',
  inkSoft: '#c2d2e6',
  muted: '#8fa3bd',
  faint: '#62758e',
  // teal accent (the app's brand accent)
  teal: '#2dd4bf',
  tealDeep: '#0d9488',
  tealSoftBg: 'rgba(45,212,191,0.10)',
  tealSoftBorder: 'rgba(45,212,191,0.34)',
  white: '#ffffff',
} as const;

export const FONTS = {
  // Display headlines — the app's Newsreader (with serif fallback for clients that block web fonts).
  display:
    "'Newsreader', Georgia, 'Times New Roman', ui-serif, serif",
  // Body/UI — system stack (email-safe; matches the app's Geist/system feel).
  body:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  googleFontsHref:
    'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap',
} as const;

/** The six life domains LifeNavigator reasons across (used in the hero grid). */
export const DOMAINS = [
  'Financial Health',
  'Family Protection',
  'Career Growth',
  'Education Planning',
  'Health Readiness',
  'Decision Intelligence',
] as const;

/** Life Model sections shown on the Welcome email (mirrors the dashboard's readiness sections). */
export const LIFE_MODEL_SECTIONS = ['Finance', 'Family', 'Career', 'Education', 'Health'] as const;
