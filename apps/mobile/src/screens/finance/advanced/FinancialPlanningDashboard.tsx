import React from 'react';
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
import { ProgressChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useFinancialHealthScore,
  usePlanningProgress,
  usePlanningMilestones,
  useActionItems,
  useCompleteActionItem,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface FinancialHealthScore {
  overall: number;
  emergency: number;
  retirement: number;
  insurance: number;
  estate: number;
  tax: number;
}

interface NetWorth {
  assets: number;
  liabilities: number;
  netWorth: number;
  trend: Array<{
    date: string;
    value: number;
  }>;
}

interface PlanningProgress {
  emergencyFund: {
    current: number;
    goal: number;
    percentage: number;
    status: 'on-track' | 'behind' | 'ahead';
  };
  retirement: {
    saved: number;
    target: number;
    percentage: number;
    status: 'on-track' | 'behind' | 'ahead';
  };
  insurance: {
    coverage: string;
    gaps: number;
    status: 'adequate' | 'gaps' | 'needs-review';
  };
  estate: {
    completeness: number;
    status: 'complete' | 'in-progress' | 'not-started';
  };
  tax: {
    opportunities: number;
    status: 'optimized' | 'opportunities' | 'needs-review';
  };
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
}

interface Advisor {
  id: string;
  name: string;
  type: string;
  contact: string;
  lastContact?: string;
}

interface FinancialPlan {
  healthScore: FinancialHealthScore;
  netWorth: NetWorth;
  progress: PlanningProgress;
  upcomingMilestones: Milestone[];
  actionItems: ActionItem[];
  advisors: Advisor[];
}

export default function FinancialPlanningDashboard() {
  const navigation = useNavigation();

  const { data: healthScore, isLoading: isHealthLoading, error: healthError, refetch: refetchHealth, isRefresching: isHealthRefresching } = useFinancialHealthScore();
  const { data: progress, isLoading: isProgressLoading } = usePlanningProgress();
  const { data: milestones, isLoading: isMilestonesLoading } = usePlanningMilestones();
  const { data: actionItems, isLoading: isActionsLoading } = useActionItems();

  // Construct plan from individual hooks - using placeholder data where needed
  const plan: FinancialPlan | undefined = healthScore && progress ? {
    healthScore: healthScore,
    netWorth: {
      assets: 0,
      liabilities: 0,
      netWorth: 0,
      trend: [],
    },
    progress: progress,
    upcomingMilestones: milestones || [],
    actionItems: actionItems || [],
    advisors: [],
  } : undefined;

  const isLoading = isHealthLoading || isProgressLoading || isMilestonesLoading || isActionsLoading;
  const error = healthError;
  const refetch = refetchHealth;
  const isRefreshing = isHealthRefresching || false;

  const handleExportReport = () => {
    Alert.alert('Export', 'Financial planning report exported successfully');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34C759';
    if (score >= 60) return '#FF9500';
    return '#FF3B30';
  };

  const getStatusColor = (status: string) => {
    if (status === 'on-track' || status === 'adequate' || status === 'complete' || status === 'optimized' || status === 'ahead')
      return '#34C759';
    if (status === 'gaps' || status === 'in-progress' || status === 'opportunities')
      return '#FF9500';
    return '#FF3B30';
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading financial plan...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load financial plan</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="analytics-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No financial plan found</Text>
      </View>
    );
  }

  const scoreData = {
    labels: ['Overall'],
    data: [plan.healthScore.overall / 100],
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Planning</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => refetch()} />
        }
      >
        {/* Financial Health Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Health Score</Text>
          <View style={styles.healthScoreCard}>
            <View style={styles.scoreCircleContainer}>
              <ProgressChart
                data={scoreData}
                width={160}
                height={160}
                strokeWidth={16}
                radius={60}
                chartConfig={{
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  color: (opacity = 1) => {
                    const color = getScoreColor(plan.healthScore.overall);
                    return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
                  },
                }}
                hideLegend
              />
              <View style={styles.scoreOverlay}>
                <Text
                  style={[
                    styles.scoreValue,
                    { color: getScoreColor(plan.healthScore.overall) },
                  ]}
                >
                  {plan.healthScore.overall}
                </Text>
                <Text style={styles.scoreLabel}>Overall Score</Text>
              </View>
            </View>

            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreItem}>
                <View style={styles.scoreItemHeader}>
                  <Text style={styles.scoreItemLabel}>Emergency Fund</Text>
                  <Text
                    style={[
                      styles.scoreItemValue,
                      { color: getScoreColor(plan.healthScore.emergency) },
                    ]}
                  >
                    {plan.healthScore.emergency}
                  </Text>
                </View>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${plan.healthScore.emergency}%`,
                        backgroundColor: getScoreColor(plan.healthScore.emergency),
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.scoreItem}>
                <View style={styles.scoreItemHeader}>
                  <Text style={styles.scoreItemLabel}>Retirement</Text>
                  <Text
                    style={[
                      styles.scoreItemValue,
                      { color: getScoreColor(plan.healthScore.retirement) },
                    ]}
                  >
                    {plan.healthScore.retirement}
                  </Text>
                </View>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${plan.healthScore.retirement}%`,
                        backgroundColor: getScoreColor(plan.healthScore.retirement),
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.scoreItem}>
                <View style={styles.scoreItemHeader}>
                  <Text style={styles.scoreItemLabel}>Insurance</Text>
                  <Text
                    style={[
                      styles.scoreItemValue,
                      { color: getScoreColor(plan.healthScore.insurance) },
                    ]}
                  >
                    {plan.healthScore.insurance}
                  </Text>
                </View>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${plan.healthScore.insurance}%`,
                        backgroundColor: getScoreColor(plan.healthScore.insurance),
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.scoreItem}>
                <View style={styles.scoreItemHeader}>
                  <Text style={styles.scoreItemLabel}>Estate Planning</Text>
                  <Text
                    style={[
                      styles.scoreItemValue,
                      { color: getScoreColor(plan.healthScore.estate) },
                    ]}
                  >
                    {plan.healthScore.estate}
                  </Text>
                </View>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${plan.healthScore.estate}%`,
                        backgroundColor: getScoreColor(plan.healthScore.estate),
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.scoreItem}>
                <View style={styles.scoreItemHeader}>
                  <Text style={styles.scoreItemLabel}>Tax Optimization</Text>
                  <Text
                    style={[
                      styles.scoreItemValue,
                      { color: getScoreColor(plan.healthScore.tax) },
                    ]}
                  >
                    {plan.healthScore.tax}
                  </Text>
                </View>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${plan.healthScore.tax}%`,
                        backgroundColor: getScoreColor(plan.healthScore.tax),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Net Worth Snapshot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Net Worth Snapshot</Text>
          <View style={styles.netWorthCard}>
            <View style={styles.netWorthMain}>
              <Text style={styles.netWorthLabel}>Net Worth</Text>
              <Text style={styles.netWorthValue}>
                ${plan.netWorth.netWorth.toLocaleString()}
              </Text>
            </View>

            <View style={styles.netWorthBreakdown}>
              <View style={styles.netWorthItem}>
                <Ionicons name="trending-up" size={20} color="#34C759" />
                <View style={styles.netWorthItemInfo}>
                  <Text style={styles.netWorthItemLabel}>Assets</Text>
                  <Text style={styles.netWorthItemValue}>
                    ${plan.netWorth.assets.toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.netWorthItem}>
                <Ionicons name="trending-down" size={20} color="#FF3B30" />
                <View style={styles.netWorthItemInfo}>
                  <Text style={styles.netWorthItemLabel}>Liabilities</Text>
                  <Text style={styles.netWorthItemValue}>
                    ${plan.netWorth.liabilities.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Planning Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planning Progress</Text>

          <TouchableOpacity
            style={styles.progressCard}
            onPress={() => navigation.navigate('RiskManagement' as never)}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Ionicons name="umbrella" size={24} color="#007AFF" />
                <View style={styles.progressText}>
                  <Text style={styles.progressTitle}>Emergency Fund</Text>
                  <Text style={styles.progressSubtitle}>
                    ${plan.progress.emergencyFund.current.toLocaleString()} / $
                    {plan.progress.emergencyFund.goal.toLocaleString()}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(plan.progress.emergencyFund.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {plan.progress.emergencyFund.status.replace('-', ' ')}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(plan.progress.emergencyFund.percentage, 100)}%`,
                    backgroundColor: getStatusColor(plan.progress.emergencyFund.status),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressPercent}>
              {plan.progress.emergencyFund.percentage}% of goal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.progressCard}
            onPress={() => navigation.navigate('RetirementPlanning' as never)}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Ionicons name="calendar" size={24} color="#34C759" />
                <View style={styles.progressText}>
                  <Text style={styles.progressTitle}>Retirement Savings</Text>
                  <Text style={styles.progressSubtitle}>
                    ${(plan.progress.retirement.saved / 1000000).toFixed(2)}M / $
                    {(plan.progress.retirement.target / 1000000).toFixed(2)}M
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(plan.progress.retirement.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {plan.progress.retirement.status.replace('-', ' ')}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(plan.progress.retirement.percentage, 100)}%`,
                    backgroundColor: getStatusColor(plan.progress.retirement.status),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressPercent}>
              {plan.progress.retirement.percentage}% of target
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.progressCard}
            onPress={() => navigation.navigate('RiskManagement' as never)}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Ionicons name="shield-checkmark" size={24} color="#5856D6" />
                <View style={styles.progressText}>
                  <Text style={styles.progressTitle}>Insurance Coverage</Text>
                  <Text style={styles.progressSubtitle}>
                    {plan.progress.insurance.coverage}
                    {plan.progress.insurance.gaps > 0 &&
                      ` - ${plan.progress.insurance.gaps} gap${
                        plan.progress.insurance.gaps > 1 ? 's' : ''
                      }`}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(plan.progress.insurance.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {plan.progress.insurance.status.replace('-', ' ')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.progressCard}
            onPress={() => navigation.navigate('LegacyPlanning' as never)}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Ionicons name="document-text" size={24} color="#AF52DE" />
                <View style={styles.progressText}>
                  <Text style={styles.progressTitle}>Estate Planning</Text>
                  <Text style={styles.progressSubtitle}>
                    {plan.progress.estate.completeness}% complete
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(plan.progress.estate.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {plan.progress.estate.status.replace('-', ' ')}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${plan.progress.estate.completeness}%`,
                    backgroundColor: getStatusColor(plan.progress.estate.status),
                  },
                ]}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.progressCard}
            onPress={() => navigation.navigate('TaxPlanning' as never)}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Ionicons name="calculator" size={24} color="#FF9500" />
                <View style={styles.progressText}>
                  <Text style={styles.progressTitle}>Tax Optimization</Text>
                  <Text style={styles.progressSubtitle}>
                    {plan.progress.tax.opportunities} optimization
                    {plan.progress.tax.opportunities !== 1 ? 's' : ''} available
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(plan.progress.tax.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {plan.progress.tax.status.replace('-', ' ')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Upcoming Milestones */}
        {plan.upcomingMilestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Milestones</Text>
            {plan.upcomingMilestones.map(milestone => (
              <View key={milestone.id} style={styles.milestoneCard}>
                <View style={styles.milestoneHeader}>
                  <View
                    style={[
                      styles.priorityDot,
                      milestone.priority === 'high' && styles.priorityHigh,
                      milestone.priority === 'medium' && styles.priorityMedium,
                      milestone.priority === 'low' && styles.priorityLow,
                    ]}
                  />
                  <View style={styles.milestoneInfo}>
                    <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                    <Text style={styles.milestoneCategory}>{milestone.category}</Text>
                  </View>
                </View>
                <Text style={styles.milestoneDate}>
                  {new Date(milestone.date).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Items */}
        {plan.actionItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Action Items</Text>
            {plan.actionItems.map(item => (
              <View key={item.id} style={styles.actionCard}>
                <View style={styles.actionHeader}>
                  <View
                    style={[
                      styles.priorityBadge,
                      item.priority === 'high' && styles.priorityBadgeHigh,
                      item.priority === 'medium' && styles.priorityBadgeMedium,
                      item.priority === 'low' && styles.priorityBadgeLow,
                    ]}
                  >
                    <Text style={styles.priorityText}>{item.priority}</Text>
                  </View>
                  <Text style={styles.actionCategory}>{item.category}</Text>
                </View>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionDescription}>{item.description}</Text>
                {item.dueDate && (
                  <Text style={styles.actionDueDate}>
                    Due: {new Date(item.dueDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Professional Team */}
        {plan.advisors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Team</Text>
            {plan.advisors.map(advisor => (
              <View key={advisor.id} style={styles.advisorCard}>
                <View style={styles.advisorHeader}>
                  <Ionicons name="person-circle" size={40} color="#007AFF" />
                  <View style={styles.advisorInfo}>
                    <Text style={styles.advisorName}>{advisor.name}</Text>
                    <Text style={styles.advisorType}>{advisor.type}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.contactButton}>
                  <Ionicons name="call" size={16} color="#007AFF" />
                  <Text style={styles.contactText}>{advisor.contact}</Text>
                </TouchableOpacity>
                {advisor.lastContact && (
                  <Text style={styles.lastContact}>
                    Last contact: {new Date(advisor.lastContact).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planning Modules</Text>
          <View style={styles.modulesGrid}>
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('LegacyPlanning' as never)}
            >
              <Ionicons name="document-text" size={32} color="#AF52DE" />
              <Text style={styles.moduleName}>Legacy Planning</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('RiskManagement' as never)}
            >
              <Ionicons name="shield-checkmark" size={32} color="#5856D6" />
              <Text style={styles.moduleName}>Risk Management</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('TaxPlanning' as never)}
            >
              <Ionicons name="calculator" size={32} color="#FF9500" />
              <Text style={styles.moduleName}>Tax Planning</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('RetirementPlanning' as never)}
            >
              <Ionicons name="calendar" size={32} color="#34C759" />
              <Text style={styles.moduleName}>Retirement</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('BenefitsPlanning' as never)}
            >
              <Ionicons name="gift" size={32} color="#FF3B30" />
              <Text style={styles.moduleName}>Benefits</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => navigation.navigate('InvestmentManagement' as never)}
            >
              <Ionicons name="trending-up" size={32} color="#007AFF" />
              <Text style={styles.moduleName}>Investments</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
  },
  healthScoreCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreCircleContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
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
    fontSize: 48,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  scoreBreakdown: {
    gap: 15,
  },
  scoreItem: {
    gap: 6,
  },
  scoreItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreItemLabel: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  scoreItemValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreBar: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  netWorthCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  netWorthMain: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  netWorthLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  netWorthValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#007AFF',
  },
  netWorthBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
  },
  netWorthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  netWorthItemInfo: {
    gap: 4,
  },
  netWorthItemLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  netWorthItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressText: {
    marginLeft: 12,
    flex: 1,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  progressSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 12,
    color: '#8E8E93',
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
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
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  milestoneCategory: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  milestoneDate: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityBadgeHigh: {
    backgroundColor: '#FF3B30',
  },
  priorityBadgeMedium: {
    backgroundColor: '#FF9500',
  },
  priorityBadgeLow: {
    backgroundColor: '#34C759',
  },
  priorityText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionCategory: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  actionDueDate: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '500',
  },
  advisorCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  advisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  advisorInfo: {
    marginLeft: 12,
    flex: 1,
  },
  advisorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  advisorType: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  contactText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  lastContact: {
    fontSize: 12,
    color: '#8E8E93',
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  moduleName: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
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
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 10,
  },
});
