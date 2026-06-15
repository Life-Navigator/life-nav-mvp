import * as React from 'react';
import { Img, Section, Text } from '@react-email/components';
import { BRAND, COLORS } from './brand';

/**
 * Brand header: the REAL LifeNavigator logo (apps/web/public/LifeNavigator.png via absolute URL) on the
 * deep-navy band, with the eyebrow line. No generated/placeholder marks.
 */
export function EmailHeader({ eyebrow = BRAND.eyebrow }: { eyebrow?: string }) {
  return (
    <Section
      style={{
        backgroundColor: COLORS.headerBg,
        padding: '30px 32px 26px',
        borderBottom: `1px solid ${COLORS.hairline}`,
        textAlign: 'center',
      }}
    >
      <Img
        src={BRAND.logoUrl}
        alt="LifeNavigator"
        width={128}
        height={128}
        style={{ display: 'block', margin: '0 auto', width: '128px', height: 'auto' }}
      />
      <Text
        style={{
          margin: '14px 0 0',
          color: COLORS.teal,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.18em',
        }}
      >
        {eyebrow}
      </Text>
    </Section>
  );
}

export default EmailHeader;
