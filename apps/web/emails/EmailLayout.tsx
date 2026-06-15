import * as React from 'react';
import { Body, Container, Font, Head, Html, Preview, Section } from '@react-email/components';
import { COLORS, FONTS } from './brand';

/**
 * The premium navy shell shared by every LifeNavigator email. Dark-luxury card on a deep-navy page,
 * teal-accented, with the app's Newsreader display font progressively enhanced (serif fallback).
 */
export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <Font
          fontFamily="Newsreader"
          fallbackFontFamily="Georgia"
          webFont={{ url: FONTS.googleFontsHref, format: 'woff2' }}
          fontWeight={500}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: '32px 12px',
          backgroundColor: COLORS.pageBg,
          fontFamily: FONTS.body,
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            width: '100%',
            borderRadius: '20px',
            overflow: 'hidden',
            border: `1px solid ${COLORS.panelBorder}`,
            // Navy depth gradient — the "executive report" surface.
            backgroundColor: COLORS.cardBgMid,
            backgroundImage: `linear-gradient(160deg, ${COLORS.cardBgTop} 0%, ${COLORS.cardBgMid} 42%, ${COLORS.cardBgBottom} 100%)`,
          }}
        >
          <Section>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

export default EmailLayout;
