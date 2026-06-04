import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// The service-role client is typed to the public schema, but these helpers
// deliberately target the `finance` schema via .schema(). Use a loose generic
// so both the .schema() call and the call sites type-check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

/**
 * Server-side persistence of Plaid data into the `finance` schema. Writing to
 * `finance.financial_accounts` fires the existing `trigger_financial_account_sync`
 * trigger, which enqueues a `graphrag.sync_queue` job → the Rust worker promotes
 * the account into the personal Neo4j graph + Qdrant (the "graph promotion").
 *
 * Use a service-role client so RLS is bypassed for the write; `user_id` is set
 * explicitly from the authenticated caller, so rows stay correctly scoped.
 */

type Svc = AnySupabase;

/** Map a Plaid account type/subtype to finance.financial_accounts.account_type. */
export function mapAccountType(type?: string, subtype?: string | null): string {
  const t = (type || '').toLowerCase();
  const s = (subtype || '').toLowerCase();
  if (t === 'credit') return 'credit_card';
  if (t === 'depository') return s === 'savings' ? 'savings' : 'checking';
  if (t === 'investment') {
    if (
      ['401k', '403b', 'ira', 'roth', 'roth 401k', 'pension', 'retirement'].some((r) =>
        s.includes(r)
      )
    ) {
      return 'retirement';
    }
    return 'investment';
  }
  if (t === 'loan') return s.includes('mortgage') ? 'mortgage' : 'loan';
  return 'checking';
}

export interface PlaidAccountLike {
  account_id: string;
  name?: string;
  official_name?: string | null;
  type?: string;
  subtype?: string | null;
  balances?: {
    current?: number | null;
    available?: number | null;
    iso_currency_code?: string | null;
    limit?: number | null;
  };
}

export interface PlaidTxnLike {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name?: string;
  merchant_name?: string | null;
  category?: string[] | null;
  iso_currency_code?: string | null;
}

export async function persistPlaidItem(
  svc: Svc,
  args: {
    userId: string;
    itemId: string;
    accessToken: string;
    institutionId: string;
    institutionName?: string;
  }
): Promise<void> {
  const { error } = await svc
    .schema('finance')
    .from('plaid_items')
    .upsert(
      {
        user_id: args.userId,
        plaid_item_id: args.itemId,
        // Sandbox access tokens are non-sensitive test tokens. The real-Plaid
        // path should encrypt via core.encrypt_text before storing here.
        access_token_encrypted: args.accessToken,
        institution_id: args.institutionId,
        institution_name: args.institutionName ?? null,
        status: 'active',
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'plaid_item_id' }
    );
  if (error) throw new Error(`persistPlaidItem: ${error.message}`);
}

/** Upsert accounts; returns a map of plaid_account_id → finance.financial_accounts.id. */
export async function persistAccounts(
  svc: Svc,
  userId: string,
  accounts: PlaidAccountLike[]
): Promise<Record<string, string>> {
  const rows = accounts.map((a) => ({
    user_id: userId,
    account_name: a.name || a.official_name || 'Account',
    account_type: mapAccountType(a.type, a.subtype),
    institution_name: null,
    current_balance: a.balances?.current ?? 0,
    available_balance: a.balances?.available ?? null,
    currency: a.balances?.iso_currency_code || 'USD',
    credit_limit: a.balances?.limit ?? null,
    is_active: true,
    is_manual: false,
    plaid_account_id: a.account_id,
    last_synced_at: new Date().toISOString(),
  }));
  const { data, error } = await svc
    .schema('finance')
    .from('financial_accounts')
    .upsert(rows, { onConflict: 'plaid_account_id' })
    .select('id, plaid_account_id');
  if (error) throw new Error(`persistAccounts: ${error.message}`);
  const map: Record<string, string> = {};
  for (const r of data || []) if (r.plaid_account_id) map[r.plaid_account_id] = r.id;
  return map;
}

export async function persistTransactions(
  svc: Svc,
  userId: string,
  accountIdMap: Record<string, string>,
  transactions: PlaidTxnLike[]
): Promise<number> {
  const rows = transactions
    .filter((t) => accountIdMap[t.account_id])
    .map((t) => ({
      user_id: userId,
      account_id: accountIdMap[t.account_id],
      // Plaid: positive amount = money out. Store magnitude + a direction.
      amount: Math.abs(t.amount),
      currency: t.iso_currency_code || 'USD',
      transaction_date: t.date,
      description: t.name || null,
      merchant: t.merchant_name ?? null,
      category: Array.isArray(t.category) && t.category.length ? t.category[0] : null,
      transaction_type: t.amount >= 0 ? 'expense' : 'income',
      is_recurring: false,
      plaid_transaction_id: t.transaction_id,
    }));
  if (!rows.length) return 0;
  const { error } = await svc
    .schema('finance')
    .from('transactions')
    .upsert(rows, { onConflict: 'plaid_transaction_id' });
  if (error) throw new Error(`persistTransactions: ${error.message}`);
  return rows.length;
}
