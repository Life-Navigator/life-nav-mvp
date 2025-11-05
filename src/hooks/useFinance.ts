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

export default {
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
};
