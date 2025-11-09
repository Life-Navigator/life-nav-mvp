/**
 * Life Navigator - Finance Screen
 *
 * Financial overview and tracking
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFinance } from '../../hooks/useFinance';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { formatCurrency } from '../../utils/formatters';

export function FinanceScreen() {
  const { data, isLoading } = useFinance();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Net Worth Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Net Worth</Text>
        <Text style={styles.summaryValue}>
          {formatCurrency(data?.netWorth || 0)}
        </Text>
      </View>

      {/* Assets & Liabilities */}
      <View style={styles.row}>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Assets</Text>
          <Text style={styles.cardValue}>
            {formatCurrency(data?.totalAssets || 0)}
          </Text>
        </View>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Liabilities</Text>
          <Text style={styles.cardValue}>
            {formatCurrency(data?.totalLiabilities || 0)}
          </Text>
        </View>
      </View>

      {/* Accounts */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Accounts</Text>
        <View style={styles.accountItem}>
          <Text style={styles.accountName}>Checking</Text>
          <Text style={styles.accountBalance}>
            {formatCurrency(data?.checking || 0)}
          </Text>
        </View>
        <View style={styles.accountItem}>
          <Text style={styles.accountName}>Savings</Text>
          <Text style={styles.accountBalance}>
            {formatCurrency(data?.savings || 0)}
          </Text>
        </View>
        <View style={styles.accountItem}>
          <Text style={styles.accountName}>Investments</Text>
          <Text style={styles.accountBalance}>
            {formatCurrency(data?.investments || 0)}
          </Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Transactions</Text>
        <Text style={styles.emptyText}>No recent transactions</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountName: {
    fontSize: 14,
    color: colors.text,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
  },
});
