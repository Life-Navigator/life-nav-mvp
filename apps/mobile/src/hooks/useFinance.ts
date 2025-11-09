/**
 * Life Navigator - Finance Data Hooks
 *
 * Elite-level React Query hooks for finance data fetching
 * NO MOCK DATA - All data from real API endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as financeApi from '../api/finance';
import {
  FinanceAccount,
  Transaction,
  Budget,
  Investment,
} from '../types';

/**
 * Query Keys for cache management
 */
export const financeKeys = {
  all: ['finance'] as const,
  accounts: () => [...financeKeys.all, 'accounts'] as const,
  account: (id: string) => [...financeKeys.accounts(), id] as const,
  transactions: (filters?: any) => [...financeKeys.all, 'transactions', filters] as const,
  transaction: (id: string) => [...financeKeys.all, 'transaction', id] as const,
  budgets: () => [...financeKeys.all, 'budgets'] as const,
  investments: () => [...financeKeys.all, 'investments'] as const,
  netWorth: (filters?: any) => [...financeKeys.all, 'netWorth', filters] as const,
  spendingByCategory: (filters?: any) => [...financeKeys.all, 'spendingByCategory', filters] as const,
  cashFlow: (filters?: any) => [...financeKeys.all, 'cashFlow', filters] as const,
};

/**
 * Fetch all finance accounts
 */
export const useAccounts = () => {
  return useQuery({
    queryKey: financeKeys.accounts(),
    queryFn: financeApi.getAccounts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Fetch single account by ID
 */
export const useAccount = (accountId: string) => {
  return useQuery({
    queryKey: financeKeys.account(accountId),
    queryFn: () => financeApi.getAccount(accountId),
    enabled: !!accountId,
  });
};

/**
 * Sync account with Plaid
 */
export const useSyncAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.syncAccount,
    onSuccess: (data) => {
      // Invalidate accounts to refetch
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions() });
    },
  });
};

/**
 * Fetch transactions with pagination
 */
export const useTransactions = (params?: {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: financeKeys.transactions(params),
    queryFn: () => financeApi.getTransactions(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Fetch single transaction
 */
export const useTransaction = (transactionId: string) => {
  return useQuery({
    queryKey: financeKeys.transaction(transactionId),
    queryFn: () => financeApi.getTransaction(transactionId),
    enabled: !!transactionId,
  });
};

/**
 * Update transaction
 */
export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Transaction> }) =>
      financeApi.updateTransaction(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: financeKeys.transaction(variables.id) });
      queryClient.invalidateQueries({ queryKey: financeKeys.transactions() });
    },
  });
};

/**
 * Fetch budgets
 */
export const useBudgets = () => {
  return useQuery({
    queryKey: financeKeys.budgets(),
    queryFn: financeApi.getBudgets,
  });
};

/**
 * Create budget
 */
export const useCreateBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.budgets() });
    },
  });
};

/**
 * Update budget
 */
export const useUpdateBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Budget> }) =>
      financeApi.updateBudget(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.budgets() });
    },
  });
};

/**
 * Delete budget
 */
export const useDeleteBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.budgets() });
    },
  });
};

/**
 * Fetch investments
 */
export const useInvestments = () => {
  return useQuery({
    queryKey: financeKeys.investments(),
    queryFn: financeApi.getInvestments,
  });
};

/**
 * Fetch net worth history
 */
export const useNetWorthHistory = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: financeKeys.netWorth(params),
    queryFn: () => financeApi.getNetWorthHistory(params),
  });
};

/**
 * Fetch spending by category
 */
export const useSpendingByCategory = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: financeKeys.spendingByCategory(params),
    queryFn: () => financeApi.getSpendingByCategory(params),
  });
};

/**
 * Fetch cash flow
 */
export const useCashFlow = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: financeKeys.cashFlow(params),
    queryFn: () => financeApi.getCashFlow(params),
  });
};

/**
 * Create Plaid link token
 */
export const useCreatePlaidLinkToken = () => {
  return useQuery({
    queryKey: ['plaid', 'linkToken'],
    queryFn: financeApi.createPlaidLinkToken,
    enabled: false, // Only fetch when explicitly called
  });
};

/**
 * Exchange Plaid token
 */
export const useExchangePlaidToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      publicToken,
      institutionId,
      institutionName,
    }: {
      publicToken: string;
      institutionId: string;
      institutionName: string;
    }) => financeApi.exchangePlaidToken(publicToken, institutionId, institutionName),
    onSuccess: () => {
      // Refetch accounts after successful connection
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts() });
    },
  });
};

// ============================================================================
// ADVANCED FINANCIAL PLANNING HOOKS
// ============================================================================

/**
 * LEGACY PLANNING / ESTATE PLANNING HOOKS
 */

/**
 * Fetch legacy plan
 */
export const useLegacyPlan = () => {
  return useQuery({
    queryKey: ['finance', 'legacy'],
    queryFn: financeApi.getLegacyPlan,
    refetchOnWindowFocus: false,
  });
};

/**
 * Update legacy plan
 */
export const useUpdateLegacyPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.updateLegacyPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'legacy'] });
    },
  });
};

/**
 * Add beneficiary
 */
export const useAddBeneficiary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addBeneficiary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'legacy'] });
    },
  });
};

/**
 * Update beneficiary
 */
export const useUpdateBeneficiary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeApi.updateBeneficiary(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'legacy'] });
    },
  });
};

/**
 * Delete beneficiary
 */
export const useDeleteBeneficiary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.deleteBeneficiary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'legacy'] });
    },
  });
};

/**
 * Upload estate document
 */
export const useUploadEstateDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.uploadEstateDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'legacy', 'documents'] });
    },
  });
};

/**
 * Fetch estate documents
 */
export const useEstateDocuments = () => {
  return useQuery({
    queryKey: ['finance', 'legacy', 'documents'],
    queryFn: financeApi.getEstateDocuments,
    refetchOnWindowFocus: false,
  });
};

/**
 * RISK MANAGEMENT & INSURANCE HOOKS
 */

/**
 * Fetch insurance policies
 */
export const useInsurancePolicies = () => {
  return useQuery({
    queryKey: ['finance', 'insurance', 'policies'],
    queryFn: financeApi.getInsurancePolicies,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add insurance policy
 */
export const useAddInsurancePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addInsurancePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'risk-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'coverage-analysis'] });
    },
  });
};

/**
 * Update insurance policy
 */
export const useUpdateInsurancePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeApi.updateInsurancePolicy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'risk-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'coverage-analysis'] });
    },
  });
};

/**
 * Delete insurance policy
 */
export const useDeleteInsurancePolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.deleteInsurancePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'risk-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'coverage-analysis'] });
    },
  });
};

/**
 * Fetch risk assessment
 */
export const useRiskAssessment = () => {
  return useQuery({
    queryKey: ['finance', 'insurance', 'risk-assessment'],
    queryFn: financeApi.getRiskAssessment,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch coverage analysis
 */
export const useCoverageAnalysis = () => {
  return useQuery({
    queryKey: ['finance', 'insurance', 'coverage-analysis'],
    queryFn: financeApi.getCoverageAnalysis,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch insurance claims
 */
export const useInsuranceClaims = () => {
  return useQuery({
    queryKey: ['finance', 'insurance', 'claims'],
    queryFn: financeApi.getInsuranceClaims,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add insurance claim
 */
export const useAddInsuranceClaim = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addInsuranceClaim,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'insurance', 'claims'] });
    },
  });
};

/**
 * TAX PLANNING HOOKS
 */

/**
 * Fetch tax plan
 */
export const useTaxPlan = () => {
  return useQuery({
    queryKey: ['finance', 'tax'],
    queryFn: financeApi.getTaxPlan,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch tax projections for a specific year
 */
export const useTaxProjections = (year: number) => {
  return useQuery({
    queryKey: ['finance', 'tax', 'projections', year],
    queryFn: () => financeApi.getTaxProjections(year),
    refetchOnWindowFocus: false,
    enabled: !!year,
  });
};

/**
 * Add tax document
 */
export const useAddTaxDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addTaxDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'tax', 'documents'] });
    },
  });
};

/**
 * Fetch tax documents
 */
export const useTaxDocuments = () => {
  return useQuery({
    queryKey: ['finance', 'tax', 'documents'],
    queryFn: financeApi.getTaxDocuments,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add tax deduction
 */
export const useAddDeduction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addDeduction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'tax', 'deductions'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'tax'] });
    },
  });
};

/**
 * Fetch tax deductions
 */
export const useDeductions = () => {
  return useQuery({
    queryKey: ['finance', 'tax', 'deductions'],
    queryFn: financeApi.getDeductions,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch quarterly tax estimates for a specific year
 */
export const useQuarterlyEstimates = (year: number) => {
  return useQuery({
    queryKey: ['finance', 'tax', 'quarterly-estimates', year],
    queryFn: () => financeApi.getQuarterlyEstimates(year),
    refetchOnWindowFocus: false,
    enabled: !!year,
  });
};

/**
 * RETIREMENT PLANNING HOOKS
 */

/**
 * Fetch retirement plan
 */
export const useRetirementPlan = () => {
  return useQuery({
    queryKey: ['finance', 'retirement'],
    queryFn: financeApi.getRetirementPlan,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch retirement accounts
 */
export const useRetirementAccounts = () => {
  return useQuery({
    queryKey: ['finance', 'retirement', 'accounts'],
    queryFn: financeApi.getRetirementAccounts,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add retirement account
 */
export const useAddRetirementAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addRetirementAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement'] });
    },
  });
};

/**
 * Update retirement account
 */
export const useUpdateRetirementAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeApi.updateRetirementAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement'] });
    },
  });
};

/**
 * Delete retirement account
 */
export const useDeleteRetirementAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.deleteRetirementAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement'] });
    },
  });
};

/**
 * Run Monte Carlo simulation
 */
export const useRunMonteCarloSimulation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.runMonteCarloSimulation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement'] });
    },
  });
};

/**
 * Fetch retirement goals
 */
export const useRetirementGoals = () => {
  return useQuery({
    queryKey: ['finance', 'retirement', 'goals'],
    queryFn: financeApi.getRetirementGoals,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add retirement goal
 */
export const useAddRetirementGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addRetirementGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement'] });
    },
  });
};

/**
 * Update retirement goal
 */
export const useUpdateRetirementGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeApi.updateRetirementGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'retirement'] });
    },
  });
};

/**
 * BENEFITS PLANNING HOOKS
 */

/**
 * Fetch benefits plan
 */
export const useBenefitsPlan = () => {
  return useQuery({
    queryKey: ['finance', 'benefits'],
    queryFn: financeApi.getBenefitsPlan,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch health benefits
 */
export const useHealthBenefits = () => {
  return useQuery({
    queryKey: ['finance', 'benefits', 'health'],
    queryFn: financeApi.getHealthBenefits,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add health benefit
 */
export const useAddHealthBenefit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addHealthBenefit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'benefits', 'health'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'benefits'] });
    },
  });
};

/**
 * Fetch retirement benefits list
 */
export const useRetirementBenefitsList = () => {
  return useQuery({
    queryKey: ['finance', 'benefits', 'retirement'],
    queryFn: financeApi.getRetirementBenefits,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add retirement benefit
 */
export const useAddRetirementBenefit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addRetirementBenefit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'benefits', 'retirement'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'benefits'] });
    },
  });
};

/**
 * Fetch insurance benefits
 */
export const useInsuranceBenefits = () => {
  return useQuery({
    queryKey: ['finance', 'benefits', 'insurance'],
    queryFn: financeApi.getInsuranceBenefits,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch PTO benefits
 */
export const usePTOBenefits = () => {
  return useQuery({
    queryKey: ['finance', 'benefits', 'pto'],
    queryFn: financeApi.getPTOBenefits,
    refetchOnWindowFocus: false,
  });
};

/**
 * Update PTO benefits
 */
export const useUpdatePTOBenefits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.updatePTOBenefits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'benefits', 'pto'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'benefits'] });
    },
  });
};

/**
 * Fetch benefits optimization
 */
export const useBenefitsOptimization = () => {
  return useQuery({
    queryKey: ['finance', 'benefits', 'optimization'],
    queryFn: financeApi.getBenefitsOptimization,
    refetchOnWindowFocus: false,
  });
};

/**
 * INVESTMENT MANAGEMENT HOOKS
 */

/**
 * Fetch portfolio
 */
export const usePortfolio = () => {
  return useQuery({
    queryKey: ['finance', 'portfolio'],
    queryFn: financeApi.getPortfolio,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch portfolio performance
 */
export const usePortfolioPerformance = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ['finance', 'portfolio', 'performance', params],
    queryFn: () => financeApi.getPortfolioPerformance(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch asset allocation
 */
export const useAssetAllocation = () => {
  return useQuery({
    queryKey: ['finance', 'portfolio', 'asset-allocation'],
    queryFn: financeApi.getAssetAllocation,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch holdings
 */
export const useHoldings = () => {
  return useQuery({
    queryKey: ['finance', 'portfolio', 'holdings'],
    queryFn: financeApi.getHoldings,
    refetchOnWindowFocus: false,
  });
};

/**
 * Add holding
 */
export const useAddHolding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.addHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'holdings'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'asset-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'metrics'] });
    },
  });
};

/**
 * Update holding
 */
export const useUpdateHolding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeApi.updateHolding(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'holdings'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'asset-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'metrics'] });
    },
  });
};

/**
 * Delete holding
 */
export const useDeleteHolding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.deleteHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'holdings'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'asset-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'metrics'] });
    },
  });
};

/**
 * Fetch portfolio metrics
 */
export const usePortfolioMetrics = () => {
  return useQuery({
    queryKey: ['finance', 'portfolio', 'metrics'],
    queryFn: financeApi.getPortfolioMetrics,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch dividends
 */
export const useDividends = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ['finance', 'portfolio', 'dividends', params],
    queryFn: () => financeApi.getDividends(params),
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch investment strategy
 */
export const useInvestmentStrategy = () => {
  return useQuery({
    queryKey: ['finance', 'portfolio', 'strategy'],
    queryFn: financeApi.getInvestmentStrategy,
    refetchOnWindowFocus: false,
  });
};

/**
 * Update investment strategy
 */
export const useUpdateInvestmentStrategy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.updateInvestmentStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio', 'strategy'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'portfolio'] });
    },
  });
};

/**
 * FINANCIAL PLANNING DASHBOARD HOOKS
 */

/**
 * Fetch financial health score
 */
export const useFinancialHealthScore = () => {
  return useQuery({
    queryKey: ['finance', 'planning', 'health-score'],
    queryFn: financeApi.getFinancialHealthScore,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch planning progress
 */
export const usePlanningProgress = () => {
  return useQuery({
    queryKey: ['finance', 'planning', 'progress'],
    queryFn: financeApi.getPlanningProgress,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch planning milestones
 */
export const usePlanningMilestones = () => {
  return useQuery({
    queryKey: ['finance', 'planning', 'milestones'],
    queryFn: financeApi.getPlanningMilestones,
    refetchOnWindowFocus: false,
  });
};

/**
 * Fetch action items
 */
export const useActionItems = () => {
  return useQuery({
    queryKey: ['finance', 'planning', 'action-items'],
    queryFn: financeApi.getActionItems,
    refetchOnWindowFocus: false,
  });
};

/**
 * Complete action item
 */
export const useCompleteActionItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.completeActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'planning', 'action-items'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'planning', 'progress'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'planning', 'health-score'] });
    },
  });
};

export default {
  // Basic Finance Hooks
  useAccounts,
  useAccount,
  useSyncAccount,
  useTransactions,
  useTransaction,
  useUpdateTransaction,
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useInvestments,
  useNetWorthHistory,
  useSpendingByCategory,
  useCashFlow,
  useCreatePlaidLinkToken,
  useExchangePlaidToken,

  // Legacy Planning Hooks
  useLegacyPlan,
  useUpdateLegacyPlan,
  useAddBeneficiary,
  useUpdateBeneficiary,
  useDeleteBeneficiary,
  useUploadEstateDocument,
  useEstateDocuments,

  // Risk Management & Insurance Hooks
  useInsurancePolicies,
  useAddInsurancePolicy,
  useUpdateInsurancePolicy,
  useDeleteInsurancePolicy,
  useRiskAssessment,
  useCoverageAnalysis,
  useInsuranceClaims,
  useAddInsuranceClaim,

  // Tax Planning Hooks
  useTaxPlan,
  useTaxProjections,
  useAddTaxDocument,
  useTaxDocuments,
  useAddDeduction,
  useDeductions,
  useQuarterlyEstimates,

  // Retirement Planning Hooks
  useRetirementPlan,
  useRetirementAccounts,
  useAddRetirementAccount,
  useUpdateRetirementAccount,
  useDeleteRetirementAccount,
  useRunMonteCarloSimulation,
  useRetirementGoals,
  useAddRetirementGoal,
  useUpdateRetirementGoal,

  // Benefits Planning Hooks
  useBenefitsPlan,
  useHealthBenefits,
  useAddHealthBenefit,
  useRetirementBenefitsList,
  useAddRetirementBenefit,
  useInsuranceBenefits,
  usePTOBenefits,
  useUpdatePTOBenefits,
  useBenefitsOptimization,

  // Investment Management Hooks
  usePortfolio,
  usePortfolioPerformance,
  useAssetAllocation,
  useHoldings,
  useAddHolding,
  useUpdateHolding,
  useDeleteHolding,
  usePortfolioMetrics,
  useDividends,
  useInvestmentStrategy,
  useUpdateInvestmentStrategy,

  // Financial Planning Dashboard Hooks
  useFinancialHealthScore,
  usePlanningProgress,
  usePlanningMilestones,
  useActionItems,
  useCompleteActionItem,
};
