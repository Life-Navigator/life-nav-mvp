/**
 * Life Navigator - Predictive Analytics Component
 *
 * AI-powered predictions and forecasts
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { PredictiveAnalytics as PredictiveAnalyticsType } from '../../types/analytics';

interface PredictiveAnalyticsProps {
  predictions: PredictiveAnalyticsType[];
}

export const PredictiveAnalytics: React.FC<PredictiveAnalyticsProps> = ({ predictions }) => {
  const [selectedDomain, setSelectedDomain] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing[8];

  const currentPrediction = predictions[selectedDomain];

  const chartConfig = {
    backgroundColor: colors.light.primary,
    backgroundGradientFrom: colors.light.primary,
    backgroundGradientTo: colors.light.secondary,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.domains.career,
    },
  };

  // Prepare prediction chart data
  const predictionChartData = {
    labels: currentPrediction.predictions.slice(0, 7).map((p) => {
      const date = new Date(p.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: currentPrediction.predictions.slice(0, 7).map((p) => p.predictedScore),
        strokeWidth: 2,
      },
    ],
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return colors.semantic.success;
    if (confidence >= 0.6) return colors.semantic.warning;
    return colors.semantic.error;
  };

  const getRiskColor = (probability: number) => {
    if (probability >= 0.7) return colors.semantic.error;
    if (probability >= 0.4) return colors.semantic.warning;
    return colors.semantic.info;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Predictive Analytics</Text>
      <Text style={styles.subtitle}>AI-powered forecasts for the next 30 days</Text>

      {/* Domain Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.domainSelector}
        contentContainerStyle={styles.domainSelectorContent}
      >
        {predictions.map((prediction, index) => (
          <TouchableOpacity
            key={prediction.domain}
            style={[
              styles.domainButton,
              selectedDomain === index && styles.domainButtonActive,
            ]}
            onPress={() => setSelectedDomain(index)}
          >
            <Text
              style={[
                styles.domainButtonText,
                selectedDomain === index && styles.domainButtonTextActive,
              ]}
            >
              {prediction.domain.charAt(0).toUpperCase() + prediction.domain.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Prediction Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>30-Day Score Projection</Text>
        <LineChart
          data={predictionChartData}
          width={chartWidth}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots={true}
          withShadow={false}
          withInnerLines={false}
          withOuterLines={true}
        />
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>Average Confidence:</Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceBarFill,
                {
                  width: `${
                    (currentPrediction.predictions.reduce((acc, p) => acc + p.confidence, 0) /
                      currentPrediction.predictions.length) *
                    100
                  }%`,
                  backgroundColor: getConfidenceColor(
                    currentPrediction.predictions.reduce((acc, p) => acc + p.confidence, 0) /
                      currentPrediction.predictions.length
                  ),
                },
              ]}
            />
          </View>
          <Text style={styles.confidenceValue}>
            {(
              (currentPrediction.predictions.reduce((acc, p) => acc + p.confidence, 0) /
                currentPrediction.predictions.length) *
              100
            ).toFixed(0)}
            %
          </Text>
        </View>
      </View>

      {/* Goal Completion Probability */}
      <View style={styles.goalSection}>
        <Text style={styles.sectionTitle}>Goal Completion Probability</Text>
        <View style={styles.probabilityContainer}>
          <View style={styles.probabilityCircle}>
            <Text style={styles.probabilityValue}>
              {(currentPrediction.goalCompletionProbability * 100).toFixed(0)}%
            </Text>
          </View>
          <Text style={styles.probabilityLabel}>
            Likelihood of completing goals in this domain
          </Text>
        </View>
      </View>

      {/* Risk Forecasts */}
      <View style={styles.risksSection}>
        <Text style={styles.sectionTitle}>Risk Forecasts</Text>
        {currentPrediction.risks.map((risk, index) => (
          <View key={index} style={styles.riskCard}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskType}>{risk.type}</Text>
              <View
                style={[
                  styles.riskBadge,
                  { backgroundColor: getRiskColor(risk.probability) },
                ]}
              >
                <Text style={styles.riskBadgeText}>
                  {(risk.probability * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
            <Text style={styles.riskImpact}>Impact: {risk.impact}</Text>
          </View>
        ))}
      </View>

      {/* Opportunity Windows */}
      <View style={styles.opportunitiesSection}>
        <Text style={styles.sectionTitle}>Opportunity Windows</Text>
        {currentPrediction.opportunities.map((opportunity, index) => (
          <View key={index} style={styles.opportunityCard}>
            <View style={styles.opportunityHeader}>
              <Text style={styles.opportunityIcon}>🎯</Text>
              <Text style={styles.opportunityType}>{opportunity.type}</Text>
            </View>
            <View style={styles.opportunityDetails}>
              <View style={styles.opportunityRow}>
                <Text style={styles.opportunityLabel}>Window:</Text>
                <Text style={styles.opportunityValue}>{opportunity.window}</Text>
              </View>
              <View style={styles.opportunityRow}>
                <Text style={styles.opportunityLabel}>Potential:</Text>
                <Text style={styles.opportunityValue}>{opportunity.potential}</Text>
              </View>
            </View>
          </View>
        ))}
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
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[4],
  },
  domainSelector: {
    marginBottom: spacing[4],
  },
  domainSelectorContent: {
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  domainButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 20,
    backgroundColor: colors.light.secondary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  domainButtonActive: {
    backgroundColor: colors.domains.career,
    borderColor: colors.domains.career,
  },
  domainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.secondary,
  },
  domainButtonTextActive: {
    color: colors.text.light.inverse,
  },
  chartSection: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  chart: {
    marginVertical: spacing[2],
    borderRadius: 16,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  confidenceLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.light.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  goalSection: {
    marginBottom: spacing[5],
  },
  probabilityContainer: {
    alignItems: 'center',
    padding: spacing[4],
  },
  probabilityCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.light.secondary,
    borderWidth: 8,
    borderColor: colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  probabilityValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  probabilityLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  risksSection: {
    marginBottom: spacing[5],
  },
  riskCard: {
    backgroundColor: colors.light.secondary,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  riskType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  riskBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.light.inverse,
  },
  riskImpact: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  opportunitiesSection: {
    marginBottom: spacing[2],
  },
  opportunityCard: {
    backgroundColor: colors.light.secondary,
    borderRadius: 8,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  opportunityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  opportunityIcon: {
    fontSize: 20,
  },
  opportunityType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  opportunityDetails: {
    gap: spacing[1],
  },
  opportunityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opportunityLabel: {
    fontSize: 12,
    color: colors.text.light.tertiary,
  },
  opportunityValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.light.secondary,
  },
});
