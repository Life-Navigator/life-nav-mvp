/**
 * Life Navigator - Trend Charts Component
 *
 * Interactive charts for trend analysis
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { TrendDataPoint, TimeAllocation, GoalCompletion } from '../../types/analytics';

interface TrendChartsProps {
  trendData: TrendDataPoint[];
  timeAllocation: TimeAllocation[];
  goalCompletion: GoalCompletion[];
}

export const TrendCharts: React.FC<TrendChartsProps> = ({
  trendData,
  timeAllocation,
  goalCompletion,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing[8];

  const chartConfig = {
    backgroundColor: colors.light.primary,
    backgroundGradientFrom: colors.light.primary,
    backgroundGradientTo: colors.light.secondary,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary.blue,
    },
  };

  // Prepare 30-day trend data
  const last7Days = trendData.slice(-7);
  const lineChartData = {
    labels: last7Days.map((d) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        data: last7Days.map((d) => d.health),
        color: (opacity = 1) => colors.domains.healthcare,
        strokeWidth: 2,
      },
      {
        data: last7Days.map((d) => d.finance),
        color: (opacity = 1) => colors.domains.finance,
        strokeWidth: 2,
      },
      {
        data: last7Days.map((d) => d.career),
        color: (opacity = 1) => colors.domains.career,
        strokeWidth: 2,
      },
      {
        data: last7Days.map((d) => d.education),
        color: (opacity = 1) => colors.charts.blue,
        strokeWidth: 2,
      },
    ],
    legend: ['Health', 'Finance', 'Career', 'Education'],
  };

  // Prepare weekly bar chart data
  const barChartData = {
    labels: goalCompletion.map((g) => g.domain.slice(0, 3).toUpperCase()),
    datasets: [
      {
        data: goalCompletion.map((g) => g.percentage),
      },
    ],
  };

  // Prepare pie chart data for time allocation
  const pieChartData = timeAllocation.map((item) => ({
    name: item.domain.charAt(0).toUpperCase() + item.domain.slice(1),
    population: item.hours,
    color: item.color,
    legendFontColor: colors.text.light.secondary,
    legendFontSize: 12,
  }));

  return (
    <View style={styles.container}>
      {/* 30-Day Trend Line Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>30-Day Trend Across Domains</Text>
        <LineChart
          data={lineChartData}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          withDots={true}
          withShadow={false}
          withInnerLines={false}
          withOuterLines={true}
        />
        <View style={styles.legend}>
          {lineChartData.legend.map((label, index) => (
            <View key={label} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: lineChartData.datasets[index].color(1) as string,
                  },
                ]}
              />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Weekly Goals Completion Bar Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Goals Completion Rate</Text>
        <BarChart
          data={barChartData}
          width={chartWidth}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars={true}
          fromZero={true}
          yAxisSuffix="%"
        />
      </View>

      {/* Time Allocation Pie Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Time Allocation Across Life Areas</Text>
        <PieChart
          data={pieChartData}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
          absolute
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[4],
  },
  chartSection: {
    marginBottom: spacing[6],
    paddingHorizontal: spacing[4],
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[4],
  },
  chart: {
    marginVertical: spacing[2],
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing[3],
    gap: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing[1],
  },
  legendText: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
});
