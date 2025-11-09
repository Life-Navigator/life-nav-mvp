/**
 * Life Navigator - Finance Analytics Screen
 *
 * Advanced financial analytics with 10 comprehensive visualization types:
 * - Cash Flow Analysis, Spending by Category, Net Worth Trend, Budget vs Actual
 * - Investment Performance, Debt Reduction, Savings Rate, Tax Projections
 * - Retirement Forecast, Financial Health Score
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { LineChart, BarChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

const screenWidth = Dimensions.get('window').width;

// Mock data - replace with real API calls
const generateFinanceData = () => ({
  cashFlow: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    income: [5000, 5200, 5000, 5500, 5300, 5400],
    expenses: [3800, 4200, 3600, 4000, 3900, 3700],
  },
  spendingByCategory: [
    { name: 'Housing', amount: 1500, percentage: 0.38, color: '#EF4444' },
    { name: 'Food', amount: 600, percentage: 0.15, color: '#F59E0B' },
    { name: 'Transport', amount: 400, percentage: 0.10, color: '#10B981' },
    { name: 'Entertainment', amount: 300, percentage: 0.08, color: '#3B82F6' },
    { name: 'Utilities', amount: 250, percentage: 0.06, color: '#8B5CF6' },
    { name: 'Other', amount: 950, percentage: 0.23, color: '#6B7280' },
  ],
  netWorth: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    data: [45000, 47000, 48500, 50000, 51500, 53000, 54500, 56000, 57500, 59000, 60500, 62000],
  },
  budgetVsActual: {
    labels: ['Housing', 'Food', 'Transport', 'Entertainment', 'Utilities'],
    budgeted: [1600, 700, 450, 250, 300],
    actual: [1500, 600, 400, 300, 250],
  },
  investments: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    portfolio: [25000, 26000, 25500, 27000, 28000, 29500],
    roi: [0, 4, 2, 8, 12, 18],
  },
  debtReduction: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    total: [15000, 14200, 13400, 12600, 11800, 11000],
    creditCard: [5000, 4600, 4200, 3800, 3400, 3000],
    studentLoan: [10000, 9600, 9200, 8800, 8400, 8000],
  },
  savingsRate: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    rate: [0.24, 0.19, 0.28, 0.27, 0.26, 0.31],
    amount: [1200, 1000, 1400, 1500, 1400, 1700],
  },
  taxProjections: {
    estimatedIncome: 65000,
    federalTax: 9750,
    stateTax: 3250,
    fica: 4972.5,
    effectiveRate: 0.273,
  },
  retirement: {
    labels: ['Current', '10 yrs', '20 yrs', '30 yrs', '40 yrs'],
    projected: [62000, 145000, 285000, 520000, 890000],
    goal: [62000, 150000, 300000, 550000, 1000000],
  },
  financialHealth: {
    emergency: 0.85,
    debt: 0.72,
    savings: 0.78,
    investments: 0.65,
    overall: 0.75,
  },
});

export function FinanceAnalyticsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  const data = generateFinanceData();

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 10,
    },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const totalIncome = data.cashFlow.income.reduce((a, b) => a + b, 0);
      const totalExpenses = data.cashFlow.expenses.reduce((a, b) => a + b, 0);
      const netSavings = totalIncome - totalExpenses;

      const exportData = `
Finance Analytics Report
Generated: ${new Date().toLocaleDateString()}

CASH FLOW (Last 6 Months)
- Total Income: ${formatCurrency(totalIncome)}
- Total Expenses: ${formatCurrency(totalExpenses)}
- Net Savings: ${formatCurrency(netSavings)}

NET WORTH: ${formatCurrency(data.netWorth.data[data.netWorth.data.length - 1])}

SPENDING BY CATEGORY
${data.spendingByCategory.map(cat => `- ${cat.name}: ${formatCurrency(cat.amount)} (${Math.round(cat.percentage * 100)}%)`).join('\n')}

DEBT REDUCTION
- Current Total Debt: ${formatCurrency(data.debtReduction.total[data.debtReduction.total.length - 1])}
- Credit Card: ${formatCurrency(data.debtReduction.creditCard[data.debtReduction.creditCard.length - 1])}
- Student Loan: ${formatCurrency(data.debtReduction.studentLoan[data.debtReduction.studentLoan.length - 1])}

INVESTMENT PORTFOLIO: ${formatCurrency(data.investments.portfolio[data.investments.portfolio.length - 1])}
ROI: ${data.investments.roi[data.investments.roi.length - 1]}%

FINANCIAL HEALTH SCORE: ${Math.round(data.financialHealth.overall * 100)}%
      `.trim();

      await Share.share({
        message: exportData,
        title: 'Finance Analytics Report',
      });
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export analytics data');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.finance} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Finance Analytics</Text>
        <View style={styles.timeRangeSelector}>
          {(['month', 'quarter', 'year'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.timeButton, timeRange === range && styles.timeButtonActive]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[styles.timeButtonText, timeRange === range && styles.timeButtonTextActive]}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          disabled={isExporting}
        >
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. Cash Flow Analysis */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Cash Flow Analysis</Text>
        <Text style={styles.chartSubtitle}>Income vs Expenses</Text>
        <LineChart
          data={{
            labels: data.cashFlow.labels,
            datasets: [
              {
                data: data.cashFlow.income,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.cashFlow.expenses,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                strokeWidth: 2,
              },
            ],
            legend: ['Income', 'Expenses'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>
              {formatCurrency(data.cashFlow.income.reduce((a, b) => a + b) / data.cashFlow.income.length)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>
              {formatCurrency(data.cashFlow.expenses.reduce((a, b) => a + b) / data.cashFlow.expenses.length)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net Savings</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(
                (data.cashFlow.income.reduce((a, b) => a + b) - data.cashFlow.expenses.reduce((a, b) => a + b)) /
                  data.cashFlow.income.length
              )}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Spending by Category */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Spending by Category</Text>
        <Text style={styles.chartSubtitle}>Monthly Distribution</Text>
        <PieChart
          data={data.spendingByCategory.map(cat => ({
            name: cat.name,
            population: cat.amount,
            color: cat.color,
            legendFontColor: colors.text.light.primary,
            legendFontSize: 12,
          }))}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
        <View style={styles.categoryList}>
          {data.spendingByCategory.map((cat, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.categoryName}>{cat.name}</Text>
              </View>
              <View style={styles.categoryDetails}>
                <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
                <Text style={styles.categoryPercentage}>{Math.round(cat.percentage * 100)}%</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 3. Net Worth Trend */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Net Worth Trend</Text>
        <Text style={styles.chartSubtitle}>12-Month Growth</Text>
        <LineChart
          data={{
            labels: data.netWorth.labels,
            datasets: [
              {
                data: data.netWorth.data,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 3,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots={false}
        />
        <View style={styles.netWorthStats}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{formatCurrency(data.netWorth.data[data.netWorth.data.length - 1])}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>YTD Growth</Text>
            <Text style={[styles.statValue, styles.growthText]}>
              +{formatCurrency(data.netWorth.data[data.netWorth.data.length - 1] - data.netWorth.data[0])}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>% Change</Text>
            <Text style={[styles.statValue, styles.growthText]}>
              +{(((data.netWorth.data[data.netWorth.data.length - 1] - data.netWorth.data[0]) / data.netWorth.data[0]) * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Budget vs Actual */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Budget vs Actual</Text>
        <Text style={styles.chartSubtitle}>Monthly Comparison</Text>
        <BarChart
          data={{
            labels: data.budgetVsActual.labels,
            datasets: [
              {
                data: data.budgetVsActual.budgeted,
                color: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
              },
              {
                data: data.budgetVsActual.actual,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
              },
            ],
            legend: ['Budgeted', 'Actual'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
        <View style={styles.budgetSummary}>
          {data.budgetVsActual.labels.map((label, index) => {
            const budgeted = data.budgetVsActual.budgeted[index];
            const actual = data.budgetVsActual.actual[index];
            const diff = budgeted - actual;
            const isUnder = diff > 0;
            return (
              <View key={index} style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>{label}</Text>
                <Text style={[styles.budgetDiff, { color: isUnder ? colors.semantic.success : colors.semantic.error }]}>
                  {isUnder ? '-' : '+'}{formatCurrency(Math.abs(diff))}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 5. Investment Performance */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Investment Performance</Text>
        <Text style={styles.chartSubtitle}>Portfolio Value & ROI</Text>
        <LineChart
          data={{
            labels: data.investments.labels,
            datasets: [
              {
                data: data.investments.portfolio,
                color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                strokeWidth: 2,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.investmentStats}>
          <View style={styles.investmentItem}>
            <Text style={styles.investmentLabel}>Portfolio Value</Text>
            <Text style={styles.investmentValue}>
              {formatCurrency(data.investments.portfolio[data.investments.portfolio.length - 1])}
            </Text>
          </View>
          <View style={styles.investmentItem}>
            <Text style={styles.investmentLabel}>Total ROI</Text>
            <Text style={[styles.investmentValue, styles.roiText]}>
              +{data.investments.roi[data.investments.roi.length - 1]}%
            </Text>
          </View>
          <View style={styles.investmentItem}>
            <Text style={styles.investmentLabel}>6-Month Gain</Text>
            <Text style={[styles.investmentValue, styles.roiText]}>
              +{formatCurrency(data.investments.portfolio[data.investments.portfolio.length - 1] - data.investments.portfolio[0])}
            </Text>
          </View>
        </View>
      </View>

      {/* 6. Debt Reduction */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Debt Reduction Progress</Text>
        <Text style={styles.chartSubtitle}>Total Debt Over Time</Text>
        <LineChart
          data={{
            labels: data.debtReduction.labels,
            datasets: [
              {
                data: data.debtReduction.total,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.debtReduction.creditCard,
                color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.debtReduction.studentLoan,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                strokeWidth: 2,
              },
            ],
            legend: ['Total', 'Credit Card', 'Student Loan'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.debtStats}>
          <View style={styles.debtItem}>
            <Text style={styles.debtLabel}>Paid Off (6 months)</Text>
            <Text style={[styles.debtValue, styles.paidOffText]}>
              {formatCurrency(data.debtReduction.total[0] - data.debtReduction.total[data.debtReduction.total.length - 1])}
            </Text>
          </View>
          <View style={styles.debtItem}>
            <Text style={styles.debtLabel}>Remaining</Text>
            <Text style={styles.debtValue}>
              {formatCurrency(data.debtReduction.total[data.debtReduction.total.length - 1])}
            </Text>
          </View>
          <View style={styles.debtItem}>
            <Text style={styles.debtLabel}>Debt-Free ETA</Text>
            <Text style={styles.debtValue}>16 months</Text>
          </View>
        </View>
      </View>

      {/* 7. Savings Rate */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Savings Rate Trend</Text>
        <Text style={styles.chartSubtitle}>Percentage of Income Saved</Text>
        <LineChart
          data={{
            labels: data.savingsRate.labels,
            datasets: [
              {
                data: data.savingsRate.rate.map(r => r * 100),
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 2,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          suffix="%"
        />
        <View style={styles.savingsGrid}>
          {data.savingsRate.labels.map((label, index) => (
            <View key={index} style={styles.savingsItem}>
              <Text style={styles.savingsMonth}>{label}</Text>
              <Text style={styles.savingsRate}>{Math.round(data.savingsRate.rate[index] * 100)}%</Text>
              <Text style={styles.savingsAmount}>{formatCurrency(data.savingsRate.amount[index])}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 8. Tax Projections */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Annual Tax Projections</Text>
        <View style={styles.taxContainer}>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>Estimated Income</Text>
            <Text style={styles.taxValue}>{formatCurrency(data.taxProjections.estimatedIncome)}</Text>
          </View>
          <View style={styles.taxDivider} />
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>Federal Tax</Text>
            <Text style={[styles.taxValue, styles.taxAmount]}>{formatCurrency(data.taxProjections.federalTax)}</Text>
          </View>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>State Tax</Text>
            <Text style={[styles.taxValue, styles.taxAmount]}>{formatCurrency(data.taxProjections.stateTax)}</Text>
          </View>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabel}>FICA</Text>
            <Text style={[styles.taxValue, styles.taxAmount]}>{formatCurrency(data.taxProjections.fica)}</Text>
          </View>
          <View style={styles.taxDivider} />
          <View style={styles.taxRow}>
            <Text style={styles.taxLabelBold}>Total Tax</Text>
            <Text style={styles.taxValueBold}>
              {formatCurrency(data.taxProjections.federalTax + data.taxProjections.stateTax + data.taxProjections.fica)}
            </Text>
          </View>
          <View style={styles.taxRow}>
            <Text style={styles.taxLabelBold}>Effective Rate</Text>
            <Text style={styles.taxValueBold}>{(data.taxProjections.effectiveRate * 100).toFixed(1)}%</Text>
          </View>
        </View>
        <PieChart
          data={[
            {
              name: 'Federal',
              population: data.taxProjections.federalTax,
              color: '#EF4444',
              legendFontColor: colors.text.light.primary,
              legendFontSize: 12,
            },
            {
              name: 'State',
              population: data.taxProjections.stateTax,
              color: '#F59E0B',
              legendFontColor: colors.text.light.primary,
              legendFontSize: 12,
            },
            {
              name: 'FICA',
              population: data.taxProjections.fica,
              color: '#3B82F6',
              legendFontColor: colors.text.light.primary,
              legendFontSize: 12,
            },
          ]}
          width={screenWidth - 40}
          height={200}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </View>

      {/* 9. Retirement Forecast */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Retirement Forecast</Text>
        <Text style={styles.chartSubtitle}>40-Year Projection</Text>
        <LineChart
          data={{
            labels: data.retirement.labels,
            datasets: [
              {
                data: data.retirement.projected,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.retirement.goal,
                color: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
                strokeWidth: 2,
                withDots: false,
              },
            ],
            legend: ['Projected', 'Goal'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.retirementStats}>
          <View style={styles.retirementItem}>
            <Text style={styles.retirementLabel}>40-Year Goal</Text>
            <Text style={styles.retirementValue}>
              {formatCurrency(data.retirement.goal[data.retirement.goal.length - 1])}
            </Text>
          </View>
          <View style={styles.retirementItem}>
            <Text style={styles.retirementLabel}>Projected</Text>
            <Text style={styles.retirementValue}>
              {formatCurrency(data.retirement.projected[data.retirement.projected.length - 1])}
            </Text>
          </View>
          <View style={styles.retirementItem}>
            <Text style={styles.retirementLabel}>On Track</Text>
            <Text style={[styles.retirementValue, { color: colors.semantic.warning }]}>89%</Text>
          </View>
        </View>
        <View style={styles.retirementNote}>
          <Text style={styles.retirementNoteText}>
            Projection assumes 7% average annual return and current contribution rate. Adjust contributions to meet your goal.
          </Text>
        </View>
      </View>

      {/* 10. Financial Health Score */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Financial Health Score</Text>
        <View style={styles.healthScoreContainer}>
          <View style={styles.healthScoreCircle}>
            <Text style={styles.healthScoreValue}>{Math.round(data.financialHealth.overall * 100)}</Text>
            <Text style={styles.healthScoreLabel}>Overall Score</Text>
          </View>
        </View>
        <ProgressChart
          data={{
            labels: ['Emergency', 'Debt Mgmt', 'Savings', 'Investments'],
            data: [
              data.financialHealth.emergency,
              data.financialHealth.debt,
              data.financialHealth.savings,
              data.financialHealth.investments,
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1, index = 0) => {
              const colors = ['rgba(16, 185, 129, ', 'rgba(59, 130, 246, ', 'rgba(245, 158, 11, ', 'rgba(139, 92, 246, '];
              return `${colors[index]}${opacity})`;
            },
          }}
          hideLegend={false}
          style={styles.chart}
        />
        <View style={styles.healthGrid}>
          {Object.entries(data.financialHealth).map(([key, value]) => (
            <View key={key} style={styles.healthItem}>
              <Text style={styles.healthLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              <View
                style={[
                  styles.healthBadge,
                  {
                    backgroundColor:
                      value >= 0.8 ? colors.semantic.success : value >= 0.6 ? colors.semantic.warning : colors.semantic.error,
                  },
                ]}
              >
                <Text style={styles.healthBadgeText}>{Math.round(value * 100)}%</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.text.light.secondary,
  },
  header: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  timeRangeSelector: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  timeButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 8,
    backgroundColor: colors.light.tertiary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  timeButtonActive: {
    backgroundColor: colors.domains.finance,
    borderColor: colors.domains.finance,
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.light.secondary,
  },
  timeButtonTextActive: {
    color: '#FFFFFF',
  },
  exportButton: {
    backgroundColor: colors.domains.finance,
    paddingVertical: spacing[3],
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: colors.light.primary,
    margin: spacing[3],
    padding: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  chartSubtitle: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  chart: {
    marginVertical: spacing[2],
    borderRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  incomeText: {
    color: colors.semantic.success,
  },
  expenseText: {
    color: colors.semantic.error,
  },
  categoryList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.light.primary,
  },
  categoryDetails: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  categoryPercentage: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  netWorthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  growthText: {
    color: colors.semantic.success,
  },
  budgetSummary: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: colors.text.light.primary,
  },
  budgetDiff: {
    fontSize: 14,
    fontWeight: '600',
  },
  investmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  investmentItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  investmentLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  investmentValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  roiText: {
    color: colors.semantic.success,
  },
  debtStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  debtItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  debtLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  debtValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  paidOffText: {
    color: colors.semantic.success,
  },
  savingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  savingsItem: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  savingsMonth: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  savingsRate: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.domains.finance,
    marginBottom: spacing[1],
  },
  savingsAmount: {
    fontSize: 12,
    color: colors.text.light.primary,
  },
  taxContainer: {
    marginBottom: spacing[3],
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  taxLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  taxValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.light.primary,
  },
  taxAmount: {
    color: colors.semantic.error,
  },
  taxDivider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: spacing[2],
  },
  taxLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  taxValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  retirementStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  retirementItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  retirementLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  retirementValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  retirementNote: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  retirementNoteText: {
    fontSize: 12,
    color: colors.text.light.secondary,
    lineHeight: 18,
  },
  healthScoreContainer: {
    alignItems: 'center',
    marginVertical: spacing[3],
  },
  healthScoreCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.domains.finance,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthScoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  healthScoreLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: spacing[1],
  },
  healthGrid: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  healthLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.light.primary,
  },
  healthBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 16,
  },
  healthBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: spacing[4],
  },
});
