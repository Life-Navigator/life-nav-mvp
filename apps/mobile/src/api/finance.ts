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

export default {
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
};
