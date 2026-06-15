import * as React from 'react';
import { Button, Column, Heading, Row, Section, Text } from '@react-email/components';
import { COLORS, FONTS } from './brand';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: '0 0 14px',
        color: COLORS.teal,
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.16em',
      }}
    >
      {children}
    </Text>
  );
}

export function Headline({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: '0 0 16px',
        color: COLORS.ink,
        fontFamily: FONTS.display,
        fontSize: '34px',
        lineHeight: 1.12,
        fontWeight: 500,
        letterSpacing: '-0.02em',
      }}
    >
      {children}
    </Heading>
  );
}

export function Lede({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: '0 0 26px', color: COLORS.inkSoft, fontSize: '16px', lineHeight: 1.65 }}>
      {children}
    </Text>
  );
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor: COLORS.tealDeep,
        backgroundImage: `linear-gradient(135deg, ${COLORS.tealDeep} 0%, ${COLORS.teal} 100%)`,
        color: '#04201c',
        fontSize: '15px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        textDecoration: 'none',
        padding: '15px 30px',
        borderRadius: '12px',
      }}
    >
      {children}
    </Button>
  );
}

/** Two-column grid of the six life domains — teal-tinted chips. */
export function DomainGrid({ domains }: { domains: readonly string[] }) {
  const rows: string[][] = [];
  for (let i = 0; i < domains.length; i += 2) rows.push(domains.slice(i, i + 2) as string[]);
  const chip = (label: string) => (
    <td
      key={label}
      style={{
        width: '50%',
        padding: '6px',
        verticalAlign: 'top',
      }}
    >
      <div
        style={{
          border: `1px solid ${COLORS.tealSoftBorder}`,
          backgroundColor: COLORS.tealSoftBg,
          borderRadius: '12px',
          padding: '13px 15px',
          color: COLORS.ink,
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </td>
  );
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '4px 0 28px' }}>
      <tbody>
        {rows.map((pair, i) => (
          <tr key={i}>
            {pair.map(chip)}
            {pair.length === 1 ? <td style={{ width: '50%' }} /> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A navy panel (matches dashboard cards). Children are rows. */
export function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Section
      style={{
        border: `1px solid ${COLORS.panelBorder}`,
        backgroundColor: COLORS.panelBg,
        borderRadius: '16px',
        padding: '20px 22px',
        margin: '0 0 18px',
      }}
    >
      {title ? (
        <Text
          style={{
            margin: '0 0 10px',
            color: COLORS.muted,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </Section>
  );
}

/**
 * A Life-Model status row — section name + an honest "not started" placeholder (NEVER a fabricated %).
 * Pass `status` text (e.g. "Not started") and a state for the dot colour.
 */
export function StatusRow({ label, status }: { label: string; status: string }) {
  return (
    <Row style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
      <Column style={{ padding: '11px 0' }}>
        <Text style={{ margin: 0, color: COLORS.inkSoft, fontSize: '15px' }}>{label}</Text>
      </Column>
      <Column align="right" style={{ padding: '11px 0' }}>
        <Text style={{ margin: 0, color: COLORS.muted, fontSize: '13px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: COLORS.faint,
              marginRight: '8px',
            }}
          />
          {status}
        </Text>
      </Column>
    </Row>
  );
}
