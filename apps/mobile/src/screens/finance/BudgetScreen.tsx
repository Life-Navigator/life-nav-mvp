/**
 * Life Navigator - Budget Screen
 *
 * Comprehensive budget tracking with category management,
 * progress visualization, and spending alerts
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
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useSpendingByCategory,
} from '../../hooks/useFinance';
import { Budget } from '../../types';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatCurrency, formatPercentage, formatDate } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

const BUDGET_CATEGORIES = [
  'Housing',
  'Transportation',
  'Food & Dining',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Personal Care',
  'Education',
  'Savings',
  'Debt Payment',
  'Insurance',
  'Gifts & Donations',
  'Other',
];

export function BudgetScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');

  const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data: budgets, isLoading, refetch, isRefreshing } = useBudgets();
  const { data: spending } = useSpendingByCategory({ startDate, endDate });
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  // Calculate budget summaries
  const budgetSummary = useMemo(() => {
    if (!budgets || !spending) return null;

    const totalBudgeted = budgets.reduce((sum, b) => sum + b.limit, 0);
    const totalSpent = spending.reduce((sum, s) => sum + s.amount, 0);
    const remaining = totalBudgeted - totalSpent;
    const percentageUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

    return {
      totalBudgeted,
      totalSpent,
      remaining,
      percentageUsed,
      isOverbudget: totalSpent > totalBudgeted,
    };
  }, [budgets, spending]);

  // Merge budgets with actual spending
  const budgetItems = useMemo(() => {
    if (!budgets || !spending) return [];

    return budgets.map((budget) => {
      const spendingData = spending.find((s) => s.category === budget.category);
      const spent = spendingData?.amount || 0;
      const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
      const remaining = budget.limit - spent;
      const isOverbudget = spent > budget.limit;
      const isWarning = percentage >= 80 && !isOverbudget;

      return {
        ...budget,
        spent,
        percentage,
        remaining,
        isOverbudget,
        isWarning,
      };
    });
  }, [budgets, spending]);

  // Previous month comparison
  const previousMonthData = useMemo(() => {
    const prevMonth = subMonths(selectedMonth, 1);
    return {
      month: format(prevMonth, 'MMMM yyyy'),
      // This would ideally come from API with historical data
    };
  }, [selectedMonth]);

  const handleAddBudget = async () => {
    if (!newBudgetCategory || !newBudgetLimit) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const limit = parseFloat(newBudgetLimit);
    if (isNaN(limit) || limit <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      await createBudget.mutateAsync({
        category: newBudgetCategory,
        limit,
        spent: 0,
        period: 'monthly',
        startDate,
        endDate,
      });

      setShowAddModal(false);
      setNewBudgetCategory('');
      setNewBudgetLimit('');
      Alert.alert('Success', 'Budget category added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add budget category');
    }
  };

  const handleUpdateBudget = async (budgetId: string, newLimit: number) => {
    try {
      await updateBudget.mutateAsync({
        id: budgetId,
        updates: { limit: newLimit },
      });
      Alert.alert('Success', 'Budget updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update budget');
    }
  };

  const handleDeleteBudget = async (budgetId: string, category: string) => {
    Alert.alert(
      'Delete Budget',
      `Are you sure you want to delete the ${category} budget?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudget.mutateAsync(budgetId);
              Alert.alert('Success', 'Budget deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete budget');
            }
          },
        },
      ]
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth((current) =>
      direction === 'prev' ? subMonths(current, 1) : subMonths(current, -1)
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading budgets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Budget Tracker</Text>
        <Button
          title="Add Category"
          onPress={() => setShowAddModal(true)}
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
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={() => navigateMonth('prev')}
            style={styles.monthButton}
          >
            <Text style={styles.monthButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>{format(selectedMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            onPress={() => navigateMonth('next')}
            style={styles.monthButton}
          >
            <Text style={styles.monthButtonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Budget Summary Card */}
        {budgetSummary && (
          <View
            style={[
              styles.summaryCard,
              budgetSummary.isOverbudget && styles.summaryCardOverbudget,
            ]}
          >
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Monthly Overview</Text>
              {budgetSummary.isOverbudget && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>Over Budget</Text>
                </View>
              )}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Budgeted</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(budgetSummary.totalBudgeted)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Spent</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    budgetSummary.isOverbudget && styles.summaryValueDanger,
                  ]}
                >
                  {formatCurrency(budgetSummary.totalSpent)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    budgetSummary.remaining < 0
                      ? styles.summaryValueDanger
                      : styles.summaryValueSuccess,
                  ]}
                >
                  {formatCurrency(budgetSummary.remaining)}
                </Text>
              </View>
            </View>

            {/* Overall Progress Bar */}
            <View style={styles.overallProgressContainer}>
              <View style={styles.overallProgressHeader}>
                <Text style={styles.overallProgressLabel}>Overall Progress</Text>
                <Text style={styles.overallProgressPercentage}>
                  {formatPercentage(budgetSummary.percentageUsed, 0)}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(budgetSummary.percentageUsed, 100)}%`,
                      backgroundColor: budgetSummary.isOverbudget
                        ? colors.semantic.error
                        : budgetSummary.percentageUsed >= 80
                        ? colors.semantic.warning
                        : colors.semantic.success,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Budget Categories */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Budget Categories</Text>

          {budgetItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No budgets set</Text>
              <Text style={styles.emptyStateText}>
                Add budget categories to start tracking your spending
              </Text>
              <Button
                title="Add Your First Budget"
                onPress={() => setShowAddModal(true)}
                style={{ marginTop: spacing[4] }}
              />
            </View>
          ) : (
            budgetItems.map((item) => (
              <View key={item.id} style={styles.budgetCard}>
                <View style={styles.budgetCardHeader}>
                  <View style={styles.budgetCardTitleRow}>
                    <Text style={styles.budgetCategory}>{item.category}</Text>
                    {item.isOverbudget && (
                      <View style={styles.overbudgetBadge}>
                        <Text style={styles.overbudgetBadgeText}>Over</Text>
                      </View>
                    )}
                    {item.isWarning && !item.isOverbudget && (
                      <View style={styles.warningBadge}>
                        <Text style={styles.warningBadgeText}>Warning</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteBudget(item.id, item.category)}
                  >
                    <Text style={styles.deleteButton}>Delete</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.budgetAmounts}>
                  <Text style={styles.budgetSpent}>
                    {formatCurrency(item.spent)} of {formatCurrency(item.limit)}
                  </Text>
                  <Text
                    style={[
                      styles.budgetRemaining,
                      item.remaining < 0 && styles.budgetRemainingNegative,
                    ]}
                  >
                    {item.remaining >= 0 ? 'Remaining: ' : 'Over by: '}
                    {formatCurrency(Math.abs(item.remaining))}
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(item.percentage, 100)}%`,
                        backgroundColor: item.isOverbudget
                          ? colors.semantic.error
                          : item.isWarning
                          ? colors.semantic.warning
                          : colors.semantic.success,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercentage}>
                  {formatPercentage(item.percentage, 0)} used
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Month-over-Month Comparison */}
        {budgetSummary && (
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonTitle}>Monthly Comparison</Text>
            <Text style={styles.comparisonSubtitle}>
              vs. {previousMonthData.month}
            </Text>
            <Text style={styles.comparisonNote}>
              Historical comparison data coming soon
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Budget Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Budget Category</Text>

            <Input
              label="Category"
              value={newBudgetCategory}
              onChangeText={setNewBudgetCategory}
              placeholder="Select or enter category"
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryChips}
            >
              {BUDGET_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    newBudgetCategory === category && styles.categoryChipSelected,
                  ]}
                  onPress={() => setNewBudgetCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      newBudgetCategory === category &&
                        styles.categoryChipTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Monthly Budget Limit"
              value={newBudgetLimit}
              onChangeText={setNewBudgetLimit}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddModal(false);
                  setNewBudgetCategory('');
                  setNewBudgetLimit('');
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <View style={{ width: spacing[3] }} />
              <Button
                title="Add Budget"
                onPress={handleAddBudget}
                loading={createBudget.isPending}
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
  scrollView: {
    flex: 1,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
  },
  monthButton: {
    padding: spacing[2],
  },
  monthButtonText: {
    ...textStyles.h3,
    color: colors.primary.blue,
  },
  monthText: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  summaryCard: {
    backgroundColor: colors.light.primary,
    margin: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  summaryCardOverbudget: {
    borderWidth: 2,
    borderColor: colors.semantic.error,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  summaryTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  alertBadge: {
    backgroundColor: colors.semantic.error,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  alertBadgeText: {
    ...textStyles.labelSmall,
    color: colors.light.primary,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginBottom: spacing[1],
  },
  summaryValue: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  summaryValueSuccess: {
    color: colors.semantic.success,
  },
  summaryValueDanger: {
    color: colors.semantic.error,
  },
  overallProgressContainer: {
    marginTop: spacing[2],
  },
  overallProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  overallProgressLabel: {
    ...textStyles.label,
    color: colors.gray[700],
  },
  overallProgressPercentage: {
    ...textStyles.label,
    color: colors.gray[900],
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  categoriesSection: {
    padding: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[6],
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
  budgetCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  budgetCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  budgetCategory: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  overbudgetBadge: {
    backgroundColor: colors.semantic.error,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    marginLeft: spacing[2],
  },
  overbudgetBadgeText: {
    ...textStyles.labelSmall,
    color: colors.light.primary,
    fontWeight: '600',
  },
  warningBadge: {
    backgroundColor: colors.semantic.warning,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    marginLeft: spacing[2],
  },
  warningBadgeText: {
    ...textStyles.labelSmall,
    color: colors.light.primary,
    fontWeight: '600',
  },
  deleteButton: {
    ...textStyles.label,
    color: colors.semantic.error,
  },
  budgetAmounts: {
    marginBottom: spacing[3],
  },
  budgetSpent: {
    ...textStyles.body,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  budgetRemaining: {
    ...textStyles.bodySmall,
    color: colors.semantic.success,
  },
  budgetRemainingNegative: {
    color: colors.semantic.error,
  },
  progressPercentage: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginTop: spacing[1],
  },
  comparisonCard: {
    backgroundColor: colors.light.primary,
    margin: spacing[4],
    marginTop: 0,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  comparisonTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  comparisonSubtitle: {
    ...textStyles.body,
    color: colors.gray[600],
    marginBottom: spacing[3],
  },
  comparisonNote: {
    ...textStyles.bodySmall,
    color: colors.gray[500],
    fontStyle: 'italic',
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
  categoryChips: {
    marginBottom: spacing[4],
    maxHeight: 50,
  },
  categoryChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing[2],
  },
  categoryChipSelected: {
    backgroundColor: colors.primary.blue,
  },
  categoryChipText: {
    ...textStyles.bodySmall,
    color: colors.gray[700],
  },
  categoryChipTextSelected: {
    color: colors.light.primary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
});

export default BudgetScreen;
