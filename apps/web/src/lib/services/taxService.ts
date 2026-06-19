/**
 * Tax data derivation from the canonical finance schema (server-side).
 *
 * Income is derived from REAL recorded data — finance.transactions tagged as
 * income for the year, plus finance.employer_benefits.salary when no income
 * transactions exist (avoids double-counting salary deposits). We never annualize
 * or synthesize income we don't have; a sparse record yields a sparse (honest)
 * estimate. Unrealized investment gains are intentionally excluded (not taxable
 * until realized) — they surface as optimization opportunities instead.
 */
type SB = any; // eslint-disable-line @typescript-eslint/no-explicit-any

import type { IncomeCategory } from '@/types/tax';

function mapIncomeCategory(text: string): IncomeCategory {
  const t = (text || '').toLowerCase();
  if (/salary|payroll|wage|paycheck/.test(t)) return 'wages';
  if (/bonus/.test(t)) return 'wages';
  if (/dividend/.test(t)) return 'dividends';
  if (/interest/.test(t)) return 'interest';
  if (/rent/.test(t)) return 'rental';
  if (/self.?employ|freelance|contract|1099/.test(t)) return 'self_employment';
  if (/social.?security/.test(t)) return 'social_security';
  if (/retire|pension|401k|ira/.test(t)) return 'retirement';
  return 'other';
}

export interface DerivedIncomeItem {
  id: string;
  taxProfileId: string;
  category: IncomeCategory;
  source: string;
  amount: number;
  frequency: 'annual' | 'one_time';
  taxWithheld: number;
  is1099: boolean;
  isW2: boolean;
  expenses: number;
  netIncome: number;
  qbiEligible: boolean;
  isQualified: boolean;
  documentIds: string[];
}

export async function deriveIncomeItems(
  sb: SB,
  userId: string,
  year: number
): Promise<DerivedIncomeItem[]> {
  const items: DerivedIncomeItem[] = [];

  // 1) Real income transactions for the year, grouped by inferred category.
  let txns: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const { data } = await sb
      .schema('finance')
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_type', 'income');
    txns = (data || []).filter(
      (
        t: any // eslint-disable-line @typescript-eslint/no-explicit-any
      ) => String(t.transaction_date || '').startsWith(String(year))
    );
  } catch {
    txns = [];
  }

  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    const cat = mapIncomeCategory(`${t.category || ''} ${t.description || ''}`);
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(Number(t.amount) || 0);
  }
  for (const [cat, amount] of Object.entries(byCategory)) {
    items.push(
      makeItem(
        userId,
        cat as IncomeCategory,
        labelFor(cat),
        Math.round(amount * 100) / 100,
        'one_time'
      )
    );
  }

  // 2) Salary from current employer benefits — only when no income transactions
  //    were recorded, to avoid double-counting salary deposits.
  if (!txns.length) {
    try {
      const { data } = await sb
        .schema('finance')
        .from('employer_benefits')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current', true);
      for (const b of data || []) {
        const salary = Number(b.salary) || 0;
        if (salary > 0) {
          items.push(
            makeItem(userId, 'wages', `${b.employer_name || 'Employer'} salary`, salary, 'annual')
          );
        }
      }
    } catch {
      /* none */
    }
  }

  return items;
}

function labelFor(cat: string): string {
  const map: Record<string, string> = {
    wages: 'Wages & salary',
    dividends: 'Dividends',
    interest: 'Interest income',
    rental: 'Rental income',
    self_employment: 'Self-employment',
    social_security: 'Social Security',
    retirement: 'Retirement income',
    other: 'Other income',
  };
  return map[cat] || 'Income';
}

function makeItem(
  userId: string,
  category: IncomeCategory,
  source: string,
  amount: number,
  frequency: 'annual' | 'one_time'
): DerivedIncomeItem {
  return {
    id: `${userId}:${category}:${frequency}`,
    taxProfileId: '',
    category,
    source,
    amount,
    frequency,
    taxWithheld: 0,
    is1099: false,
    isW2: category === 'wages',
    expenses: 0,
    netIncome: amount,
    qbiEligible: false,
    isQualified: category === 'dividends',
    documentIds: [],
  };
}
