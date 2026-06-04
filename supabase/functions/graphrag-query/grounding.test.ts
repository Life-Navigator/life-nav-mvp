// Deno tests for the two-layer grounding helpers. Run: `deno test grounding.test.ts`
// These lock the FAIL-CLOSED behavior: when authoritative financial facts are
// absent, the prompt context must instruct refusal — never invention.
import {
  assert,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  type FinanceAccount,
  isDebtType,
  fmtMoney,
  formatAuthoritativeFinance,
  buildMissingData,
} from './grounding.ts';

const YP: FinanceAccount[] = [
  { account_name: 'Everyday Checking', account_type: 'checking', institution_name: null, current_balance: 3200, available_balance: 3200, interest_rate: null, credit_limit: null, currency: 'USD' },
  { account_name: 'Cash Rewards Card', account_type: 'credit_card', institution_name: null, current_balance: 640, available_balance: null, interest_rate: 0.2199, credit_limit: 5000, currency: 'USD' },
  { account_name: 'Emergency Savings', account_type: 'savings', institution_name: null, current_balance: 4800, available_balance: 4800, interest_rate: null, credit_limit: null, currency: 'USD' },
  { account_name: 'Student Loan', account_type: 'loan', institution_name: null, current_balance: 25000, available_balance: null, interest_rate: null, credit_limit: null, currency: 'USD' },
];

// (2) personal context answers the balance question correctly
Deno.test('authoritative facts render exact balances + APR', () => {
  const out = formatAuthoritativeFinance(YP);
  assertStringIncludes(out, '$3,200.00'); // checking
  assertStringIncludes(out, '$640.00'); // card owed
  assertStringIncludes(out, '21.99%'); // APR
  assertStringIncludes(out, '$25,000.00'); // loan
});

// net worth computed = (3200+4800) - (640+25000) = -17640, formatted -$17,640.00
Deno.test('net worth computed and negative formatted as -$17,640.00', () => {
  const out = formatAuthoritativeFinance(YP);
  assertStringIncludes(out, 'net worth -$17,640.00');
});

// (3) missing personal context refuses — empty accounts → explicit no-invent
Deno.test('empty accounts → refuse, never invent', () => {
  const out = formatAuthoritativeFinance([]);
  assertStringIncludes(out, 'NO financial accounts are on file');
  assertStringIncludes(out, 'do not state, estimate, or invent'.toLowerCase().slice(0, 5));
  assert(!/\$\d/.test(out), 'must contain no dollar amounts');
});

// (3b) system-of-record unreadable (null) → treat as unavailable
Deno.test('null accounts → unavailable, do not estimate', () => {
  const out = formatAuthoritativeFinance(null);
  assertStringIncludes(out, 'temporarily unavailable');
  assert(!/\$\d/.test(out), 'must contain no dollar amounts');
});

// MISSING_DATA anchors refusals for absent categories
Deno.test('missing-data lists accounts when none present', () => {
  assertStringIncludes(buildMissingData([]), 'none connected yet');
  assertStringIncludes(buildMissingData(null), 'temporarily unreadable');
  assertStringIncludes(buildMissingData(YP), 'Income / salary');
});

// debt vs asset classification drives net-worth sign
Deno.test('debt classification', () => {
  assert(isDebtType('credit_card'));
  assert(isDebtType('loan'));
  assert(isDebtType('mortgage'));
  assert(!isDebtType('checking'));
  assert(!isDebtType('savings'));
  assert(!isDebtType('investment'));
});

Deno.test('money formatting handles negatives and currency', () => {
  assert(fmtMoney(1234.5) === '$1,234.50');
  assert(fmtMoney(-17640) === '-$17,640.00');
  assert(fmtMoney(null) === 'unknown');
});
