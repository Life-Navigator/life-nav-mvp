import * as React from 'react';
import { Hr, Link, Section, Text } from '@react-email/components';
import { BRAND, COLORS } from './brand';

/**
 * Shared footer: private-beta note (optional), support, privacy, copyright. Muted on navy.
 */
export function EmailFooter({ beta }: { beta?: string }) {
  return (
    <Section style={{ padding: '8px 32px 30px' }}>
      <Hr style={{ borderColor: COLORS.hairline, margin: '0 0 18px' }} />
      {beta ? (
        <Text
          style={{
            margin: '0 0 12px',
            color: COLORS.teal,
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {beta}
        </Text>
      ) : null}
      <Text style={{ margin: '0 0 4px', fontSize: '12px', color: COLORS.faint }}>
        Need help?{' '}
        <Link href={`mailto:${BRAND.supportEmail}`} style={{ color: COLORS.muted, textDecoration: 'none' }}>
          {BRAND.supportEmail}
        </Link>
      </Text>
      <Text style={{ margin: 0, fontSize: '12px', color: COLORS.faint }}>
        © 2026 {BRAND.name} ·{' '}
        <Link href={BRAND.privacyUrl} style={{ color: COLORS.muted, textDecoration: 'none' }}>
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href={BRAND.marketingUrl} style={{ color: COLORS.muted, textDecoration: 'none' }}>
          {BRAND.domain}
        </Link>
      </Text>
    </Section>
  );
}

export default EmailFooter;
