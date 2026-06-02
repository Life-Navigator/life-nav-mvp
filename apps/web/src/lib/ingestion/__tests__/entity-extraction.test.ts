/**
 * @jest-environment node
 *
 * Entity extraction tests — primitives + domain templates.
 */

import { __test as P } from '../entity-extraction/primitives';
import { __test as D } from '../entity-extraction/domain-templates';

const ctx = { default_locator: { page: 1 } };

describe('primitives', () => {
  test('ISO date', () => {
    const r = P.extractDates('Closing date: 2026-06-01.', ctx);
    expect(r.facts[0].object_date).toBe('2026-06-01');
    expect(r.facts[0].source_locator).toHaveProperty('char_start');
  });
  test('US date normalized to ISO', () => {
    const r = P.extractDates('Due 06/01/2026.', ctx);
    expect(r.facts.map((f) => f.object_date)).toContain('2026-06-01');
  });
  test('Long date normalized', () => {
    const r = P.extractDates('Effective June 1, 2026.', ctx);
    expect(r.facts.map((f) => f.object_date)).toContain('2026-06-01');
  });
  test('USD amount', () => {
    const r = P.extractAmounts('Total $1,234.56 paid.', ctx);
    expect(r.facts[0].object_value).toBeCloseTo(1234.56);
    expect(r.facts[0].object_unit).toBe('USD');
  });
  test('Account number is masked', () => {
    const r = P.extractAccountNumbers('Account # 1234567890', ctx);
    expect(r.facts[0].object_text).toMatch(/^\*+7890$/);
    expect(r.facts[0].evidence_text).not.toMatch(/1234567/);
  });
  test('SSN is always masked', () => {
    const r = P.extractSsns('SSN 123-45-6789', ctx);
    expect(r.facts[0].object_text).toBe('XXX-XX-6789');
    expect(r.facts[0].evidence_text).not.toMatch(/123-45-6789/);
  });
  test('Email normalized lowercase', () => {
    const r = P.extractEmails('Reach me at Alice@Example.COM.', ctx);
    expect(r.facts[0].object_text).toBe('alice@example.com');
  });
  test('US phone normalized to +1XXXXXXXXXX', () => {
    const r = P.extractPhones('Call (415) 555-1212.', ctx);
    expect(r.facts[0].object_text).toBe('+14155551212');
  });
  test('every emitted fact carries a non-empty locator', () => {
    const r = P.extractAllPrimitives('On 2026-06-01 send $20 to alice@ex.com.', ctx);
    for (const f of r.facts) {
      expect(Object.keys(f.source_locator).length).toBeGreaterThan(0);
    }
  });
});

describe('domain templates — financial statement', () => {
  test('extracts ending balance and account', () => {
    const text =
      'BANK STATEMENT\nAccount # 1234567890\nClosing balance: $5,432.10\nStatement period: June 1, 2026 to June 30, 2026.';
    const r = D.extractFinancialStatement(text, ctx);
    expect(
      r.facts.some((f) => f.predicate === 'statement_ending_balance' && f.object_value === 5432.1)
    ).toBe(true);
    expect(r.facts.some((f) => f.predicate === 'statement_period')).toBe(true);
    expect(r.entities.some((e) => e.entity_kind === 'account_number_masked')).toBe(true);
  });
  test('not financial → no emission', () => {
    expect(D.extractFinancialStatement('hello world', ctx).facts).toEqual([]);
  });
});

describe('domain templates — medical record', () => {
  test('extracts ICD-10 + lab + NPI', () => {
    const text =
      'Patient name: Doe. Diagnosis: E11.9 Diabetes. Glucose: 110.0 mg/dL. NPI: 1234567893.';
    const r = D.extractMedicalRecord(text, ctx);
    expect(r.facts.some((f) => f.predicate === 'diagnosis_code' && f.object_text === 'E11.9')).toBe(
      true
    );
    expect(r.facts.some((f) => f.predicate === 'lab_result' && f.object_value === 110)).toBe(true);
    expect(r.facts.some((f) => f.predicate === 'provider_npi')).toBe(true);
  });
});

describe('domain templates — insurance card', () => {
  test('extracts member id + group + carrier + policy', () => {
    const text =
      'INSURANCE CARD\nInsurance carrier: BlueCross\nMember ID: ABC1234567\nGroup number: 9988\nPolicy number: POL0001234';
    const r = D.extractInsuranceCard(text, ctx);
    const preds = r.facts.map((f) => f.predicate);
    expect(preds).toEqual(
      expect.arrayContaining([
        'insurance_member_id',
        'insurance_group_number',
        'insurance_policy_number',
        'insurance_carrier_name',
      ])
    );
  });
});

describe('domain templates — payroll', () => {
  test('extracts W-2 boxes + gross/net + period', () => {
    const text =
      'W-2 2025\nBox 1: 90000.00\nBox 2: 12000.00\nGross pay: $7,500.00\nNet pay: $5,250.00\nPay period: June 1, 2026 to June 15, 2026';
    const r = D.extractPayroll(text, ctx);
    expect(r.facts.filter((f) => f.predicate === 'w2_box_value').length).toBe(2);
    expect(
      r.facts.some((f) => f.predicate === 'paystub_gross_pay' && f.object_value === 7500)
    ).toBe(true);
    expect(r.facts.some((f) => f.predicate === 'paystub_net_pay' && f.object_value === 5250)).toBe(
      true
    );
    expect(r.facts.some((f) => f.predicate === 'paystub_pay_period')).toBe(true);
  });
});

describe('domain templates — receipt', () => {
  test('extracts merchant + subtotal + tax + total', () => {
    const text =
      'WHOLE FOODS\n\nApples 5.00\nBread 3.00\nSubtotal: $8.00\nTax: $0.64\nTotal: $8.64';
    const r = D.extractReceipt(text, ctx);
    const preds = r.facts.map((f) => f.predicate);
    expect(preds).toEqual(
      expect.arrayContaining([
        'receipt_subtotal',
        'receipt_tax',
        'receipt_total',
        'receipt_merchant_name',
      ])
    );
  });
});

describe('runDomainTemplates', () => {
  test('aggregates domain + primitive results', () => {
    const r = D.runDomainTemplates('Total $9.99 on 2026-06-01.', ctx);
    expect(r.facts.length).toBeGreaterThan(0);
    expect(r.facts.every((f) => Object.keys(f.source_locator).length > 0)).toBe(true);
  });
});
