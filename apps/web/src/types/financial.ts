/**
 * Financial domain type definitions
 */

export type FinancialRecord = {
  id: string;
  userId: string;
  totalNetWorth: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type Budget = {
  id: string;
  userId: string;
  name: string;
  totalBudget: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categories?: BudgetCategory[];
};

export type BudgetCategory = {
  id: string;
  budgetId: string;
  name: string;
  allocated: number;
  spent: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Investment = {
  id: string;
  userId: string;
  name: string;
  type: string; // stock, bond, crypto, real_estate, etc.
  value: number;
  purchasePrice: number;
  purchaseDate: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FinancialOverview = {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  currentBudget?: Budget;
  investmentSummary: {
    totalValue: number;
    totalGain: number;
    gainPercentage: number;
    breakdown: {
      type: string;
      value: number;
      percentage: number;
    }[];
  };
};

export type FinancialInsight = {
  id: string;
  title: string;
  description: string;
  domain: 'budget' | 'investment' | 'saving' | 'debt' | 'tax' | 'general';
  impact: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
};

export type Transaction = {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
  type: 'income' | 'expense';
  accountId?: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Enhanced financial account types
 */
export type AccountType =
  | 'bank'
  | 'credit'
  | 'loan'
  | 'investment'
  | 'retirement'
  | 'crypto'
  | 'other';

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  subtype?: string;
  institution: {
    id: string;
    name: string;
    logo?: string;
  };
  balance: number;
  currency: string;
  lastUpdated: Date;
  accountNumber?: string;
  maskedAccountNumber?: string;
  isHidden?: boolean;
  isPrimary?: boolean;
  status: 'active' | 'inactive' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountGroup {
  institution: {
    id: string;
    name: string;
    logo?: string;
  };
  accounts: FinancialAccount[];
}

export interface EnhancedTransaction {
  id: string;
  accountId: string;
  date: Date;
  description: string;
  category: string;
  amount: number;
  currency: string;
  isIncome: boolean;
  isPending: boolean;
  merchant?: {
    name: string;
    logo?: string;
  };
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type AssetType = 'real_estate' | 'vehicle' | 'collectible' | 'business' | 'other';

export interface Asset {
  id: string;
  userId: string;
  name: string;
  type: AssetType;
  subtype?: string;
  value: number;
  currentValue: number;
  currency: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  appreciationRate?: number;
  lastValuationDate?: Date;
  location?: string;
  description?: string;
  notes?: string;
  documents?: string[];
  imageUrl?: string;
  images?: string[];
  details?: Record<string, unknown>;
  loans?: AssetLoan[];
  upgrades?: AssetUpgrade[];
  valuations?: AssetValuation[];
  createdAt: Date;
  updatedAt: Date;
}

export type LoanType = 'mortgage' | 'auto_loan' | 'heloc' | 'personal' | 'other';

export interface AssetLoan {
  id: string;
  assetId: string;
  loanType: LoanType;
  lender: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: Date;
  endDate?: Date;
  paymentDueDay?: number;
  accountNumber?: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UpgradeCategory = 'maintenance' | 'improvement' | 'renovation' | 'repair' | 'addition';
export type UpgradeStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type UpgradePriority = 'low' | 'medium' | 'high' | 'critical';

export interface AssetUpgrade {
  id: string;
  assetId: string;
  name: string;
  description?: string;
  category: UpgradeCategory;
  estimatedCost: number;
  actualCost?: number;
  valueIncrease?: number;
  status: UpgradeStatus;
  priority: UpgradePriority;
  startDate?: Date;
  completionDate?: Date;
  contractor?: string;
  warranty?: string;
  documents?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ValuationSource = 'manual' | 'appraisal' | 'market' | 'zillow' | 'kbb' | 'other';

export interface AssetValuation {
  id: string;
  assetId: string;
  value: number;
  source: ValuationSource;
  valuationDate: Date;
  notes?: string;
  documents?: string[];
  createdAt: Date;
}

export interface UpgradeScenario {
  upgrade: AssetUpgrade;
  roi: number; // Return on Investment percentage
  paybackPeriod: number; // In months
  netValueChange: number; // valueIncrease - estimatedCost
  isRecommended: boolean;
}

export interface AssetSummary {
  totalValue: number;
  totalEquity: number;
  totalDebt: number;
  byType: {
    type: AssetType;
    count: number;
    value: number;
    equity: number;
  }[];
}