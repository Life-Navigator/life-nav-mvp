/**
 * Renders the React Email components to static HTML.
 *  - Supabase Auth templates (confirmation/magic_link/invite/recovery) → supabase/email-templates/*.html
 *    with the literal Supabase Go tokens ({{ .SiteURL }}, {{ .TokenHash }}) baked into the action link.
 *  - Welcome + Activation → emails/out/*.html (previews + the bodies the Resend sender uses).
 *
 * Run:  pnpm --filter web email:build   (or:  pnpm tsx emails/build.tsx)
 */
import { render } from '@react-email/render';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { EmailVerification } from './EmailVerification';
import { WelcomeEmail } from './WelcomeEmail';
import { ActivationEmail } from './ActivationEmail';

const here = dirname(fileURLToPath(import.meta.url));
const SUPABASE_DIR = resolve(here, '../../../supabase/email-templates');
const OUT_DIR = resolve(here, 'out');
mkdirSync(OUT_DIR, { recursive: true });

const link = (type: string, next: string) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;

async function writeHtml(path: string, el: React.ReactElement) {
  const html = await render(el, { pretty: true });
  writeFileSync(path, html, 'utf8');
  return html.length;
}

const tasks: Array<[string, React.ReactElement]> = [
  // ----- Supabase Auth templates (these are what actually send on signup / sign-in) -----
  [
    `${SUPABASE_DIR}/confirmation.html`,
    <EmailVerification confirmUrl={link('signup', '/onboarding')} />,
  ],
  [
    `${SUPABASE_DIR}/magic_link.html`,
    <EmailVerification
      confirmUrl={link('magiclink', '/dashboard')}
      preview="Your secure LifeNavigator sign-in link."
      eyebrow="SECURE SIGN-IN"
      headline="Sign in to LifeNavigator"
      lede="Use the button below to securely sign in. No password required."
      ctaLabel="Sign In Securely"
      showDomains={false}
      expiryNote="This link expires in 1 hour and can be used once. If you didn’t request it, you can safely ignore this email."
    />,
  ],
  [
    `${SUPABASE_DIR}/invite.html`,
    <EmailVerification
      confirmUrl={link('invite', '/onboarding')}
      preview="You’ve been invited to LifeNavigator — your personal decision intelligence platform."
      eyebrow="PRIVATE BETA INVITATION"
      headline="You’ve been invited to LifeNavigator"
      lede="You’ve been invited to the private beta of LifeNavigator — a single place to understand how your finances, family, career, education, health, and major life decisions work together. Accept your invitation to begin."
      ctaLabel="Accept Invitation"
      expiryNote="If you weren’t expecting this invitation, you can safely ignore this email."
    />,
  ],
  [
    `${SUPABASE_DIR}/recovery.html`,
    <EmailVerification
      confirmUrl={link('recovery', '/auth/password-reset')}
      preview="Reset your LifeNavigator password."
      eyebrow="ACCOUNT SECURITY"
      headline="Reset your password"
      lede="We received a request to reset your LifeNavigator password. Use the button below to choose a new one."
      ctaLabel="Reset Password"
      showDomains={false}
      expiryNote="This link expires in 1 hour. If you didn’t request a password reset, you can safely ignore this email — your password won’t change."
    />,
  ],
  // ----- Resend-sent lifecycle emails (previews + sender bodies) -----
  [`${OUT_DIR}/welcome.html`, <WelcomeEmail />],
  [`${OUT_DIR}/activation.html`, <ActivationEmail />],
  // verification preview with a real-looking URL (for screenshots / QA)
  [
    `${OUT_DIR}/verification.preview.html`,
    <EmailVerification confirmUrl="https://app.lifenavigator.tech/auth/confirm?token_hash=EXAMPLE_TOKEN&type=signup&next=/onboarding" />,
  ],
];

async function main() {
  for (const [path, el] of tasks) {
    const n = await writeHtml(path, el);
    console.log(`wrote ${path}  (${n} bytes)`);
  }
  console.log('\n✓ email build complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
