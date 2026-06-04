import 'server-only';

/**
 * Plaid Sandbox `user_custom` configs — SERVER ONLY.
 *
 * Each config is passed as `options.override_password` (JSON-stringified) with
 * `override_username: "user_custom"` to /sandbox/public_token/create, producing
 * a materially different synthetic account set per persona (different account
 * mix, balances, credit limits, and signature cash-flow). Never sent to the
 * client.
 *
 * Schema: { override_accounts: [{ type, subtype, starting_balance, meta:{name,
 * limit?}, liability?, transactions:[{date_transacted,date_posted,amount,
 * description,currency}] }] }. Plaid amounts: positive = money out.
 */

type Txn = {
  date_transacted: string;
  date_posted: string;
  amount: number;
  description: string;
  currency: string;
};
type Account = {
  type: string;
  subtype: string;
  starting_balance: number;
  meta: { name: string; limit?: number };
  liability?: Record<string, unknown>;
  transactions: Txn[];
};
export type PlaidCustomConfig = { override_accounts: Account[] };

// Recent-ish fixed dates (deterministic, no Date.now()).
const D = (mmdd: string) => `2026-${mmdd}`;
const tx = (date: string, amount: number, description: string): Txn => ({
  date_transacted: date,
  date_posted: date,
  amount,
  description,
  currency: 'USD',
});
const creditLiability = (apr: number, minPay: number, overdue = false) => ({
  type: 'credit',
  credit: {
    aprs: [{ apr_percentage: apr, apr_type: 'purchase_apr' }],
    is_overdue: overdue,
    last_payment_amount: minPay,
    minimum_payment_amount: minPay,
  },
});

export const PLAID_CUSTOM_CONFIGS: Record<string, PlaidCustomConfig> = {
  young_professional: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 3200,
        meta: { name: 'Everyday Checking' },
        transactions: [
          tx(D('05-31'), -2150, 'EMPLOYER PAYROLL'),
          tx(D('05-15'), -2150, 'EMPLOYER PAYROLL'),
          tx(D('05-02'), 1300, 'APT RENT'),
          tx(D('05-06'), 92.4, 'TRADER JOES'),
          tx(D('05-09'), 15.99, 'STREAMING SUB'),
          tx(D('05-20'), 410, 'STUDENT LOAN PMT'),
        ],
      },
      {
        type: 'depository',
        subtype: 'savings',
        starting_balance: 4800,
        meta: { name: 'Emergency Savings' },
        transactions: [tx(D('05-16'), -300, 'TRANSFER TO SAVINGS')],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 640,
        meta: { name: 'Cash Rewards Card', limit: 5000 },
        liability: creditLiability(21.99, 35),
        transactions: [tx(D('05-11'), 58.2, 'GAS STATION')],
      },
      {
        type: 'loan',
        subtype: 'student',
        starting_balance: 18400,
        meta: { name: 'Student Loan' },
        transactions: [],
      },
    ],
  },
  small_business_owner: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 28400,
        meta: { name: 'Business Operating' },
        transactions: [
          tx(D('05-28'), -8200, 'CLIENT INVOICE 1042'),
          tx(D('05-14'), -5400, 'CLIENT INVOICE 1041'),
          tx(D('05-30'), 6100, 'PAYROLL RUN'),
          tx(D('05-12'), 1850, 'SUPPLIER AP'),
          tx(D('05-21'), 480, 'SOFTWARE SAAS'),
        ],
      },
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 5200,
        meta: { name: 'Owner Personal Checking' },
        transactions: [tx(D('05-25'), -3000, 'OWNER DRAW')],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 6240,
        meta: { name: 'Business Card', limit: 25000 },
        liability: creditLiability(18.49, 200),
        transactions: [tx(D('05-18'), 920, 'OFFICE SUPPLY')],
      },
      {
        type: 'loan',
        subtype: 'business',
        starting_balance: 64000,
        meta: { name: 'SBA Term Loan' },
        transactions: [],
      },
    ],
  },
  married_family: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 9400,
        meta: { name: 'Joint Checking' },
        transactions: [
          tx(D('05-31'), -3100, 'SPOUSE A PAYROLL'),
          tx(D('05-31'), -2700, 'SPOUSE B PAYROLL'),
          tx(D('05-03'), 2350, 'MORTGAGE PMT'),
          tx(D('05-07'), 240, 'CHILDCARE'),
          tx(D('05-10'), 318, 'COSTCO'),
        ],
      },
      {
        type: 'depository',
        subtype: 'savings',
        starting_balance: 22000,
        meta: { name: '529 / Family Savings' },
        transactions: [tx(D('05-16'), -500, 'COLLEGE SAVINGS')],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 2840,
        meta: { name: 'Family Rewards Card', limit: 18000 },
        liability: creditLiability(20.24, 90),
        transactions: [tx(D('05-13'), 142, 'GROCERY')],
      },
      {
        type: 'loan',
        subtype: 'mortgage',
        starting_balance: 384000,
        meta: { name: 'Home Mortgage' },
        transactions: [],
      },
      {
        type: 'loan',
        subtype: 'auto',
        starting_balance: 21500,
        meta: { name: 'Auto Loan' },
        transactions: [],
      },
    ],
  },
  salary_plus_bonus: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 14200,
        meta: { name: 'Primary Checking' },
        transactions: [
          tx(D('05-31'), -4200, 'BASE SALARY'),
          tx(D('05-15'), -4200, 'BASE SALARY'),
          tx(D('05-20'), -12000, 'Q2 BONUS'),
          tx(D('05-05'), 1900, 'RENT'),
        ],
      },
      {
        type: 'investment',
        subtype: 'brokerage',
        starting_balance: 86000,
        meta: { name: 'Taxable Brokerage' },
        transactions: [],
      },
      {
        type: 'investment',
        subtype: '401k',
        starting_balance: 142000,
        meta: { name: '401(k)' },
        transactions: [],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 1820,
        meta: { name: 'Travel Card', limit: 20000 },
        liability: creditLiability(19.99, 60),
        transactions: [tx(D('05-09'), 410, 'AIRLINE')],
      },
    ],
  },
  high_income_executive: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 58200,
        meta: { name: 'Executive Checking' },
        transactions: [
          tx(D('05-31'), -11800, 'EXEC SALARY'),
          tx(D('05-15'), -11800, 'EXEC SALARY'),
          tx(D('05-04'), 4800, 'PROPERTY MGMT'),
        ],
      },
      {
        type: 'depository',
        subtype: 'money market',
        starting_balance: 145000,
        meta: { name: 'Money Market' },
        transactions: [],
      },
      {
        type: 'investment',
        subtype: 'brokerage',
        starting_balance: 920000,
        meta: { name: 'Investment Portfolio' },
        transactions: [],
      },
      {
        type: 'investment',
        subtype: 'ira',
        starting_balance: 410000,
        meta: { name: 'Backdoor Roth IRA' },
        transactions: [],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 3120,
        meta: { name: 'Signature Card', limit: 75000 },
        liability: creditLiability(17.99, 200),
        transactions: [tx(D('05-12'), 980, 'FINE DINING')],
      },
      {
        type: 'loan',
        subtype: 'mortgage',
        starting_balance: 1240000,
        meta: { name: 'Jumbo Mortgage' },
        transactions: [],
      },
    ],
  },
  credit_rebuilding: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 420,
        meta: { name: 'Basic Checking' },
        transactions: [
          tx(D('05-30'), -1480, 'HOURLY PAYROLL'),
          tx(D('05-16'), -1480, 'HOURLY PAYROLL'),
          tx(D('05-06'), 35, 'OVERDRAFT FEE'),
          tx(D('05-09'), 95, 'PAYDAY LOAN PMT'),
        ],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 920,
        meta: { name: 'Secured Card', limit: 1000 },
        liability: creditLiability(27.99, 41, true),
        transactions: [tx(D('05-14'), 60, 'PHONE BILL')],
      },
      {
        // Plaid sandbox override rejects loan subtype 'personal' (INVALID_
        // CREDENTIALS) — 'consumer' is the valid subtype for a personal loan.
        type: 'loan',
        subtype: 'consumer',
        starting_balance: 5200,
        meta: { name: 'Personal Loan (collections)' },
        transactions: [],
      },
    ],
  },
  gig_worker: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 6100,
        meta: { name: '1099 Checking' },
        transactions: [
          tx(D('05-29'), -2200, 'CLIENT A DEPOSIT'),
          tx(D('05-19'), -1400, 'CLIENT B DEPOSIT'),
          tx(D('05-09'), -800, 'PLATFORM PAYOUT'),
          tx(D('05-21'), 1200, 'EST QUARTERLY TAX'),
          tx(D('05-11'), 240, 'HOME OFFICE'),
        ],
      },
      {
        type: 'investment',
        subtype: 'ira',
        starting_balance: 38000,
        meta: { name: 'SEP-IRA' },
        transactions: [],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 1340,
        meta: { name: 'Business Rewards', limit: 12000 },
        liability: creditLiability(22.49, 45),
        transactions: [tx(D('05-15'), 180, 'CLOUD HOSTING')],
      },
    ],
  },
  earned_wage_access: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 180,
        meta: { name: 'Spending Checking' },
        transactions: [
          tx(D('05-31'), -760, 'BIWEEKLY PAYROLL'),
          tx(D('05-26'), -120, 'EWA ADVANCE'),
          tx(D('05-22'), -90, 'EWA ADVANCE'),
          tx(D('05-17'), -110, 'EWA ADVANCE'),
          tx(D('05-08'), 38, 'EWA FEE'),
          tx(D('05-10'), 64, 'CONVENIENCE STORE'),
        ],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 410,
        meta: { name: 'Starter Card', limit: 750 },
        liability: creditLiability(26.99, 30),
        transactions: [tx(D('05-13'), 28, 'FAST FOOD')],
      },
    ],
  },
  bank_income: {
    override_accounts: [
      {
        type: 'depository',
        subtype: 'checking',
        starting_balance: 7600,
        meta: { name: 'Primary Deposit Account' },
        transactions: [
          tx(D('05-31'), -2480, 'ACME CORP DIRECT DEP'),
          tx(D('05-15'), -2480, 'ACME CORP DIRECT DEP'),
          tx(D('05-30'), -300, 'SIDE GIG DEPOSIT'),
          tx(D('05-05'), 1500, 'RENT'),
          tx(D('05-12'), 220, 'UTILITIES'),
        ],
      },
      {
        type: 'depository',
        subtype: 'savings',
        starting_balance: 9100,
        meta: { name: 'Savings' },
        transactions: [tx(D('05-16'), -400, 'AUTO SAVE')],
      },
      {
        type: 'credit',
        subtype: 'credit card',
        starting_balance: 1180,
        meta: { name: 'Everyday Card', limit: 9000 },
        liability: creditLiability(20.99, 40),
        transactions: [tx(D('05-10'), 76, 'GROCERY')],
      },
    ],
  },
  // dynamic_transactions intentionally has NO custom config — it uses the
  // documented `user_transactions_dynamic` sandbox user (rich evolving txns).
};
