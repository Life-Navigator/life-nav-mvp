import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { BRAND, COLORS, DOMAINS } from './brand';
import { EmailLayout } from './EmailLayout';
import { EmailHeader } from './EmailHeader';
import { EmailFooter } from './EmailFooter';
import { CtaButton, DomainGrid, Eyebrow, Headline, Lede } from './ui';

export interface EmailVerificationProps {
  confirmUrl: string;
  preview?: string;
  eyebrow?: string;
  headline?: React.ReactNode;
  lede?: React.ReactNode;
  ctaLabel?: string;
  showDomains?: boolean;
  expiryNote?: string;
}

/**
 * Email 1 — Verify Email (and, via props, the sibling Supabase auth emails: magic-link / invite /
 * recovery). This is the email Supabase Auth sends; `confirmUrl` is the action link — for the deployed
 * templates it is the literal Supabase token URL (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}…`).
 */
export function EmailVerification({
  confirmUrl,
  preview = 'Verify your email to activate LifeNavigator — your personal decision intelligence platform.',
  eyebrow = 'PRIVATE BETA ACCESS',
  headline = BRAND.tagline,
  lede = (
    <>
      A single place to understand how your finances, family, career, education, health, and major life
      decisions work together. Verify your email to activate your account.
    </>
  ),
  ctaLabel = 'Verify My Email',
  showDomains = true,
  expiryNote = 'This link expires in 24 hours. If you didn’t create a LifeNavigator account, you can safely ignore this email.',
}: EmailVerificationProps) {
  return (
    <EmailLayout preview={preview}>
      <EmailHeader />
      <Section style={{ padding: '36px 36px 8px' }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Headline>{headline}</Headline>
        <Lede>{lede}</Lede>
        {showDomains ? <DomainGrid domains={DOMAINS} /> : null}
        <CtaButton href={confirmUrl}>{ctaLabel}</CtaButton>
        <Text style={{ margin: '24px 0 0', fontSize: '13px', lineHeight: 1.6, color: COLORS.muted }}>
          Or paste this link into your browser:
          <br />
          <a href={confirmUrl} style={{ color: COLORS.teal, wordBreak: 'break-all' }}>
            {confirmUrl}
          </a>
        </Text>
        <Text style={{ margin: '18px 0 0', fontSize: '12px', color: COLORS.faint }}>{expiryNote}</Text>
      </Section>
      <EmailFooter beta="PRIVATE BETA MEMBER · Your feedback will directly shape the future of LifeNavigator." />
    </EmailLayout>
  );
}

export default EmailVerification;
