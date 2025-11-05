/**
 * Financial domain API client
 */
import { apiClient } from './client';
import type { 
  FinancialRecord,
  Budget,
  BudgetCategory,
  Investment,
  FinancialOverview,
  Transaction
} from '../../types/financial';

export const financialApi = {
  /**
   * Get financial overview for the current user
   */
  getOverview: () => 
    apiClient.get<FinancialOverview>('/financial/overview'),
  
  /**
   * Get financial record for the current user
   */
  getFinancialRecord: () =>
    apiClient.get<FinancialRecord>('/financial/record'),
  
  /**
   * Update financial record
   */
  updateFinancialRecord: (data: Partial<FinancialRecord>) =>
    apiClient.patch<FinancialRecord>('/financial/record', data),
  
  /**
   * Get all budgets for the current user
   */
  getBudgets: () =>
    apiClient.get<Budget[]>('/financial/budgets'),
  
  /**
   * Get a single budget by ID
   */
  getBudget: (id: string) =>
    apiClient.get<Budget>(`/financial/budgets/${id}`),
  
  /**
   * Create a new budget
   */
  createBudget: (data: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<Budget>('/financial/budgets', data),
  
  /**
   * Update an existing budget
   */
  updateBudget: (id: string, data: Partial<Budget>) =>
    apiClient.patch<Budget>(`/financial/budgets/${id}`, data),
  
  /**
   * Delete a budget
   */
  deleteBudget: (id: string) =>
    apiClient.delete(`/financial/budgets/${id}`),
  
  /**
   * Add a category to a budget
   */
  addBudgetCategory: (budgetId: string, data: Omit<BudgetCategory, 'id' | 'budgetId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<BudgetCategory>(`/financial/budgets/${budgetId}/categories`, data),
  
  /**
   * Update a budget category
   */
  updateBudgetCategory: (budgetId: string, categoryId: string, data: Partial<BudgetCategory>) =>
    apiClient.patch<BudgetCategory>(`/financial/budgets/${budgetId}/categories/${categoryId}`, data),
  
  /**
   * Delete a budget category
   */
  deleteBudgetCategory: (budgetId: string, categoryId: string) =>
    apiClient.delete(`/financial/budgets/${budgetId}/categories/${categoryId}`),
  
  /**
   * Get all investments for the current user
   */
  getInvestments: () =>
    apiClient.get<Investment[]>('/financial/investments'),
  
  /**
   * Get a single investment by ID
   */
  getInvestment: (id: string) =>
    apiClient.get<Investment>(`/financial/investments/${id}`),
  
  /**
   * Create a new investment
   */
  createInvestment: (data: Omit<Investment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<Investment>('/financial/investments', data),
  
  /**
   * Update an existing investment
   */
  updateInvestment: (id: string, data: Partial<Investment>) =>
    apiClient.patch<Investment>(`/financial/investments/${id}`, data),
  
  /**
   * Delete an investment
   */
  deleteInvestment: (id: string) =>
    apiClient.delete(`/financial/investments/${id}`),
  
  /**
   * Get transactions with optional filtering
   */
  getTransactions: (params?: { 
    startDate?: string; 
    endDate?: string;
    type?: 'income' | 'expense';
    category?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiClient.get<{ transactions: Transaction[]; total: number }>(`/financial/transactions${query}`);
  },
  
  /**
   * Create a new transaction
   */
  createTransaction: (data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<Transaction>('/financial/transactions', data),
  
  /**
   * Update an existing transaction
   */
  updateTransaction: (id: string, data: Partial<Transaction>) =>
    apiClient.patch<Transaction>(`/financial/transactions/${id}`, data),
  
  /**
   * Delete a transaction
   */
  deleteTransaction: (id: string) =>
    apiClient.delete(`/financial/transactions/${id}`),
};