/**
 * Resend sender for LifeNavigator's lifecycle emails (Welcome, Activation).
 *
 * NOTE: the auth emails (verify / magic-link / invite / recovery) are sent by Supabase Auth via SMTP
 * using the rendered templates in `supabase/email-templates/` — NOT this module. This module is for the
 * post-verification lifecycle emails that the app sends itself.
 *
 * Safe by default: if RESEND_API_KEY is absent the senders no-op (return {skipped:true}) instead of
 * throwing, so wiring them into a request path can never break it. Set RESEND_API_KEY + EMAIL_FROM
 * (domain lifenavigator.tech verified in Resend) to enable.
 */
import * as React from 'react';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { WelcomeEmail } from '../../../emails/WelcomeEmail';
import { ActivationEmail, type ActivationAction } from '../../../emails/ActivationEmail';

const FROM = `${process.env.EMAIL_FROM_NAME ?? 'LifeNavigator'} <${process.env.EMAIL_FROM ?? 'welcome@lifenavigator.tech'}>`;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

type SendResult = { skipped: true } | { id: string | null };

async function deliver(to: string, subject: string, html: string): Promise<SendResult> {
  const client = resend();
  if (!client) return { skipped: true };
  const { data } = await client.emails.send({ from: FROM, to, subject, html });
  return { id: data?.id ?? null };
}

/** Email 2 — "You're In. Welcome to LifeNavigator." (send once, e.g. on first onboarding completion). */
export async function sendWelcomeEmail(
  to: string,
  opts?: { ctaUrl?: string }
): Promise<SendResult> {
  const html = await render(React.createElement(WelcomeEmail, { ctaUrl: opts?.ctaUrl }));
  return deliver(to, "You're In. Welcome to LifeNavigator.", html);
}

/** Email 3 — "Your Life Model Is Ready To Begin." (activation nudge). */
export async function sendActivationEmail(
  to: string,
  opts?: { primaryUrl?: string; actions?: ActivationAction[] }
): Promise<SendResult> {
  const html = await render(
    React.createElement(ActivationEmail, { primaryUrl: opts?.primaryUrl, actions: opts?.actions })
  );
  return deliver(to, 'Your Life Model Is Ready To Begin', html);
}
