/**
 * Fraud validator (Principle 3 — Legal Compliance).
 *
 * Tax planning and benefits optimization are allowed; tax evasion,
 * application fraud, and concealment are not. The validator
 * distinguishes "legal optimization" (tax-loss harvesting, MAGI
 * management, ROTH conversions) from "evasion / concealment".
 */

import type { GovernanceSubject, GovernanceViolation } from '@/types/governance';

const TAX_EVASION =
  /\btax\s+evasion\b|\bhide\s+(?:income|assets)\s+from\s+(?:the\s+)?(?:IRS|HMRC|tax\s+authority)\b|\bunreported\s+income\b/i;

const APPLICATION_FRAUD =
  /\bfake\s+(?:tax\s+returns?|pay\s*stubs?|W-?2|1099|bank\s+statements?)\b|\blie\s+on\s+(?:the\s+)?(?:application|mortgage|loan|insurance\s+claim)\b|\bmisrepresent\s+(?:income|assets)\b/i;

const CONCEALMENT =
  /\bhide\s+(?:assets|accounts)\s+from\s+(?:my\s+)?(?:spouse|partner|creditors|court)\b|\bshell\s+compan(?:y|ies)\s+to\s+conceal\b|\bnominee\s+account\s+to\s+(?:hide|conceal)\b/i;

const INSURANCE_FRAUD =
  /\bstage\s+(?:an?\s+)?(?:accident|fire|injury)\b|\bfile\s+(?:a\s+)?false\s+(?:insurance|disability)\s+claim\b/i;

const IDENTITY_FRAUD =
  /\buse\s+(?:someone\s+else'?s|another\s+person'?s)\s+(?:identity|SSN|credit)\b|\bsynthetic\s+identity\s+fraud\b/i;

export function validateFraud(s: GovernanceSubject): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const text = (s.text ?? '') + ' ' + (s.action ?? '');
  if (TAX_EVASION.test(text)) {
    out.push({
      category: 'fraud',
      severity: 'critical',
      rule_id: 'fraud.tax_evasion',
      reason: 'Subject describes tax evasion rather than lawful tax planning.',
      principle: 'legal_compliance',
      safer_alternatives: [
        {
          label: 'Tax-loss harvesting',
          description: 'Realize losses to offset taxable gains within the rules.',
        },
        {
          label: 'Retirement contribution timing',
          description: 'Use legal deferral vehicles to reduce taxable income.',
        },
        {
          label: 'Charitable bunching',
          description: 'Group deductible contributions to exceed the standard-deduction threshold.',
        },
      ],
    });
  }
  if (APPLICATION_FRAUD.test(text)) {
    out.push({
      category: 'fraud',
      severity: 'critical',
      rule_id: 'fraud.application',
      reason: 'Subject describes falsifying an application or supporting document.',
      principle: 'legal_compliance',
    });
  }
  if (CONCEALMENT.test(text)) {
    out.push({
      category: 'fraud',
      severity: 'critical',
      rule_id: 'fraud.concealment',
      reason: 'Subject describes concealment of assets from a legitimate counterparty.',
      principle: 'legal_compliance',
    });
  }
  if (INSURANCE_FRAUD.test(text)) {
    out.push({
      category: 'fraud',
      severity: 'critical',
      rule_id: 'fraud.insurance',
      reason: 'Subject describes insurance fraud.',
      principle: 'legal_compliance',
    });
  }
  if (IDENTITY_FRAUD.test(text)) {
    out.push({
      category: 'fraud',
      severity: 'critical',
      rule_id: 'fraud.identity',
      reason: 'Subject describes identity fraud.',
      principle: 'legal_compliance',
    });
  }
  return out;
}

export const __test = {
  TAX_EVASION,
  APPLICATION_FRAUD,
  CONCEALMENT,
  INSURANCE_FRAUD,
  IDENTITY_FRAUD,
  validateFraud,
};
