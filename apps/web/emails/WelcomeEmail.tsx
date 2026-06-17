import * as React from 'react';
import { Column, Row, Section, Text } from '@react-email/components';
import { BRAND, COLORS, LIFE_MODEL_SECTIONS } from './brand';
import { EmailLayout } from './EmailLayout';
import { EmailHeader } from './EmailHeader';
import { EmailFooter } from './EmailFooter';
import { CtaButton, Eyebrow, Headline, Lede, Panel, StatusRow } from './ui';

/**
 * Email 2 — Welcome (post-verification). Shows a Life Model status card in the dashboard's visual
 * language. Per the brief: do NOT fabricate percentages — every section shows an honest "Not started"
 * placeholder until real data exists.
 */
export function WelcomeEmail({ ctaUrl = `${BRAND.appUrl}/dashboard` }: { ctaUrl?: string }) {
  return (
    <EmailLayout preview="You're in. Let's build your Life Model.">
      <EmailHeader eyebrow="ACCOUNT VERIFIED" />
      <Section style={{ padding: '36px 36px 8px' }}>
        <Eyebrow>WELCOME TO THE PRIVATE BETA</Eyebrow>
        <Headline>Let&rsquo;s build your Life Model.</Headline>
        <Lede>
          Your account is active. LifeNavigator becomes more useful as it learns what matters to you,
          what you&rsquo;re building toward, and which decisions you need to make with confidence.
        </Lede>

        <Panel title="LIFE MODEL STATUS">
          {LIFE_MODEL_SECTIONS.map((s) => (
            <StatusRow key={s} label={s} status="Not started" />
          ))}
        </Panel>

        <Panel title="NEXT BEST ACTION">
          <Text style={{ margin: '0 0 16px', color: COLORS.inkSoft, fontSize: '15px', lineHeight: 1.6 }}>
            Begin with advisor discovery, or upload one important document — that&rsquo;s all it takes to
            start building your personalized Life Model.
          </Text>
          <CtaButton href={ctaUrl}>Start Building</CtaButton>
        </Panel>

        <Text style={{ margin: '4px 0 0', fontSize: '13px', color: COLORS.muted }}>
          Not a chatbot. A platform for life&rsquo;s biggest decisions.
        </Text>
      </Section>
      <EmailFooter beta="PRIVATE BETA MEMBER · Your feedback will directly shape the future of LifeNavigator." />
    </EmailLayout>
  );
}

export default WelcomeEmail;
