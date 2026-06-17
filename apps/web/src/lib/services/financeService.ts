// Finance manual-entry service. Mirrors careerService/educationService: friendly form fields are mapped
// to the REAL finance.* columns (migration 031) and whitelisted, so a save can never fail with
// "column does not exist". All writes go through the USER session (RLS: auth.uid() = user_id); the
// `finance` schema is granted SELECT/INSERT/UPDATE/DELETE to `authenticated` (migration 105).
type SB = any;
const SCHEMA = 'finance';

const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  if (v === '' || v === null || v === undefined) return null;
  return String(v);
};

export type FinanceEntryType =
  | 'account'
  | 'transaction'
  | 'investment'
  | 'debt'
  | 'asset'
  | 'retirement';

// Normalize the various asset-type labels the UI sends into the canonical asset_type strings.
const classifyAsset = (v: unknown): string => {
  const s = String(v ?? '').toLowerCase();
  if (['real_estate', 'home', 'property', 'realestate'].includes(s)) return 'real_estate';
  if (['vehicle', 'auto', 'car'].includes(s)) return 'vehicle';
  if (s === 'business') return 'business';
  if (['collectible', 'collectibles'].includes(s)) return 'collectible';
  if (['crypto', 'cryptocurrency'].includes(s)) return 'crypto';
  return 'other';
};

// Each form type → { table, row } against the real finance schema.
function mapEntry(
  type: FinanceEntryType,
  d: Record<string, unknown>
): { table: string; row: Record<string, unknown> } {
  switch (type) {
    case 'account':
      return {
        table: 'financial_accounts',
        row: {
          account_name: str(d.name),
          account_type: str(d.type) || 'checking',
          institution_name: str(d.institution),
          current_balance: num(d.balance) ?? 0,
          currency: str(d.currency) || 'USD',
          is_active: true,
          is_manual: true,
        },
      };
    case 'debt':
      // A standalone debt (credit card / loan) is modeled as a debt-type financial account so it feeds
      // the net-worth resolver's liabilities. asset_loans requires an asset_id and is for loans-on-assets.
      return {
        table: 'financial_accounts',
        row: {
          account_name: str(d.name),
          account_type: str(d.type) || 'credit_card',
          current_balance: num(d.balance) ?? 0,
          interest_rate: num(d.interestRate),
          currency: 'USD',
          is_active: true,
          is_manual: true,
          metadata: { minimum_payment: num(d.minimumPayment), due_date: str(d.dueDate) },
        },
      };
    case 'transaction':
      return {
        table: 'transactions',
        row: {
          description: str(d.description),
          amount: num(d.amount) ?? 0,
          category: str(d.category),
          transaction_date: str(d.date) || new Date().toISOString().slice(0, 10),
          account_id: str(d.accountId),
          transaction_type: str(d.transaction_type) || 'expense',
          currency: 'USD',
        },
      };
    case 'investment': {
      // Friendly aliases: the Investments page sends ticker/costBasis; the /add page sends
      // symbol/purchasePrice. Accept both → the REAL finance.investment_holdings columns.
      const qty = num(d.shares ?? d.quantity);
      const price = num(d.currentPrice);
      const symbol = str(d.symbol ?? d.ticker);
      return {
        table: 'investment_holdings',
        row: {
          symbol: symbol ? symbol.toUpperCase() : null,
          name: str(d.name),
          quantity: qty ?? 0,
          cost_basis: num(d.purchasePrice ?? d.costBasis),
          current_price: price,
          current_value: qty != null && price != null ? qty * price : null,
          asset_class: str(d.assetClass),
          sector: str(d.sector),
          purchase_date: str(d.purchaseDate),
        },
      };
    }
    case 'asset':
      // Real non-account asset → finance.assets. Friendly aliases name/value/type.
      return {
        table: 'assets',
        row: {
          asset_name: str(d.name ?? d.assetName),
          asset_type: classifyAsset(d.type ?? d.assetType),
          current_value: num(d.value ?? d.currentValue) ?? 0,
          purchase_price: num(d.purchasePrice),
          purchase_date: str(d.purchaseDate),
          description: str(d.description),
          location: str(d.location),
          metadata: { source: 'user_entered' },
        },
      };
    case 'retirement':
      // A retirement balance is modeled as a retirement-type financial account so it feeds the
      // net-worth resolver's retirement bucket (one source of truth — no fake rows).
      return {
        table: 'financial_accounts',
        row: {
          account_name: str(d.name) || 'Retirement Account',
          account_type: 'retirement',
          institution_name: str(d.institution),
          current_balance: num(d.balance) ?? 0,
          currency: str(d.currency) || 'USD',
          is_active: true,
          is_manual: true,
          metadata: { plan_type: str(d.planType) },
        },
      };
    default:
      throw new Error(`unknown finance entry type: ${type}`);
  }
}

export async function createFinanceEntry(
  supabase: SB,
  userId: string,
  type: FinanceEntryType,
  data: Record<string, unknown>
) {
  const { table, row } = mapEntry(type, data);
  const { data: inserted, error } = await supabase
    .schema(SCHEMA)
    .from(table)
    .insert({ ...row, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

// List a user's manual finance entries for a type (for render-on-refresh).
export async function listFinanceEntries(supabase: SB, userId: string, type: FinanceEntryType) {
  const table =
    type === 'transaction'
      ? 'transactions'
      : type === 'investment'
        ? 'investment_holdings'
        : type === 'asset'
          ? 'assets'
          : 'financial_accounts'; // account | debt | retirement
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
