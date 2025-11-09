/**
 * Life Navigator - Period Comparisons Component
 *
 * Compare analytics across different time periods
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { DomainComparison, PeriodComparison } from '../../types/analytics';

interface PeriodComparisonsProps {
  comparisons: DomainComparison[];
}

export const PeriodComparisons: React.FC<PeriodComparisonsProps> = ({ comparisons }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<
    'week' | 'month' | 'quarter' | 'year'
  >('week');

  const periods = [
    { key: 'week' as const, label: 'Week' },
    { key: 'month' as const, label: 'Month' },
    { key: 'quarter' as const, label: 'Quarter' },
    { key: 'year' as const, label: 'Year' },
  ];

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      week: 'Week over Week',
      month: 'Month over Month',
      quarter: 'Quarter over Quarter',
      year: 'Year over Year',
    };
    return labels[period] || period;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return colors.semantic.success;
    if (change < 0) return colors.semantic.error;
    return colors.gray[500];
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Period Comparisons</Text>

      {/* Period Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodSelector}
        contentContainerStyle={styles.periodSelectorContent}
      >
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Comparison Cards */}
      <View style={styles.comparisonsList}>
        {comparisons.map((domainComparison) => {
          const comparison = domainComparison.comparisons.find(
            (c) => c.period === selectedPeriod
          );

          if (!comparison) return null;

          return (
            <View key={domainComparison.domain} style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}>
                <Text style={styles.domainName}>
                  {domainComparison.domain.charAt(0).toUpperCase() +
                    domainComparison.domain.slice(1)}
                </Text>
                <Text style={styles.periodLabel}>{getPeriodLabel(selectedPeriod)}</Text>
              </View>

              <View style={styles.comparisonContent}>
                <View style={styles.valueContainer}>
                  <Text style={styles.valueLabel}>Current</Text>
                  <Text style={styles.currentValue}>{comparison.current}</Text>
                </View>

                <View style={styles.changeContainer}>
                  <Text
                    style={[
                      styles.changeIcon,
                      { color: getChangeColor(comparison.change) },
                    ]}
                  >
                    {getChangeIcon(comparison.change)}
                  </Text>
                  <Text
                    style={[
                      styles.changeValue,
                      { color: getChangeColor(comparison.change) },
                    ]}
                  >
                    {Math.abs(comparison.change)}
                  </Text>
                </View>

                <View style={styles.valueContainer}>
                  <Text style={styles.valueLabel}>Previous</Text>
                  <Text style={styles.previousValue}>{comparison.previous}</Text>
                </View>
              </View>

              <View style={styles.percentageContainer}>
                <Text
                  style={[
                    styles.percentageText,
                    { color: getChangeColor(comparison.percentageChange) },
                  ]}
                >
                  {comparison.percentageChange > 0 ? '+' : ''}
                  {comparison.percentageChange.toFixed(1)}%
                </Text>
                <Text style={styles.percentageLabel}>change</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[4],
  },
  periodSelector: {
    marginBottom: spacing[4],
  },
  periodSelectorContent: {
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  periodButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 20,
    backgroundColor: colors.light.secondary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  periodButtonActive: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.secondary,
  },
  periodButtonTextActive: {
    color: colors.text.light.inverse,
  },
  comparisonsList: {
    gap: spacing[3],
  },
  comparisonCard: {
    backgroundColor: colors.light.secondary,
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  domainName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  periodLabel: {
    fontSize: 12,
    color: colors.text.light.tertiary,
  },
  comparisonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  valueContainer: {
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 10,
    color: colors.text.light.tertiary,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
  },
  currentValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  previousValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.light.secondary,
  },
  changeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  changeIcon: {
    fontSize: 24,
    fontWeight: '700',
  },
  changeValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing[1],
  },
  percentageContainer: {
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  percentageText: {
    fontSize: 20,
    fontWeight: '700',
  },
  percentageLabel: {
    fontSize: 12,
    color: colors.text.light.tertiary,
    marginTop: spacing[1],
  },
});
