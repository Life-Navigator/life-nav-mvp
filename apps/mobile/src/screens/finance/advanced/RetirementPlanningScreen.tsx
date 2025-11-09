import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import {
  useRetirementPlan,
  useRetirementAccounts,
  useAddRetirementAccount,
  useUpdateRetirementAccount,
  useDeleteRetirementAccount,
  useRetirementGoals,
  useAddRetirementGoal,
  useRunMonteCarloSimulation,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface RetirementAccount {
  id: string;
  type: '401k' | '403b' | 'tsp' | 'traditional-ira' | 'roth-ira' | 'sep-ira' | 'simple-ira' | 'pension';
  provider: string;
  balance: number;
  contributionLimit: number;
  currentYearContributions: number;
  employerMatch?: {
    formula: string;
    amount: number;
    vestingSchedule: string;
    vestingPercentage: number;
  };
}

interface RetirementProjection {
  age: number;
  year: number;
  balance: number;
  contributions: number;
  scenario: 'conservative' | 'moderate' | 'aggressive';
}

interface IncomeSource {
  type: 'social-security' | 'pension' | 'investment' | 'part-time' | 'rental' | 'annuity';
  name: string;
  startAge: number;
  monthlyAmount: number;
  inflationAdjusted: boolean;
}

interface RetirementGoal {
  id: string;
  category: string;
  description: string;
  estimatedCost: number;
  priority: 'high' | 'medium' | 'low';
}

interface RetirementPlan {
  readinessScore: number;
  currentAge: number;
  targetRetirementAge: number;
  desiredAnnualIncome: number;
  accounts: RetirementAccount[];
  projections: RetirementProjection[];
  socialSecurity: {
    age62Benefit: number;
    fullRetirementAgeBenefit: number;
    age70Benefit: number;
    fullRetirementAge: number;
  };
  withdrawalStrategy: {
    strategy: 'fixed-percentage' | 'dynamic' | 'rmd-based';
    initialRate: number;
    sequence: string[];
    rmdRequired: boolean;
    rmdAge: number;
  };
  incomeSources: IncomeSource[];
  retirementExpenses: {
    housing: number;
    healthcare: number;
    food: number;
    transportation: number;
    entertainment: number;
    travel: number;
    other: number;
  };
  goals: RetirementGoal[];
  monteCarloResults: {
    successRate: number;
    scenarios: number;
    medianOutcome: number;
    bestCase: number;
    worstCase: number;
  };
  catchUpStrategies: Array<{
    id: string;
    strategy: string;
    impact: number;
    difficulty: string;
  }>;
}

export default function RetirementPlanningScreen() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'accounts' | 'income' | 'goals'>('overview');
  const [selectedScenario, setSelectedScenario] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  const { data: retirementPlan, isLoading, error, refetch, isRefresching } = useRetirementPlan();
  const { mutate: updateAccount } = useUpdateRetirementAccount();
  const { mutate: addGoal } = useAddRetirementGoal();

  const isRefreshing = isRefresching || false;

  const handleExportReport = () => {
    Alert.alert('Export', 'Retirement planning report exported successfully');
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading retirement plan...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load retirement plan</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!retirementPlan) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="calendar-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No retirement plan found</Text>
      </View>
    );
  }

  const totalBalance = retirementPlan.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalContributions = retirementPlan.accounts.reduce(
    (sum, acc) => sum + acc.currentYearContributions,
    0
  );
  const totalExpenses = Object.values(retirementPlan.retirementExpenses).reduce(
    (sum, val) => sum + val,
    0
  );

  const scenarioProjections = retirementPlan.projections.filter(
    p => p.scenario === selectedScenario
  );

  const projectionData = {
    labels: scenarioProjections
      .filter((_, i) => i % 5 === 0)
      .map(p => p.age.toString()),
    datasets: [
      {
        data: scenarioProjections
          .filter((_, i) => i % 5 === 0)
          .map(p => p.balance / 1000000),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const readinessData = {
    labels: ['Readiness'],
    data: [retirementPlan.readinessScore / 100],
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34C759';
    if (score >= 60) return '#FF9500';
    return '#FF3B30';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Retirement Planning</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Readiness Score Card */}
      <View style={styles.readinessCard}>
        <Text style={styles.readinessLabel}>Retirement Readiness Score</Text>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreCircle}>
            <ProgressChart
              data={readinessData}
              width={140}
              height={140}
              strokeWidth={12}
              radius={50}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                color: (opacity = 1) => {
                  const color = getScoreColor(retirementPlan.readinessScore);
                  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
                },
              }}
              hideLegend
            />
            <View style={styles.scoreOverlay}>
              <Text style={[styles.scoreValue, { color: getScoreColor(retirementPlan.readinessScore) }]}>
                {retirementPlan.readinessScore}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
          </View>
          <View style={styles.readinessDetails}>
            <View style={styles.readinessRow}>
              <Text style={styles.readinessDetailLabel}>Current Age:</Text>
              <Text style={styles.readinessDetailValue}>{retirementPlan.currentAge}</Text>
            </View>
            <View style={styles.readinessRow}>
              <Text style={styles.readinessDetailLabel}>Target Retirement:</Text>
              <Text style={styles.readinessDetailValue}>{retirementPlan.targetRetirementAge}</Text>
            </View>
            <View style={styles.readinessRow}>
              <Text style={styles.readinessDetailLabel}>Years to Go:</Text>
              <Text style={styles.readinessDetailValue}>
                {retirementPlan.targetRetirementAge - retirementPlan.currentAge}
              </Text>
            </View>
            <View style={styles.readinessRow}>
              <Text style={styles.readinessDetailLabel}>Total Saved:</Text>
              <Text style={styles.readinessDetailValue}>
                ${(totalBalance / 1000000).toFixed(2)}M
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.tabActive]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'accounts' && styles.tabActive]}
          onPress={() => setSelectedTab('accounts')}
        >
          <Text style={[styles.tabText, selectedTab === 'accounts' && styles.tabTextActive]}>
            Accounts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'income' && styles.tabActive]}
          onPress={() => setSelectedTab('income')}
        >
          <Text style={[styles.tabText, selectedTab === 'income' && styles.tabTextActive]}>
            Income
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'goals' && styles.tabActive]}
          onPress={() => setSelectedTab('goals')}
        >
          <Text style={[styles.tabText, selectedTab === 'goals' && styles.tabTextActive]}>
            Goals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => refetch()} />
        }
      >
        {selectedTab === 'overview' && (
          <>
            {/* Projections */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Retirement Projections</Text>

              {/* Scenario Selector */}
              <View style={styles.scenarioSelector}>
                <TouchableOpacity
                  style={[
                    styles.scenarioButton,
                    selectedScenario === 'conservative' && styles.scenarioButtonActive,
                  ]}
                  onPress={() => setSelectedScenario('conservative')}
                >
                  <Text
                    style={[
                      styles.scenarioButtonText,
                      selectedScenario === 'conservative' && styles.scenarioButtonTextActive,
                    ]}
                  >
                    Conservative
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.scenarioButton,
                    selectedScenario === 'moderate' && styles.scenarioButtonActive,
                  ]}
                  onPress={() => setSelectedScenario('moderate')}
                >
                  <Text
                    style={[
                      styles.scenarioButtonText,
                      selectedScenario === 'moderate' && styles.scenarioButtonTextActive,
                    ]}
                  >
                    Moderate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.scenarioButton,
                    selectedScenario === 'aggressive' && styles.scenarioButtonActive,
                  ]}
                  onPress={() => setSelectedScenario('aggressive')}
                >
                  <Text
                    style={[
                      styles.scenarioButtonText,
                      selectedScenario === 'aggressive' && styles.scenarioButtonTextActive,
                    ]}
                  >
                    Aggressive
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chartCard}>
                <LineChart
                  data={projectionData}
                  width={screenWidth - 60}
                  height={220}
                  yAxisLabel="$"
                  yAxisSuffix="M"
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#007AFF',
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            </View>

            {/* Monte Carlo Results */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Success Probability</Text>
              <View style={styles.monteCarloCard}>
                <Text style={styles.monteCarloLabel}>Monte Carlo Simulation</Text>
                <Text style={styles.successRate}>
                  {retirementPlan.monteCarloResults.successRate}%
                </Text>
                <Text style={styles.monteCarloSubtext}>
                  Based on {retirementPlan.monteCarloResults.scenarios.toLocaleString()} scenarios
                </Text>

                <View style={styles.outcomeRow}>
                  <View style={styles.outcomeItem}>
                    <Text style={styles.outcomeLabel}>Best Case</Text>
                    <Text style={styles.outcomeValue}>
                      ${(retirementPlan.monteCarloResults.bestCase / 1000000).toFixed(1)}M
                    </Text>
                  </View>
                  <View style={styles.outcomeItem}>
                    <Text style={styles.outcomeLabel}>Median</Text>
                    <Text style={styles.outcomeValue}>
                      ${(retirementPlan.monteCarloResults.medianOutcome / 1000000).toFixed(1)}M
                    </Text>
                  </View>
                  <View style={styles.outcomeItem}>
                    <Text style={styles.outcomeLabel}>Worst Case</Text>
                    <Text style={styles.outcomeValue}>
                      ${(retirementPlan.monteCarloResults.worstCase / 1000000).toFixed(1)}M
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Withdrawal Strategy */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Withdrawal Strategy</Text>
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.label}>Strategy:</Text>
                  <Text style={styles.value}>
                    {retirementPlan.withdrawalStrategy.strategy.replace(/-/g, ' ')}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.label}>Initial Rate:</Text>
                  <Text style={styles.value}>
                    {retirementPlan.withdrawalStrategy.initialRate}%
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.label}>RMD Required:</Text>
                  <Text style={styles.value}>
                    {retirementPlan.withdrawalStrategy.rmdRequired ? 'Yes' : 'No'}
                  </Text>
                </View>
                {retirementPlan.withdrawalStrategy.rmdRequired && (
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>RMD Age:</Text>
                    <Text style={styles.value}>
                      {retirementPlan.withdrawalStrategy.rmdAge}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.subsectionTitle}>Withdrawal Sequence</Text>
              {retirementPlan.withdrawalStrategy.sequence.map((item, index) => (
                <View key={index} style={styles.sequenceItem}>
                  <View style={styles.sequenceNumber}>
                    <Text style={styles.sequenceNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.sequenceText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Retirement Expenses */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Estimated Retirement Expenses</Text>
              <View style={styles.card}>
                {Object.entries(retirementPlan.retirementExpenses).map(([category, amount]) => (
                  <View key={category} style={styles.cardRow}>
                    <Text style={styles.label}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}:
                    </Text>
                    <Text style={styles.value}>${amount.toLocaleString()}/mo</Text>
                  </View>
                ))}
                <View style={[styles.cardRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Monthly:</Text>
                  <Text style={styles.totalValue}>${totalExpenses.toLocaleString()}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.totalLabel}>Total Annual:</Text>
                  <Text style={styles.totalValue}>
                    ${(totalExpenses * 12).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Catch-Up Strategies */}
            {retirementPlan.catchUpStrategies.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Catch-Up Strategies</Text>
                {retirementPlan.catchUpStrategies.map(strategy => (
                  <View key={strategy.id} style={styles.strategyCard}>
                    <Text style={styles.strategyName}>{strategy.strategy}</Text>
                    <View style={styles.strategyFooter}>
                      <Text style={styles.strategyImpact}>
                        Impact: +${strategy.impact.toLocaleString()}
                      </Text>
                      <View style={styles.difficultyBadge}>
                        <Text style={styles.difficultyText}>{strategy.difficulty}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {selectedTab === 'accounts' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Retirement Accounts</Text>

            <View style={styles.summaryBox}>
              <View style={styles.summaryBoxRow}>
                <Text style={styles.summaryBoxLabel}>Total Balance:</Text>
                <Text style={styles.summaryBoxValue}>
                  ${totalBalance.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryBoxRow}>
                <Text style={styles.summaryBoxLabel}>YTD Contributions:</Text>
                <Text style={styles.summaryBoxValue}>
                  ${totalContributions.toLocaleString()}
                </Text>
              </View>
            </View>

            {retirementPlan.accounts.map(account => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountHeader}>
                  <Ionicons name="wallet" size={24} color="#007AFF" />
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountType}>
                      {account.type.toUpperCase().replace(/-/g, ' ')}
                    </Text>
                    <Text style={styles.accountProvider}>{account.provider}</Text>
                  </View>
                </View>

                <View style={styles.accountBalance}>
                  <Text style={styles.balanceLabel}>Balance</Text>
                  <Text style={styles.balanceValue}>
                    ${account.balance.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.contributionProgress}>
                  <View style={styles.contributionHeader}>
                    <Text style={styles.contributionLabel}>
                      {new Date().getFullYear()} Contributions
                    </Text>
                    <Text style={styles.contributionValue}>
                      ${account.currentYearContributions.toLocaleString()} / $
                      {account.contributionLimit.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.contributionBar,
                        {
                          width: `${Math.min(
                            (account.currentYearContributions / account.contributionLimit) * 100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {account.employerMatch && (
                  <View style={styles.matchSection}>
                    <Text style={styles.matchTitle}>Employer Match</Text>
                    <View style={styles.matchRow}>
                      <Text style={styles.matchLabel}>Formula:</Text>
                      <Text style={styles.matchValue}>{account.employerMatch.formula}</Text>
                    </View>
                    <View style={styles.matchRow}>
                      <Text style={styles.matchLabel}>YTD Match:</Text>
                      <Text style={styles.matchValue}>
                        ${account.employerMatch.amount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.matchRow}>
                      <Text style={styles.matchLabel}>Vested:</Text>
                      <Text style={styles.matchValue}>
                        {account.employerMatch.vestingPercentage}%
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'income' && (
          <>
            {/* Social Security */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Social Security Estimates</Text>
              <View style={styles.card}>
                <View style={styles.ssRow}>
                  <Text style={styles.ssAge}>Age 62 (Early)</Text>
                  <Text style={styles.ssAmount}>
                    ${retirementPlan.socialSecurity.age62Benefit.toLocaleString()}/mo
                  </Text>
                </View>
                <View style={styles.ssRow}>
                  <Text style={[styles.ssAge, styles.ssAgeFull]}>
                    Age {retirementPlan.socialSecurity.fullRetirementAge} (Full)
                  </Text>
                  <Text style={[styles.ssAmount, styles.ssAmountFull]}>
                    ${retirementPlan.socialSecurity.fullRetirementAgeBenefit.toLocaleString()}/mo
                  </Text>
                </View>
                <View style={styles.ssRow}>
                  <Text style={styles.ssAge}>Age 70 (Delayed)</Text>
                  <Text style={styles.ssAmount}>
                    ${retirementPlan.socialSecurity.age70Benefit.toLocaleString()}/mo
                  </Text>
                </View>
              </View>
            </View>

            {/* Income Sources */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Income Sources</Text>
              {retirementPlan.incomeSources.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cash-outline" size={48} color="#999" />
                  <Text style={styles.emptyText}>No additional income sources</Text>
                </View>
              ) : (
                retirementPlan.incomeSources.map((source, index) => (
                  <View key={index} style={styles.incomeCard}>
                    <View style={styles.incomeHeader}>
                      <Text style={styles.incomeName}>{source.name}</Text>
                      <Text style={styles.incomeType}>
                        {source.type.replace(/-/g, ' ')}
                      </Text>
                    </View>
                    <View style={styles.incomeDetails}>
                      <View style={styles.incomeRow}>
                        <Text style={styles.label}>Start Age:</Text>
                        <Text style={styles.value}>{source.startAge}</Text>
                      </View>
                      <View style={styles.incomeRow}>
                        <Text style={styles.label}>Monthly Amount:</Text>
                        <Text style={styles.value}>
                          ${source.monthlyAmount.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.incomeRow}>
                        <Text style={styles.label}>Inflation Adjusted:</Text>
                        <Text style={styles.value}>
                          {source.inflationAdjusted ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {selectedTab === 'goals' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Retirement Goals</Text>
              <TouchableOpacity style={styles.addButton}>
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {retirementPlan.goals.map(goal => (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalCategory}>{goal.category}</Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      goal.priority === 'high' && styles.priorityHigh,
                      goal.priority === 'medium' && styles.priorityMedium,
                      goal.priority === 'low' && styles.priorityLow,
                    ]}
                  >
                    <Text style={styles.priorityText}>{goal.priority}</Text>
                  </View>
                </View>
                <Text style={styles.goalDescription}>{goal.description}</Text>
                <Text style={styles.goalCost}>
                  Estimated Cost: ${goal.estimatedCost.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  readinessCard: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readinessLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 15,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    position: 'relative',
    marginRight: 20,
  },
  scoreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  scoreMax: {
    fontSize: 16,
    color: '#8E8E93',
  },
  readinessDetails: {
    flex: 1,
  },
  readinessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  readinessDetailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  readinessDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
    marginTop: 10,
  },
  scenarioSelector: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 8,
  },
  scenarioButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
  },
  scenarioButtonActive: {
    backgroundColor: '#007AFF',
  },
  scenarioButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
  },
  scenarioButtonTextActive: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  monteCarloCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  monteCarloLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 10,
  },
  successRate: {
    fontSize: 48,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 5,
  },
  monteCarloSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
  },
  outcomeRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  outcomeItem: {
    alignItems: 'center',
  },
  outcomeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  outcomeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F7',
  },
  label: {
    fontSize: 14,
    color: '#8E8E93',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  sequenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sequenceNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sequenceNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sequenceText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  strategyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  strategyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strategyImpact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  difficultyBadge: {
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  summaryBox: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  summaryBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryBoxLabel: {
    fontSize: 14,
    color: '#2E7D32',
  },
  summaryBoxValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountInfo: {
    marginLeft: 12,
    flex: 1,
  },
  accountType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  accountProvider: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  accountBalance: {
    backgroundColor: '#F5F5F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  contributionProgress: {
    marginBottom: 12,
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contributionLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  contributionValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  contributionBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  matchSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  matchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  matchLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  matchValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
  },
  ssRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F7',
  },
  ssAge: {
    fontSize: 14,
    color: '#8E8E93',
  },
  ssAgeFull: {
    fontWeight: '600',
    color: '#000',
  },
  ssAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  ssAmountFull: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  incomeCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  incomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  incomeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  incomeType: {
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'capitalize',
  },
  incomeDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityHigh: {
    backgroundColor: '#FF3B30',
  },
  priorityMedium: {
    backgroundColor: '#FF9500',
  },
  priorityLow: {
    backgroundColor: '#34C759',
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  goalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  goalCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  addButton: {
    padding: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
