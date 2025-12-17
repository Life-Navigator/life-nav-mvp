/**
 * Finance Data Hooks
 *
 * React Query hooks for fetching and mutating financial data.
 * Connects to backend API endpoints for accounts, transactions, and budgets.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/client';

// Types
export interface FinancialAccount {
  id: string;
  account_name: string;
  account_type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | 'other';
  institution_name?: string;
  account_number_last4?: string;
  currency: string;
  current_balance?: number;
  available_balance?: number;
  credit_limit?: number;
  interest_rate?: number;
  status: 'active' | 'closed' | 'frozen';
  is_manual: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name?: string;
  category?: string;
  subcategory?: string;
  transaction_type: 'debit' | 'credit';
  is_recurring: boolean;
  is_pending: boolean;
  metadata?: Record<string, any>;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  currency: string;
  start_date: string;
  end_date?: string;
  alert_threshold: number;
  alert_enabled: boolean;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface FinancialSummary {
  total_balance: number;
  total_income: number;
  total_expenses: number;
  net_worth: number;
  accounts_count: number;
  transactions_this_month: number;
  budget_utilization: number;
  top_categories: Array<{ category: string; amount: number; percentage: number }>;
}

// Query Keys
export const financeQueryKeys = {
  all: ['finance'] as const,
  accounts: () => [...financeQueryKeys.all, 'accounts'] as const,
  account: (id: string) => [...financeQueryKeys.accounts(), id] as const,
  transactions: (filters?: Record<string, any>) =>
    [...financeQueryKeys.all, 'transactions', filters] as const,
  transaction: (id: string) => [...financeQueryKeys.all, 'transactions', id] as const,
  budgets: () => [...financeQueryKeys.all, 'budgets'] as const,
  budget: (id: string) => [...financeQueryKeys.budgets(), id] as const,
  summary: () => [...financeQueryKeys.all, 'summary'] as const,
};

// Hooks

/**
 * Fetch financial summary/overview
 */
export function useFinancialSummary() {
  const api = useApiClient();

  return useQuery({
    queryKey: financeQueryKeys.summary(),
    queryFn: async () => {
      const response = await api.get<FinancialSummary>('/data/financial/summary');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch all financial accounts
 */
export function useFinancialAccounts() {
  const api = useApiClient();

  return useQuery({
    queryKey: financeQueryKeys.accounts(),
    queryFn: async () => {
      const response = await api.get<FinancialAccount[]>('/data/financial/accounts');
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch single financial account
 */
export function useFinancialAccount(id: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: financeQueryKeys.account(id),
    queryFn: async () => {
      const response = await api.get<FinancialAccount>(`/data/financial/accounts/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create financial account mutation
 */
export function useCreateAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<FinancialAccount, 'id' | 'created_at' | 'updated_at'>) => {
      return api.post<FinancialAccount>('/data/financial/accounts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.summary() });
    },
  });
}

/**
 * Update financial account mutation
 */
export function useUpdateAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FinancialAccount> }) => {
      return api.patch<FinancialAccount>(`/data/financial/accounts/${id}`, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.account(id) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts() });
    },
  });
}

/**
 * Delete financial account mutation
 */
export function useDeleteAccount() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/data/financial/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.summary() });
    },
  });
}

/**
 * Fetch transactions with optional filters
 */
export function useTransactions(filters?: {
  account_id?: string;
  start_date?: string;
  end_date?: string;
  category?: string;
  skip?: number;
  limit?: number;
}) {
  const api = useApiClient();

  return useQuery({
    queryKey: financeQueryKeys.transactions(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) params.append(key, String(value));
        });
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<Transaction[]>(`/data/financial/transactions${query}`);
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Create transaction mutation
 */
export function useCreateTransaction() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
      return api.post<Transaction>('/data/financial/transactions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.summary() });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts() });
    },
  });
}

/**
 * Update transaction mutation
 */
export function useUpdateTransaction() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Transaction> }) => {
      return api.patch<Transaction>(`/data/financial/transactions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.summary() });
    },
  });
}

/**
 * Delete transaction mutation
 */
export function useDeleteTransaction() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/data/financial/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.summary() });
    },
  });
}

/**
 * Fetch all budgets
 */
export function useBudgets() {
  const api = useApiClient();

  return useQuery({
    queryKey: financeQueryKeys.budgets(),
    queryFn: async () => {
      const response = await api.get<Budget[]>('/data/financial/budgets');
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Create budget mutation
 */
export function useCreateBudget() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Budget, 'id' | 'created_at' | 'updated_at'>) => {
      return api.post<Budget>('/data/financial/budgets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets() });
    },
  });
}

/**
 * Update budget mutation
 */
export function useUpdateBudget() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Budget> }) => {
      return api.patch<Budget>(`/data/financial/budgets/${id}`, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budget(id) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets() });
    },
  });
}

/**
 * Delete budget mutation
 */
export function useDeleteBudget() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/data/financial/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.budgets() });
    },
  });
}
