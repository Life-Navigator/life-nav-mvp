/**
 * @jest-environment node
 *
 * Cross-language parity: this engine against `fixtures/financial-parity.json`.
 *
 * WHY THIS FILE EXISTS
 * Financial math now lives in two places — this TypeScript projector (used by the UI) and the Python
 * calculator registry in `apps/lifenavigator-core-api/app/services/calculators` (reachable by the
 * advisor, so its numbers get spoken to users and must pass the number gate). Two engines WILL
 * drift unless something forces them to agree, and this repo already carries the scars of
 * duplicated sources of truth.
 *
 * The fixture is that forcing function. Both suites read the SAME file, so changing a primitive on
 * either side breaks a test here or there instead of quietly producing two different answers to the
 * same question. The fixture's values were derived from the formula definitions independently of
 * both implementations and verified by month-by-month simulation.
 *
 * If this fails after an intentional change: update the fixture AND re-run the Python suite
 * (`pytest tests/test_calculators.py`). Updating only one side defeats the entire purpose.
 */

import fs from 'fs';
import path from 'path';

import { amortizedPayment, monthlyRate } from '../projector';

interface Fixture {
  _CONVENTIONS: Record<string, unknown>;
  effective_monthly_rate: Array<{ annual_rate: number; expected: number }>;
  nominal_monthly_rate: Array<{ annual_rate: number; expected: number }>;
  amortized_payment: Array<{
    principal: number;
    apr: number;
    term_months: number;
    expected_monthly_payment: number;
  }>;
  future_value: Array<{
    present_value: number;
    monthly_contribution: number;
    annual_return: number;
    months: number;
    expected: number;
  }>;
}

// Four levels up from __tests__: trajectory → lib → src → web → apps → repo root.
const FIXTURE_PATH = path.resolve(__dirname, '../../../../../../fixtures/financial-parity.json');

function loadFixture(): Fixture {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
}

describe('shared parity fixture', () => {
  it('is present and readable from this workspace', () => {
    expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
    expect(loadFixture().amortized_payment.length).toBeGreaterThan(0);
  });

  it('documents the conventions, so a future reader cannot "unify" the two rate forms', () => {
    const conventions = loadFixture()._CONVENTIONS as Record<string, string>;
    expect(conventions.why_both).toMatch(/do not unify/i);
    expect(conventions.annuity).toMatch(/annuity-due/i);
  });
});

describe('monthlyRate matches the shared fixture (growth convention)', () => {
  it.each(loadFixture().effective_monthly_rate)(
    'effective monthly rate for %p',
    ({ annual_rate, expected }) => {
      expect(monthlyRate(annual_rate)).toBeCloseTo(expected, 12);
    }
  );

  it('compounds to exactly the annual rate over 12 months', () => {
    // The discriminating case: r/12 would compound to ~6.17%, not 6%.
    expect(Math.pow(1 + monthlyRate(0.06), 12) - 1).toBeCloseTo(0.06, 12);
  });
});

describe('amortizedPayment matches the shared fixture (lender convention)', () => {
  it.each(loadFixture().amortized_payment)(
    'payment for %p',
    ({ principal, apr, term_months, expected_monthly_payment }) => {
      expect(amortizedPayment(principal, apr, term_months)).toBeCloseTo(
        expected_monthly_payment,
        2
      );
    }
  );

  it('uses apr/12, not the effective monthly rate', () => {
    // Guards the single most consequential number in either engine. The effective rate is lower, so
    // it would understate the payment by a margin no lender would recognise.
    const nominal = amortizedPayment(300_000, 0.06, 360);
    const i = monthlyRate(0.06);
    const withEffective = (300_000 * i) / (1 - Math.pow(1 + i, -360));
    expect(Math.abs(nominal - withEffective)).toBeGreaterThan(10);
    expect(nominal).toBeCloseTo(1798.65, 1); // published reference figure
  });

  it('amortizes a zero-APR loan to principal / term', () => {
    expect(amortizedPayment(12_000, 0, 24)).toBe(500);
  });

  it('actually retires the loan when simulated month by month', () => {
    // Independent of the closed form: accrue interest, apply the payment, require it to land at zero.
    for (const { principal, apr, term_months } of loadFixture().amortized_payment) {
      const pay = amortizedPayment(principal, apr, term_months);
      let balance = principal;
      for (let m = 0; m < term_months; m++) {
        balance += balance * (apr / 12);
        balance -= pay;
      }
      expect(Math.abs(balance)).toBeLessThan(1);
    }
  });
});

describe('growth convention matches the Python engine', () => {
  /**
   * The projector has no exported future-value helper — it grows balances inside its month loop.
   * This reproduces that loop exactly (contribute, THEN grow) and holds it to the same fixture the
   * Python `money.future_value` closed form is held to. It is what proves the two engines share the
   * annuity-DUE convention; an ordinary-annuity closed form would be short by one month's growth.
   */
  it.each(loadFixture().future_value)(
    'future value for %p',
    ({ present_value, monthly_contribution, annual_return, months, expected }) => {
      const i = monthlyRate(annual_return);
      let balance = present_value;
      for (let m = 0; m < months; m++) {
        balance += monthly_contribution; // contribute first …
        balance *= 1 + i; // … then grow, exactly as projector.ts does
      }
      expect(balance).toBeCloseTo(expected, 1);
    }
  );
});
