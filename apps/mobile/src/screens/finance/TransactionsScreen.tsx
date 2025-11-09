/**
 * Life Navigator - Transactions Screen
 *
 * Comprehensive transaction history with infinite scroll,
 * filtering, searching, and CSV export capabilities
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  Share,
} from 'react-native';
import {
  useTransactions,
  useUpdateTransaction,
  useAccounts,
} from '../../hooks/useFinance';
import { Transaction } from '../../types';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatCurrency, formatDate, formatRelativeTime } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const TRANSACTION_CATEGORIES = [
  'All Categories',
  'Housing',
  'Transportation',
  'Food & Dining',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Personal Care',
  'Education',
  'Income',
  'Transfer',
  'Other',
];

const DATE_FILTERS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Month', custom: 'this_month' },
  { label: 'Last Month', custom: 'last_month' },
  { label: 'All Time', custom: 'all' },
];

export function TransactionsScreen() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
  const [dateFilter, setDateFilter] = useState(DATE_FILTERS[1]); // Last 30 days
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [newCategory, setNewCategory] = useState('');

  const { data: accounts } = useAccounts();
  const updateTransaction = useUpdateTransaction();

  // Calculate date range
  const dateRange = useMemo(() => {
    const today = new Date();
    let startDate: string;
    let endDate: string = format(today, 'yyyy-MM-dd');

    if (dateFilter.custom === 'this_month') {
      startDate = format(startOfMonth(today), 'yyyy-MM-dd');
      endDate = format(endOfMonth(today), 'yyyy-MM-dd');
    } else if (dateFilter.custom === 'last_month') {
      const lastMonth = subDays(startOfMonth(today), 1);
      startDate = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
      endDate = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
    } else if (dateFilter.custom === 'all') {
      startDate = format(subDays(today, 365 * 2), 'yyyy-MM-dd'); // 2 years
    } else {
      startDate = format(subDays(today, dateFilter.days || 30), 'yyyy-MM-dd');
    }

    return { startDate, endDate };
  }, [dateFilter]);

  // Fetch transactions with filters
  const {
    data: transactionsData,
    isLoading,
    isFetchingNextPage,
    refetch,
    isRefreshing,
  } = useTransactions({
    accountId: selectedAccount,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
    page,
    limit: 20,
  });

  // Filter by search query (client-side)
  const filteredTransactions = useMemo(() => {
    if (!transactionsData?.data) return [];

    if (!searchQuery) return transactionsData.data;

    return transactionsData.data.filter(
      (t) =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [transactionsData, searchQuery]);

  // Calculate summary
  const transactionsSummary = useMemo(() => {
    if (!filteredTransactions.length) {
      return { totalIncome: 0, totalExpenses: 0, netCashFlow: 0 };
    }

    const totalIncome = filteredTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = filteredTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    const netCashFlow = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, netCashFlow };
  }, [filteredTransactions]);

  const handleLoadMore = () => {
    if (transactionsData?.hasMore && !isFetchingNextPage) {
      setPage((p) => p + 1);
    }
  };

  const handleCategoryChange = async () => {
    if (!selectedTransaction || !newCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    try {
      await updateTransaction.mutateAsync({
        id: selectedTransaction.id,
        updates: { category: newCategory },
      });

      setShowCategoryModal(false);
      setSelectedTransaction(null);
      setNewCategory('');
      Alert.alert('Success', 'Transaction category updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  const handleExportCSV = async () => {
    if (!filteredTransactions.length) {
      Alert.alert('No Data', 'No transactions to export');
      return;
    }

    // Generate CSV content
    const headers = 'Date,Description,Category,Type,Amount,Account\n';
    const rows = filteredTransactions
      .map((t) => {
        const account = accounts?.find((a) => a.id === t.accountId);
        return `${t.date},"${t.description}",${t.category},${t.type},${t.amount},"${account?.name || 'Unknown'}"`;
      })
      .join('\n');

    const csv = headers + rows;

    try {
      if (Platform.OS === 'web') {
        // Web download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Mobile share
        await Share.share({
          message: csv,
          title: 'Transactions Export',
        });
      }
      Alert.alert('Success', 'Transactions exported successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to export transactions');
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const account = accounts?.find((a) => a.id === item.accountId);
    const isIncome = item.type === 'credit';

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => {
          setSelectedTransaction(item);
          setNewCategory(item.category);
          setShowCategoryModal(true);
        }}
      >
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.transactionIcon,
              {
                backgroundColor: isIncome
                  ? colors.semantic.success + '20'
                  : colors.semantic.error + '20',
              },
            ]}
          >
            <Text style={styles.transactionIconText}>{isIncome ? '↓' : '↑'}</Text>
          </View>
          <View style={styles.transactionDetails}>
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description}
            </Text>
            <Text style={styles.transactionCategory}>{item.category}</Text>
            <Text style={styles.transactionAccount}>
              {account?.name || 'Unknown Account'}
            </Text>
          </View>
        </View>

        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              {
                color: isIncome ? colors.semantic.success : colors.semantic.error,
              },
            ]}
          >
            {isIncome ? '+' : '-'}
            {formatCurrency(Math.abs(item.amount))}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date, 'MMM dd')}</Text>
          {item.pending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.semantic.success }]}>
              {formatCurrency(transactionsSummary.totalIncome)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.semantic.error }]}>
              {formatCurrency(transactionsSummary.totalExpenses)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    transactionsSummary.netCashFlow >= 0
                      ? colors.semantic.success
                      : colors.semantic.error,
                },
              ]}
            >
              {formatCurrency(transactionsSummary.netCashFlow)}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterChipsContainer}>
        <Text style={styles.filterLabel}>Date Range:</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={DATE_FILTERS}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                dateFilter.label === item.label && styles.filterChipActive,
              ]}
              onPress={() => setDateFilter(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  dateFilter.label === item.label && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Category Filter */}
      <View style={styles.filterChipsContainer}>
        <Text style={styles.filterLabel}>Category:</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TRANSACTION_CATEGORIES}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCategory === item && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === item && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Account Filter */}
      {accounts && accounts.length > 0 && (
        <View style={styles.filterChipsContainer}>
          <Text style={styles.filterLabel}>Account:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: 'all', name: 'All Accounts' }, ...accounts]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  (item.id === 'all' && !selectedAccount) ||
                  selectedAccount === item.id
                    ? styles.filterChipActive
                    : {},
                ]}
                onPress={() =>
                  setSelectedAccount(item.id === 'all' ? undefined : item.id)
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    (item.id === 'all' && !selectedAccount) ||
                    selectedAccount === item.id
                      ? styles.filterChipTextActive
                      : {},
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsCount}>
          {filteredTransactions.length} transactions
        </Text>
      </View>
    </>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary.blue} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No transactions found</Text>
      <Text style={styles.emptyStateText}>
        Try adjusting your filters or date range
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Button
          title="Export CSV"
          onPress={handleExportCSV}
          size="small"
          variant="outline"
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchInput}
        />
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Category Change Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCategoryModal(false);
          setSelectedTransaction(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Transaction</Text>

            {selectedTransaction && (
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionInfoLabel}>Description:</Text>
                <Text style={styles.transactionInfoValue}>
                  {selectedTransaction.description}
                </Text>

                <Text style={styles.transactionInfoLabel}>Amount:</Text>
                <Text style={styles.transactionInfoValue}>
                  {formatCurrency(selectedTransaction.amount)}
                </Text>

                <Text style={styles.transactionInfoLabel}>Date:</Text>
                <Text style={styles.transactionInfoValue}>
                  {formatDate(selectedTransaction.date)}
                </Text>
              </View>
            )}

            <Text style={styles.categorySelectorLabel}>Select Category:</Text>
            <View style={styles.categorySelector}>
              {TRANSACTION_CATEGORIES.filter((c) => c !== 'All Categories').map(
                (category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryOption,
                      newCategory === category && styles.categoryOptionSelected,
                    ]}
                    onPress={() => setNewCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        newCategory === category && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowCategoryModal(false);
                  setSelectedTransaction(null);
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <View style={{ width: spacing[3] }} />
              <Button
                title="Update"
                onPress={handleCategoryChange}
                loading={updateTransaction.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  searchContainer: {
    padding: spacing[4],
    paddingBottom: spacing[2],
    backgroundColor: colors.light.primary,
  },
  searchInput: {
    marginBottom: 0,
  },
  summaryCard: {
    backgroundColor: colors.light.primary,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginBottom: spacing[1],
  },
  summaryValue: {
    ...textStyles.h4,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing[2],
  },
  filterChipsContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  filterLabel: {
    ...textStyles.label,
    color: colors.gray[700],
    marginBottom: spacing[2],
  },
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
  },
  filterChipActive: {
    backgroundColor: colors.primary.blue,
  },
  filterChipText: {
    ...textStyles.bodySmall,
    color: colors.gray[700],
  },
  filterChipTextActive: {
    color: colors.light.primary,
    fontWeight: '600',
  },
  transactionsHeader: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  transactionsCount: {
    ...textStyles.label,
    color: colors.gray[600],
  },
  listContent: {
    paddingBottom: spacing[4],
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing[2],
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  transactionIconText: {
    fontSize: 20,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  transactionCategory: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginBottom: 2,
  },
  transactionAccount: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    ...textStyles.body,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  transactionDate: {
    ...textStyles.caption,
    color: colors.gray[600],
  },
  pendingBadge: {
    backgroundColor: colors.semantic.warning,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing[1],
  },
  pendingBadgeText: {
    ...textStyles.labelSmall,
    color: colors.light.primary,
    fontSize: 10,
  },
  footerLoader: {
    padding: spacing[4],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[6],
    marginTop: spacing[6],
  },
  emptyStateTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.gray[600],
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.light.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing[6],
    maxHeight: '90%',
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[4],
  },
  transactionInfo: {
    backgroundColor: colors.gray[50],
    padding: spacing[4],
    borderRadius: borderRadius.md,
    marginBottom: spacing[4],
  },
  transactionInfoLabel: {
    ...textStyles.label,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  transactionInfoValue: {
    ...textStyles.body,
    color: colors.gray[900],
    marginTop: spacing[1],
  },
  categorySelectorLabel: {
    ...textStyles.label,
    color: colors.gray[700],
    marginBottom: spacing[3],
  },
  categorySelector: {
    maxHeight: 200,
    marginBottom: spacing[4],
  },
  categoryOption: {
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    marginBottom: spacing[2],
  },
  categoryOptionSelected: {
    backgroundColor: colors.primary.blue,
  },
  categoryOptionText: {
    ...textStyles.body,
    color: colors.gray[700],
  },
  categoryOptionTextSelected: {
    color: colors.light.primary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});

export default TransactionsScreen;
