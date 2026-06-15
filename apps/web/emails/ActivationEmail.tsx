import * as React from 'react';
import { Link, Section, Text } from '@react-email/components';
import { BRAND, COLORS } from './brand';
import { EmailLayout } from './EmailLayout';
import { EmailHeader } from './EmailHeader';
import { EmailFooter } from './EmailFooter';
import { CtaButton, Eyebrow, Headline, Lede, Panel } from './ui';

export interface ActivationAction {
  label: string;
  detail: string;
  href: string;
}

const DEFAULT_ACTIONS: ActivationAction[] = [
  {
    label: 'Continue advisor discovery',
    detail: 'A few questions so your plan reflects what actually matters to you.',
    href: `${BRAND.appUrl}/dashboard/advisor`,
  },
  {
    label: 'Upload a document',
    detail: 'A statement, policy, or offer — we extract what matters, you keep control.',
    href: `${BRAND.appUrl}/dashboard/documents`,
  },
  {
    label: 'Add a family member',
    detail: 'Bring the people your decisions protect into the picture.',
    href: `${BRAND.appUrl}/dashboard/family`,
  },
];

/**
 * Email 3 — First Action (activation). One clear next best action + a couple of starters, each a real
 * deep-link into the platform.
 */
export function ActivationEmail({
  primaryUrl = `${BRAND.appUrl}/dashboard/advisor`,
  actions = DEFAULT_ACTIONS,
}: {
  primaryUrl?: string;
  actions?: ActivationAction[];
}) {
  return (
    <EmailLayout preview="Your Life Model is ready to begin — here's your next best action.">
      <EmailHeader eyebrow="YOUR LIFE MODEL" />
      <Section style={{ padding: '36px 36px 8px' }}>
        <Eyebrow>NEXT BEST ACTION</Eyebrow>
        <Headline>Your Life Model is ready to begin.</Headline>
        <Lede>
          One step starts everything. Pick the action that fits where you are right now — each one makes
          your guidance sharper and your decisions more grounded.
        </Lede>
        <CtaButton href={primaryUrl}>Continue Where You Left Off</CtaButton>

        <Section style={{ height: '24px' }} />

        <Panel title="WAYS TO BEGIN">
          {actions.map((a, i) => (
            <div
              key={a.label}
              style={{
                paddingTop: i === 0 ? 0 : '14px',
                marginTop: i === 0 ? 0 : '14px',
                borderTop: i === 0 ? 'none' : `1px solid ${COLORS.hairline}`,
              }}
            >
              <Link href={a.href} style={{ color: COLORS.teal, fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}>
                {a.label} &rarr;
              </Link>
              <Text style={{ margin: '4px 0 0', color: COLORS.muted, fontSize: '13px', lineHeight: 1.55 }}>
                {a.detail}
              </Text>
            </div>
          ))}
        </Panel>
      </Section>
      <EmailFooter beta="PRIVATE BETA MEMBER · Your feedback will directly shape the future of LifeNavigator." />
    </EmailLayout>
  );
}

export default ActivationEmail;
