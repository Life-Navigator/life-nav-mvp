/**
 * Life Navigator - Accounts Screen
 *
 * Comprehensive financial accounts dashboard with account management,
 * balance tracking, syncing, and net worth calculation
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import {
  useAccounts,
  useSyncAccount,
  useTransactions,
  useNetWorthHistory,
} from '../../hooks/useFinance';
import { FinanceAccount } from '../../types';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import {
  formatCurrency,
  formatAccountNumber,
  formatDate,
  formatRelativeTime,
} from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { format, subMonths } from 'date-fns';

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  checking: '💳',
  savings: '🏦',
  credit: '💰',
  investment: '📈',
  loan: '🏠',
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  investment: 'Investment',
  loan: 'Loan',
};

export function AccountsScreen() {
  const [selectedAccount, setSelectedAccount] = useState<FinanceAccount | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);

  const { data: accounts, isLoading, refetch, isRefreshing } = useAccounts();
  const syncAccount = useSyncAccount();

  // Fetch recent transactions for selected account
  const { data: recentTransactions } = useTransactions({
    accountId: selectedAccount?.id,
    limit: 5,
  });

  // Fetch net worth history (last 6 months)
  const { data: netWorthHistory } = useNetWorthHistory({
    startDate: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Calculate totals by type
  const accountSummary = useMemo(() => {
    if (!accounts) return null;

    const assets = accounts
      .filter((a) => ['checking', 'savings', 'investment'].includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);

    const liabilities = accounts
      .filter((a) => ['credit', 'loan'].includes(a.type))
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const netWorth = assets - liabilities;

    // Group by type
    const byType: Record<string, { count: number; total: number }> = {};
    accounts.forEach((account) => {
      if (!byType[account.type]) {
        byType[account.type] = { count: 0, total: 0 };
      }
      byType[account.type].count += 1;
      byType[account.type].total += account.balance;
    });

    return {
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth,
      byType,
      accountCount: accounts.length,
    };
  }, [accounts]);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    if (!accounts) return {};

    return accounts.reduce((groups, account) => {
      const type = account.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as Record<string, FinanceAccount[]>);
  }, [accounts]);

  const handleSyncAccount = async (accountId: string) => {
    try {
      await syncAccount.mutateAsync(accountId);
      Alert.alert('Success', 'Account synced successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to sync account. Please try again.');
    }
  };

  const handleAddAccount = () => {
    Alert.alert(
      'Add Account',
      'Connect your bank account via Plaid or add manually',
      [
        {
          text: 'Connect with Plaid',
          onPress: () => {
            // Plaid integration would go here
            Alert.alert('Info', 'Plaid integration coming soon');
          },
        },
        {
          text: 'Add Manually',
          onPress: () => {
            setShowAddModal(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderAccountCard = (account: FinanceAccount) => {
    const isAsset = ['checking', 'savings', 'investment'].includes(account.type);
    const isLiability = ['credit', 'loan'].includes(account.type);
    const displayBalance = isLiability ? Math.abs(account.balance) : account.balance;
    const statusColor =
      account.status === 'active'
        ? colors.semantic.success
        : account.status === 'inactive'
        ? colors.semantic.warning
        : colors.gray[400];

    return (
      <TouchableOpacity
        key={account.id}
        style={styles.accountCard}
        onPress={() => {
          setSelectedAccount(account);
          setShowAccountDetails(true);
        }}
      >
        <View style={styles.accountCardHeader}>
          <View style={styles.accountCardLeft}>
            <Text style={styles.accountIcon}>
              {ACCOUNT_TYPE_ICONS[account.type] || '💼'}
            </Text>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{account.name}</Text>
              <Text style={styles.accountInstitution}>
                {account.institutionName}
              </Text>
              <Text style={styles.accountNumber}>
                {formatAccountNumber(account.lastFour)}
              </Text>
            </View>
          </View>
          <View style={styles.accountCardRight}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
        </View>

        <View style={styles.accountCardBody}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>
              {isLiability ? 'Balance Owed' : 'Balance'}
            </Text>
            <Text
              style={[
                styles.balanceAmount,
                {
                  color: isLiability
                    ? colors.semantic.error
                    : colors.semantic.success,
                },
              ]}
            >
              {isLiability && '-'}
              {formatCurrency(displayBalance)}
            </Text>
          </View>

          <View style={styles.accountCardFooter}>
            <Text style={styles.lastSynced}>
              Updated {formatRelativeTime(account.lastSynced)}
            </Text>
            {account.plaidAccountId && (
              <TouchableOpacity
                onPress={() => handleSyncAccount(account.id)}
                disabled={syncAccount.isPending}
              >
                <Text style={styles.syncButton}>
                  {syncAccount.isPending ? 'Syncing...' : 'Sync'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading accounts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accounts</Text>
        <Button
          title="Add Account"
          onPress={handleAddAccount}
          size="small"
          variant="primary"
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} />
        }
      >
        {/* Net Worth Summary */}
        {accountSummary && (
          <View style={styles.netWorthCard}>
            <Text style={styles.netWorthLabel}>Total Net Worth</Text>
            <Text
              style={[
                styles.netWorthValue,
                {
                  color:
                    accountSummary.netWorth >= 0
                      ? colors.semantic.success
                      : colors.semantic.error,
                },
              ]}
            >
              {formatCurrency(accountSummary.netWorth)}
            </Text>

            <View style={styles.netWorthBreakdown}>
              <View style={styles.netWorthItem}>
                <Text style={styles.netWorthItemLabel}>Assets</Text>
                <Text
                  style={[
                    styles.netWorthItemValue,
                    { color: colors.semantic.success },
                  ]}
                >
                  {formatCurrency(accountSummary.totalAssets)}
                </Text>
              </View>
              <View style={styles.netWorthDivider} />
              <View style={styles.netWorthItem}>
                <Text style={styles.netWorthItemLabel}>Liabilities</Text>
                <Text
                  style={[
                    styles.netWorthItemValue,
                    { color: colors.semantic.error },
                  ]}
                >
                  {formatCurrency(accountSummary.totalLiabilities)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Accounts by Type */}
        {Object.keys(groupedAccounts).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No accounts yet</Text>
            <Text style={styles.emptyStateText}>
              Add your financial accounts to get started
            </Text>
            <Button
              title="Add Your First Account"
              onPress={handleAddAccount}
              style={{ marginTop: spacing[4] }}
            />
          </View>
        ) : (
          Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <View key={type} style={styles.accountTypeSection}>
              <View style={styles.accountTypeHeader}>
                <Text style={styles.accountTypeTitle}>
                  {ACCOUNT_TYPE_LABELS[type] || type}
                </Text>
                <Text style={styles.accountTypeCount}>
                  {typeAccounts.length} {typeAccounts.length === 1 ? 'account' : 'accounts'}
                </Text>
              </View>
              {typeAccounts.map(renderAccountCard)}
            </View>
          ))
        )}

        {/* Net Worth Trend */}
        {netWorthHistory && netWorthHistory.length > 0 && (
          <View style={styles.trendCard}>
            <Text style={styles.trendTitle}>Net Worth Trend (6 Months)</Text>
            <Text style={styles.trendNote}>
              Chart visualization coming soon
            </Text>
            {/* Simple text representation */}
            <View style={styles.trendData}>
              {netWorthHistory.slice(-3).map((point, index) => (
                <View key={index} style={styles.trendPoint}>
                  <Text style={styles.trendDate}>
                    {formatDate(point.date, 'MMM yyyy')}
                  </Text>
                  <Text style={styles.trendValue}>
                    {formatCurrency(point.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Account Details Modal */}
      <Modal
        visible={showAccountDetails}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAccountDetails(false);
          setSelectedAccount(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedAccount && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Text style={styles.modalAccountIcon}>
                      {ACCOUNT_TYPE_ICONS[selectedAccount.type] || '💼'}
                    </Text>
                    <View>
                      <Text style={styles.modalTitle}>{selectedAccount.name}</Text>
                      <Text style={styles.modalSubtitle}>
                        {selectedAccount.institutionName}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAccountDetails(false);
                      setSelectedAccount(null);
                    }}
                  >
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Account Details */}
                <View style={styles.detailsSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Type</Text>
                    <Text style={styles.detailValue}>
                      {ACCOUNT_TYPE_LABELS[selectedAccount.type]}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Number</Text>
                    <Text style={styles.detailValue}>
                      {formatAccountNumber(selectedAccount.lastFour)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Balance</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        styles.detailValueBalance,
                        {
                          color:
                            selectedAccount.balance >= 0
                              ? colors.semantic.success
                              : colors.semantic.error,
                        },
                      ]}
                    >
                      {formatCurrency(selectedAccount.balance)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Currency</Text>
                    <Text style={styles.detailValue}>
                      {selectedAccount.currency}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {
                          color:
                            selectedAccount.status === 'active'
                              ? colors.semantic.success
                              : selectedAccount.status === 'inactive'
                              ? colors.semantic.warning
                              : colors.gray[500],
                        },
                      ]}
                    >
                      {selectedAccount.status.charAt(0).toUpperCase() +
                        selectedAccount.status.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Last Synced</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedAccount.lastSynced)}
                    </Text>
                  </View>
                </View>

                {/* Recent Transactions */}
                <View style={styles.recentTransactionsSection}>
                  <Text style={styles.recentTransactionsTitle}>
                    Recent Transactions
                  </Text>
                  {recentTransactions && recentTransactions.data.length > 0 ? (
                    recentTransactions.data.map((transaction) => (
                      <View key={transaction.id} style={styles.transactionRow}>
                        <View style={styles.transactionLeft}>
                          <Text
                            style={styles.transactionDescription}
                            numberOfLines={1}
                          >
                            {transaction.description}
                          </Text>
                          <Text style={styles.transactionDate}>
                            {formatDate(transaction.date, 'MMM dd')}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.transactionAmount,
                            {
                              color:
                                transaction.type === 'credit'
                                  ? colors.semantic.success
                                  : colors.semantic.error,
                            },
                          ]}
                        >
                          {transaction.type === 'credit' ? '+' : '-'}
                          {formatCurrency(Math.abs(transaction.amount))}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noTransactions}>
                      No recent transactions
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  {selectedAccount.plaidAccountId && (
                    <Button
                      title="Sync Account"
                      onPress={() => handleSyncAccount(selectedAccount.id)}
                      loading={syncAccount.isPending}
                      fullWidth
                    />
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Account Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Account Manually</Text>
            <Text style={styles.modalNote}>
              Manual account addition coming soon. Use Plaid for automatic
              integration.
            </Text>
            <Button
              title="Close"
              onPress={() => setShowAddModal(false)}
              variant="outline"
              fullWidth
              style={{ marginTop: spacing[4] }}
            />
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
  scrollView: {
    flex: 1,
  },
  netWorthCard: {
    backgroundColor: colors.primary.blue,
    margin: spacing[4],
    padding: spacing[6],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.lg,
  },
  netWorthLabel: {
    ...textStyles.body,
    color: colors.light.primary,
    opacity: 0.9,
    marginBottom: spacing[2],
  },
  netWorthValue: {
    ...textStyles.h1,
    color: colors.light.primary,
    fontWeight: '700',
    marginBottom: spacing[4],
  },
  netWorthBreakdown: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  netWorthItem: {
    alignItems: 'center',
  },
  netWorthItemLabel: {
    ...textStyles.bodySmall,
    color: colors.light.primary,
    opacity: 0.8,
    marginBottom: spacing[1],
  },
  netWorthItemValue: {
    ...textStyles.h4,
    fontWeight: '700',
  },
  netWorthDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  accountTypeSection: {
    marginTop: spacing[4],
  },
  accountTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  accountTypeTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  accountTypeCount: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
  },
  accountCard: {
    backgroundColor: colors.light.primary,
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    borderRadius: borderRadius.lg,
    ...shadows.md,
    overflow: 'hidden',
  },
  accountCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  accountCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  accountInstitution: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
    marginBottom: 2,
  },
  accountNumber: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  accountCardRight: {
    marginLeft: spacing[2],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accountCardBody: {
    padding: spacing[4],
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  balanceLabel: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
  },
  balanceAmount: {
    ...textStyles.h3,
    fontWeight: '700',
  },
  accountCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSynced: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  syncButton: {
    ...textStyles.label,
    color: colors.primary.blue,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[6],
    margin: spacing[4],
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
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
  trendCard: {
    backgroundColor: colors.light.primary,
    margin: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  trendTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  trendNote: {
    ...textStyles.bodySmall,
    color: colors.gray[500],
    fontStyle: 'italic',
    marginBottom: spacing[3],
  },
  trendData: {
    marginTop: spacing[2],
  },
  trendPoint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  trendDate: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
  },
  trendValue: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalAccountIcon: {
    fontSize: 40,
    marginRight: spacing[3],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  modalSubtitle: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  modalNote: {
    ...textStyles.body,
    color: colors.gray[600],
    textAlign: 'center',
    marginVertical: spacing[4],
  },
  closeButton: {
    ...textStyles.h3,
    color: colors.gray[500],
  },
  detailsSection: {
    backgroundColor: colors.gray[50],
    padding: spacing[4],
    borderRadius: borderRadius.md,
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  detailLabel: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  detailValue: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
  },
  detailValueBalance: {
    ...textStyles.h4,
  },
  recentTransactionsSection: {
    marginBottom: spacing[4],
  },
  recentTransactionsTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  transactionLeft: {
    flex: 1,
    marginRight: spacing[2],
  },
  transactionDescription: {
    ...textStyles.body,
    color: colors.gray[900],
    marginBottom: 2,
  },
  transactionDate: {
    ...textStyles.caption,
    color: colors.gray[600],
  },
  transactionAmount: {
    ...textStyles.body,
    fontWeight: '600',
  },
  noTransactions: {
    ...textStyles.body,
    color: colors.gray[500],
    textAlign: 'center',
    paddingVertical: spacing[4],
  },
  modalActions: {
    marginTop: spacing[2],
  },
});

export default AccountsScreen;
