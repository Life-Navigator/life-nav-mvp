/**
 * Life Navigator - Finance API
 *
 * Elite-level finance API calls - NO MOCK DATA
 * All data fetched from real backend endpoints
 */

import { api } from './client';
import {
  FinanceAccount,
  Transaction,
  Budget,
  Investment,
  ApiResponse,
  PaginatedResponse,
} from '../types';

/**
 * Get all finance accounts
 * GET /finance/accounts
 */
export const getAccounts = async (): Promise<FinanceAccount[]> => {
  return api.get('/finance/accounts');
};

/**
 * Get single account by ID
 * GET /finance/accounts/:id
 */
export const getAccount = async (accountId: string): Promise<FinanceAccount> => {
  return api.get(`/finance/accounts/${accountId}`);
};

/**
 * Sync account with Plaid
 * POST /finance/accounts/:id/sync
 */
export const syncAccount = async (accountId: string): Promise<ApiResponse<FinanceAccount>> => {
  return api.post(`/finance/accounts/${accountId}/sync`);
};

/**
 * Get transactions with pagination
 * GET /finance/transactions
 */
export const getTransactions = async (params?: {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Transaction>> => {
  return api.get('/finance/transactions', { params });
};

/**
 * Get single transaction by ID
 * GET /finance/transactions/:id
 */
export const getTransaction = async (transactionId: string): Promise<Transaction> => {
  return api.get(`/finance/transactions/${transactionId}`);
};

/**
 * Update transaction category or notes
 * PATCH /finance/transactions/:id
 */
export const updateTransaction = async (
  transactionId: string,
  updates: Partial<Transaction>
): Promise<Transaction> => {
  return api.patch(`/finance/transactions/${transactionId}`, updates);
};

/**
 * Get budgets
 * GET /finance/budgets
 */
export const getBudgets = async (): Promise<Budget[]> => {
  return api.get('/finance/budgets');
};

/**
 * Create budget
 * POST /finance/budgets
 */
export const createBudget = async (budget: Omit<Budget, 'id'>): Promise<Budget> => {
  return api.post('/finance/budgets', budget);
};

/**
 * Update budget
 * PATCH /finance/budgets/:id
 */
export const updateBudget = async (
  budgetId: string,
  updates: Partial<Budget>
): Promise<Budget> => {
  return api.patch(`/finance/budgets/${budgetId}`, updates);
};

/**
 * Delete budget
 * DELETE /finance/budgets/:id
 */
export const deleteBudget = async (budgetId: string): Promise<ApiResponse<null>> => {
  return api.delete(`/finance/budgets/${budgetId}`);
};

/**
 * Get investments
 * GET /finance/investments
 */
export const getInvestments = async (): Promise<Investment[]> => {
  return api.get('/finance/investments');
};

/**
 * Get net worth history
 * GET /finance/net-worth
 */
export const getNetWorthHistory = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Array<{ date: string; value: number }>> => {
  return api.get('/finance/net-worth', { params });
};

/**
 * Get spending by category
 * GET /finance/spending-by-category
 */
export const getSpendingByCategory = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Array<{ category: string; amount: number; percentage: number }>> => {
  return api.get('/finance/spending-by-category', { params });
};

/**
 * Get cash flow data
 * GET /finance/cash-flow
 */
export const getCashFlow = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{
  income: number;
  expenses: number;
  savings: number;
}> => {
  return api.get('/finance/cash-flow', { params });
};

/**
 * Connect bank account via Plaid
 * POST /finance/plaid/link-token
 */
export const createPlaidLinkToken = async (): Promise<{ link_token: string }> => {
  return api.post('/finance/plaid/link-token');
};

/**
 * Exchange Plaid public token for access token
 * POST /finance/plaid/exchange-token
 */
export const exchangePlaidToken = async (
  publicToken: string,
  institutionId: string,
  institutionName: string
): Promise<ApiResponse<{ accounts: FinanceAccount[] }>> => {
  return api.post('/finance/plaid/exchange-token', {
    public_token: publicToken,
    institution_id: institutionId,
    institution_name: institutionName,
  });
};

// ============================================================================
// ADVANCED FINANCIAL PLANNING APIs
// ============================================================================

/**
 * Legacy Planning / Estate Planning
 */

export const getLegacyPlan = async (): Promise<any> => {
  return api.get('/finance/legacy');
};

export const updateLegacyPlan = async (data: any): Promise<any> => {
  return api.put('/finance/legacy', data);
};

export const addBeneficiary = async (data: any): Promise<any> => {
  return api.post('/finance/legacy/beneficiaries', data);
};

export const updateBeneficiary = async (id: string, data: any): Promise<any> => {
  return api.put(`/finance/legacy/beneficiaries/${id}`, data);
};

export const deleteBeneficiary = async (id: string): Promise<any> => {
  return api.delete(`/finance/legacy/beneficiaries/${id}`);
};

export const uploadEstateDocument = async (data: FormData): Promise<any> => {
  return api.post('/finance/legacy/documents', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getEstateDocuments = async (): Promise<any[]> => {
  return api.get('/finance/legacy/documents');
};

/**
 * Risk Management & Insurance
 */

export const getInsurancePolicies = async (): Promise<any[]> => {
  return api.get('/finance/insurance/policies');
};

export const addInsurancePolicy = async (data: any): Promise<any> => {
  return api.post('/finance/insurance/policies', data);
};

export const updateInsurancePolicy = async (id: string, data: any): Promise<any> => {
  return api.put(`/finance/insurance/policies/${id}`, data);
};

export const deleteInsurancePolicy = async (id: string): Promise<any> => {
  return api.delete(`/finance/insurance/policies/${id}`);
};

export const getRiskAssessment = async (): Promise<any> => {
  return api.get('/finance/insurance/risk-assessment');
};

export const getCoverageAnalysis = async (): Promise<any> => {
  return api.get('/finance/insurance/coverage-analysis');
};

export const getInsuranceClaims = async (): Promise<any[]> => {
  return api.get('/finance/insurance/claims');
};

export const addInsuranceClaim = async (data: any): Promise<any> => {
  return api.post('/finance/insurance/claims', data);
};

/**
 * Tax Planning
 */

export const getTaxPlan = async (): Promise<any> => {
  return api.get('/finance/tax');
};

export const getTaxProjections = async (year: number): Promise<any> => {
  return api.get(`/finance/tax/projections/${year}`);
};

export const addTaxDocument = async (data: FormData): Promise<any> => {
  return api.post('/finance/tax/documents', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getTaxDocuments = async (): Promise<any[]> => {
  return api.get('/finance/tax/documents');
};

export const addDeduction = async (data: any): Promise<any> => {
  return api.post('/finance/tax/deductions', data);
};

export const getDeductions = async (): Promise<any[]> => {
  return api.get('/finance/tax/deductions');
};

export const getQuarterlyEstimates = async (year: number): Promise<any> => {
  return api.get(`/finance/tax/quarterly-estimates/${year}`);
};

/**
 * Retirement Planning
 */

export const getRetirementPlan = async (): Promise<any> => {
  return api.get('/finance/retirement');
};

export const getRetirementAccounts = async (): Promise<any[]> => {
  return api.get('/finance/retirement/accounts');
};

export const addRetirementAccount = async (data: any): Promise<any> => {
  return api.post('/finance/retirement/accounts', data);
};

export const updateRetirementAccount = async (id: string, data: any): Promise<any> => {
  return api.put(`/finance/retirement/accounts/${id}`, data);
};

export const deleteRetirementAccount = async (id: string): Promise<any> => {
  return api.delete(`/finance/retirement/accounts/${id}`);
};

export const runMonteCarloSimulation = async (params: any): Promise<any> => {
  return api.post('/finance/retirement/monte-carlo', params);
};

export const getRetirementGoals = async (): Promise<any[]> => {
  return api.get('/finance/retirement/goals');
};

export const addRetirementGoal = async (data: any): Promise<any> => {
  return api.post('/finance/retirement/goals', data);
};

export const updateRetirementGoal = async (id: string, data: any): Promise<any> => {
  return api.put(`/finance/retirement/goals/${id}`, data);
};

/**
 * Benefits Planning
 */

export const getBenefitsPlan = async (): Promise<any> => {
  return api.get('/finance/benefits');
};

export const getHealthBenefits = async (): Promise<any[]> => {
  return api.get('/finance/benefits/health');
};

export const addHealthBenefit = async (data: any): Promise<any> => {
  return api.post('/finance/benefits/health', data);
};

export const getRetirementBenefits = async (): Promise<any[]> => {
  return api.get('/finance/benefits/retirement');
};

export const addRetirementBenefit = async (data: any): Promise<any> => {
  return api.post('/finance/benefits/retirement', data);
};

export const getInsuranceBenefits = async (): Promise<any[]> => {
  return api.get('/finance/benefits/insurance');
};

export const getPTOBenefits = async (): Promise<any> => {
  return api.get('/finance/benefits/pto');
};

export const updatePTOBenefits = async (data: any): Promise<any> => {
  return api.put('/finance/benefits/pto', data);
};

export const getBenefitsOptimization = async (): Promise<any> => {
  return api.get('/finance/benefits/optimization');
};

/**
 * Investment Management
 */

export const getPortfolio = async (): Promise<any> => {
  return api.get('/finance/portfolio');
};

export const getPortfolioPerformance = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  return api.get('/finance/portfolio/performance', { params });
};

export const getAssetAllocation = async (): Promise<any> => {
  return api.get('/finance/portfolio/asset-allocation');
};

export const getHoldings = async (): Promise<any[]> => {
  return api.get('/finance/portfolio/holdings');
};

export const addHolding = async (data: any): Promise<any> => {
  return api.post('/finance/portfolio/holdings', data);
};

export const updateHolding = async (id: string, data: any): Promise<any> => {
  return api.put(`/finance/portfolio/holdings/${id}`, data);
};

export const deleteHolding = async (id: string): Promise<any> => {
  return api.delete(`/finance/portfolio/holdings/${id}`);
};

export const getPortfolioMetrics = async (): Promise<any> => {
  return api.get('/finance/portfolio/metrics');
};

export const getDividends = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<any[]> => {
  return api.get('/finance/portfolio/dividends', { params });
};

export const getInvestmentStrategy = async (): Promise<any> => {
  return api.get('/finance/portfolio/strategy');
};

export const updateInvestmentStrategy = async (data: any): Promise<any> => {
  return api.put('/finance/portfolio/strategy', data);
};

/**
 * Financial Planning Dashboard
 */

export const getFinancialHealthScore = async (): Promise<any> => {
  return api.get('/finance/planning/health-score');
};

export const getPlanningProgress = async (): Promise<any> => {
  return api.get('/finance/planning/progress');
};

export const getPlanningMilestones = async (): Promise<any[]> => {
  return api.get('/finance/planning/milestones');
};

export const getActionItems = async (): Promise<any[]> => {
  return api.get('/finance/planning/action-items');
};

export const completeActionItem = async (id: string): Promise<any> => {
  return api.post(`/finance/planning/action-items/${id}/complete`);
};

export default {
  // Basic Finance
  getAccounts,
  getAccount,
  syncAccount,
  getTransactions,
  getTransaction,
  updateTransaction,
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getInvestments,
  getNetWorthHistory,
  getSpendingByCategory,
  getCashFlow,
  createPlaidLinkToken,
  exchangePlaidToken,

  // Legacy Planning
  getLegacyPlan,
  updateLegacyPlan,
  addBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  uploadEstateDocument,
  getEstateDocuments,

  // Risk Management & Insurance
  getInsurancePolicies,
  addInsurancePolicy,
  updateInsurancePolicy,
  deleteInsurancePolicy,
  getRiskAssessment,
  getCoverageAnalysis,
  getInsuranceClaims,
  addInsuranceClaim,

  // Tax Planning
  getTaxPlan,
  getTaxProjections,
  addTaxDocument,
  getTaxDocuments,
  addDeduction,
  getDeductions,
  getQuarterlyEstimates,

  // Retirement Planning
  getRetirementPlan,
  getRetirementAccounts,
  addRetirementAccount,
  updateRetirementAccount,
  deleteRetirementAccount,
  runMonteCarloSimulation,
  getRetirementGoals,
  addRetirementGoal,
  updateRetirementGoal,

  // Benefits Planning
  getBenefitsPlan,
  getHealthBenefits,
  addHealthBenefit,
  getRetirementBenefits,
  addRetirementBenefit,
  getInsuranceBenefits,
  getPTOBenefits,
  updatePTOBenefits,
  getBenefitsOptimization,

  // Investment Management
  getPortfolio,
  getPortfolioPerformance,
  getAssetAllocation,
  getHoldings,
  addHolding,
  updateHolding,
  deleteHolding,
  getPortfolioMetrics,
  getDividends,
  getInvestmentStrategy,
  updateInvestmentStrategy,

  // Financial Planning Dashboard
  getFinancialHealthScore,
  getPlanningProgress,
  getPlanningMilestones,
  getActionItems,
  completeActionItem,
};
