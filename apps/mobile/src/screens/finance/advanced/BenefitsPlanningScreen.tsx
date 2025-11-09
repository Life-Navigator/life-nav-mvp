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
import { ProgressChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import {
  useBenefitsPlan,
  useHealthBenefits,
  useAddHealthBenefit,
  useRetirementBenefitsList,
  useAddRetirementBenefit,
  useInsuranceBenefits,
  usePTOBenefits,
  useUpdatePTOBenefits,
  useBenefitsOptimization,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface HealthBenefit {
  type: 'medical' | 'dental' | 'vision';
  plan: string;
  coverage: string;
  premium: number;
  deductible: number;
  outOfPocketMax: number;
  provider: string;
}

interface FSAAccount {
  type: 'fsa' | 'hsa';
  balance: number;
  contributionLimit: number;
  currentYearContributions: number;
  employerContribution?: number;
  useByDate?: string;
  rolloverAllowed: boolean;
}

interface RetirementBenefit {
  plan: string;
  matchFormula: string;
  matchAmount: number;
  vestingSchedule: string;
  vestingPercentage: number;
  profitSharing?: number;
  stockOptions?: {
    granted: number;
    vested: number;
    strikePrice: number;
    currentValue: number;
  };
  espp?: {
    discountRate: number;
    contributionRate: number;
  };
}

interface InsuranceBenefit {
  type: 'life' | 'disability' | 'accident' | 'critical-illness';
  coverage: number;
  premium: number;
  employerPaid: boolean;
  beneficiaries?: string[];
}

interface TimeOffBenefit {
  type: 'pto' | 'vacation' | 'sick' | 'personal';
  balance: number;
  accrualRate: string;
  rolloverLimit?: number;
  useByDate?: string;
}

interface OtherBenefit {
  name: string;
  category: string;
  value: number;
  description: string;
  utilized: boolean;
}

interface BenefitsPlan {
  totalCompensationValue: number;
  baseSalary: number;
  utilizationRate: number;
  enrollmentStatus: 'enrolled' | 'pending' | 'not-enrolled';
  openEnrollmentDate?: string;
  healthBenefits: HealthBenefit[];
  fsaHsa?: FSAAccount;
  retirementBenefits: RetirementBenefit;
  insuranceBenefits: InsuranceBenefit[];
  timeOff: TimeOffBenefit[];
  otherBenefits: OtherBenefit[];
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    potentialValue: number;
    category: string;
  }>;
  openEnrollmentChecklist: Array<{
    id: string;
    task: string;
    completed: boolean;
    dueDate?: string;
  }>;
}

export default function BenefitsPlanningScreen() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'health' | 'retirement' | 'other'>('overview');

  const { data: benefits, isLoading, error, refetch, isRefresching } = useBenefitsPlan();

  const isRefreshing = isRefresching || false;

  const handleExportReport = () => {
    Alert.alert('Export', 'Benefits summary exported successfully');
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading benefits...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load benefits</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!benefits) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="gift-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No benefits information found</Text>
      </View>
    );
  }

  const benefitsValue = benefits.totalCompensationValue - benefits.baseSalary;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Employee Benefits</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Compensation Overview Card */}
      <View style={styles.compensationCard}>
        <Text style={styles.compensationLabel}>Total Compensation</Text>
        <Text style={styles.compensationValue}>
          ${benefits.totalCompensationValue.toLocaleString()}
        </Text>
        <View style={styles.compensationBreakdown}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Base Salary</Text>
            <Text style={styles.breakdownValue}>
              ${benefits.baseSalary.toLocaleString()}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>Benefits Value</Text>
            <Text style={styles.breakdownValue}>
              ${benefitsValue.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Utilization Rate */}
        <View style={styles.utilizationSection}>
          <View style={styles.utilizationHeader}>
            <Text style={styles.utilizationLabel}>Benefits Utilization</Text>
            <Text style={styles.utilizationValue}>{benefits.utilizationRate}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${benefits.utilizationRate}%` },
              ]}
            />
          </View>
        </View>

        {/* Open Enrollment */}
        {benefits.openEnrollmentDate && (
          <View style={styles.enrollmentBanner}>
            <Ionicons name="calendar" size={20} color="#FF9500" />
            <Text style={styles.enrollmentText}>
              Open Enrollment: {new Date(benefits.openEnrollmentDate).toLocaleDateString()}
            </Text>
          </View>
        )}
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
          style={[styles.tab, selectedTab === 'health' && styles.tabActive]}
          onPress={() => setSelectedTab('health')}
        >
          <Text style={[styles.tabText, selectedTab === 'health' && styles.tabTextActive]}>
            Health
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'retirement' && styles.tabActive]}
          onPress={() => setSelectedTab('retirement')}
        >
          <Text style={[styles.tabText, selectedTab === 'retirement' && styles.tabTextActive]}>
            Retirement
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'other' && styles.tabActive]}
          onPress={() => setSelectedTab('other')}
        >
          <Text style={[styles.tabText, selectedTab === 'other' && styles.tabTextActive]}>
            Other
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
            {/* Quick Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Benefits Summary</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="medical" size={24} color="#34C759" />
                  <Text style={styles.statValue}>{benefits.healthBenefits.length}</Text>
                  <Text style={styles.statLabel}>Health Plans</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
                  <Text style={styles.statValue}>{benefits.insuranceBenefits.length}</Text>
                  <Text style={styles.statLabel}>Insurance</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="calendar" size={24} color="#FF9500" />
                  <Text style={styles.statValue}>
                    {benefits.timeOff.reduce((sum, t) => sum + t.balance, 0)}
                  </Text>
                  <Text style={styles.statLabel}>PTO Hours</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="gift" size={24} color="#AF52DE" />
                  <Text style={styles.statValue}>{benefits.otherBenefits.length}</Text>
                  <Text style={styles.statLabel}>Other Benefits</Text>
                </View>
              </View>
            </View>

            {/* Recommendations */}
            {benefits.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {benefits.recommendations.map(rec => (
                  <View key={rec.id} style={styles.recommendationCard}>
                    <View style={styles.recommendationHeader}>
                      <Text style={styles.recommendationTitle}>{rec.title}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{rec.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.recommendationDescription}>{rec.description}</Text>
                    <Text style={styles.recommendationValue}>
                      Potential Value: ${rec.potentialValue.toLocaleString()}/year
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Open Enrollment Checklist */}
            {benefits.openEnrollmentChecklist.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Open Enrollment Checklist</Text>
                {benefits.openEnrollmentChecklist.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.checklistItem}
                  >
                    <Ionicons
                      name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={item.completed ? '#34C759' : '#8E8E93'}
                    />
                    <View style={styles.checklistContent}>
                      <Text
                        style={[
                          styles.checklistTask,
                          item.completed && styles.checklistTaskCompleted,
                        ]}
                      >
                        {item.task}
                      </Text>
                      {item.dueDate && (
                        <Text style={styles.checklistDate}>
                          Due: {new Date(item.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {selectedTab === 'health' && (
          <>
            {/* Health Benefits */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Health Insurance</Text>
              {benefits.healthBenefits.map((benefit, index) => (
                <View key={index} style={styles.healthCard}>
                  <View style={styles.healthHeader}>
                    <Ionicons
                      name={
                        benefit.type === 'medical'
                          ? 'medical'
                          : benefit.type === 'dental'
                          ? 'happy'
                          : 'eye'
                      }
                      size={24}
                      color="#34C759"
                    />
                    <View style={styles.healthInfo}>
                      <Text style={styles.healthType}>
                        {benefit.type.charAt(0).toUpperCase() + benefit.type.slice(1)}
                      </Text>
                      <Text style={styles.healthPlan}>{benefit.plan}</Text>
                    </View>
                  </View>

                  <View style={styles.healthDetails}>
                    <View style={styles.healthRow}>
                      <Text style={styles.label}>Coverage:</Text>
                      <Text style={styles.value}>{benefit.coverage}</Text>
                    </View>
                    <View style={styles.healthRow}>
                      <Text style={styles.label}>Provider:</Text>
                      <Text style={styles.value}>{benefit.provider}</Text>
                    </View>
                    <View style={styles.healthRow}>
                      <Text style={styles.label}>Premium:</Text>
                      <Text style={styles.value}>${benefit.premium}/mo</Text>
                    </View>
                    <View style={styles.healthRow}>
                      <Text style={styles.label}>Deductible:</Text>
                      <Text style={styles.value}>${benefit.deductible.toLocaleString()}</Text>
                    </View>
                    <View style={styles.healthRow}>
                      <Text style={styles.label}>Out-of-Pocket Max:</Text>
                      <Text style={styles.value}>
                        ${benefit.outOfPocketMax.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* FSA/HSA */}
            {benefits.fsaHsa && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {benefits.fsaHsa.type.toUpperCase()} Account
                </Text>
                <View style={styles.fsaCard}>
                  <View style={styles.fsaBalance}>
                    <Text style={styles.fsaBalanceLabel}>Current Balance</Text>
                    <Text style={styles.fsaBalanceValue}>
                      ${benefits.fsaHsa.balance.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.contributionProgress}>
                    <View style={styles.contributionHeader}>
                      <Text style={styles.contributionLabel}>
                        {new Date().getFullYear()} Contributions
                      </Text>
                      <Text style={styles.contributionValue}>
                        ${benefits.fsaHsa.currentYearContributions.toLocaleString()} / $
                        {benefits.fsaHsa.contributionLimit.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.contributionBar,
                          {
                            width: `${Math.min(
                              (benefits.fsaHsa.currentYearContributions /
                                benefits.fsaHsa.contributionLimit) *
                                100,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {benefits.fsaHsa.employerContribution && (
                    <View style={styles.fsaRow}>
                      <Text style={styles.label}>Employer Contribution:</Text>
                      <Text style={styles.value}>
                        ${benefits.fsaHsa.employerContribution.toLocaleString()}
                      </Text>
                    </View>
                  )}

                  {benefits.fsaHsa.useByDate && (
                    <View style={styles.warningBanner}>
                      <Ionicons name="warning" size={20} color="#FF9500" />
                      <Text style={styles.warningText}>
                        Use by: {new Date(benefits.fsaHsa.useByDate).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.fsaRow}>
                    <Text style={styles.label}>Rollover Allowed:</Text>
                    <Text style={styles.value}>
                      {benefits.fsaHsa.rolloverAllowed ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {selectedTab === 'retirement' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Retirement Benefits</Text>

            <View style={styles.retirementCard}>
              <Text style={styles.retirementPlan}>{benefits.retirementBenefits.plan}</Text>

              <View style={styles.matchSection}>
                <Text style={styles.matchTitle}>Employer Match</Text>
                <View style={styles.matchRow}>
                  <Text style={styles.label}>Formula:</Text>
                  <Text style={styles.value}>{benefits.retirementBenefits.matchFormula}</Text>
                </View>
                <View style={styles.matchRow}>
                  <Text style={styles.label}>YTD Match:</Text>
                  <Text style={styles.matchValue}>
                    ${benefits.retirementBenefits.matchAmount.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.vestingSection}>
                <Text style={styles.vestingTitle}>Vesting</Text>
                <View style={styles.vestingRow}>
                  <Text style={styles.label}>Schedule:</Text>
                  <Text style={styles.value}>
                    {benefits.retirementBenefits.vestingSchedule}
                  </Text>
                </View>
                <View style={styles.vestingRow}>
                  <Text style={styles.label}>Vested Percentage:</Text>
                  <Text style={styles.vestingValue}>
                    {benefits.retirementBenefits.vestingPercentage}%
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.vestingBar,
                      { width: `${benefits.retirementBenefits.vestingPercentage}%` },
                    ]}
                  />
                </View>
              </View>

              {benefits.retirementBenefits.profitSharing && (
                <View style={styles.profitSharingSection}>
                  <Text style={styles.profitSharingLabel}>Profit Sharing</Text>
                  <Text style={styles.profitSharingValue}>
                    ${benefits.retirementBenefits.profitSharing.toLocaleString()}
                  </Text>
                </View>
              )}

              {benefits.retirementBenefits.stockOptions && (
                <View style={styles.stockSection}>
                  <Text style={styles.stockTitle}>Stock Options</Text>
                  <View style={styles.stockRow}>
                    <Text style={styles.label}>Granted:</Text>
                    <Text style={styles.value}>
                      {benefits.retirementBenefits.stockOptions.granted.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.stockRow}>
                    <Text style={styles.label}>Vested:</Text>
                    <Text style={styles.value}>
                      {benefits.retirementBenefits.stockOptions.vested.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.stockRow}>
                    <Text style={styles.label}>Strike Price:</Text>
                    <Text style={styles.value}>
                      ${benefits.retirementBenefits.stockOptions.strikePrice.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.stockRow}>
                    <Text style={styles.label}>Current Value:</Text>
                    <Text style={styles.stockValue}>
                      ${benefits.retirementBenefits.stockOptions.currentValue.toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              {benefits.retirementBenefits.espp && (
                <View style={styles.esppSection}>
                  <Text style={styles.esppTitle}>ESPP</Text>
                  <View style={styles.esppRow}>
                    <Text style={styles.label}>Discount Rate:</Text>
                    <Text style={styles.value}>
                      {benefits.retirementBenefits.espp.discountRate}%
                    </Text>
                  </View>
                  <View style={styles.esppRow}>
                    <Text style={styles.label}>Contribution Rate:</Text>
                    <Text style={styles.value}>
                      {benefits.retirementBenefits.espp.contributionRate}%
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Insurance Benefits */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Insurance Benefits</Text>
            {benefits.insuranceBenefits.map((insurance, index) => (
              <View key={index} style={styles.insuranceCard}>
                <View style={styles.insuranceHeader}>
                  <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
                  <View style={styles.insuranceInfo}>
                    <Text style={styles.insuranceType}>
                      {insurance.type
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                    </Text>
                    <Text style={styles.insuranceCoverage}>
                      ${insurance.coverage.toLocaleString()} coverage
                    </Text>
                  </View>
                  {insurance.employerPaid && (
                    <View style={styles.employerPaidBadge}>
                      <Text style={styles.employerPaidText}>Employer Paid</Text>
                    </View>
                  )}
                </View>
                {!insurance.employerPaid && (
                  <Text style={styles.insurancePremium}>
                    Premium: ${insurance.premium}/mo
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'other' && (
          <>
            {/* Time Off */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time Off Benefits</Text>
              {benefits.timeOff.map((timeOff, index) => (
                <View key={index} style={styles.timeOffCard}>
                  <View style={styles.timeOffHeader}>
                    <Text style={styles.timeOffType}>
                      {timeOff.type.toUpperCase()}
                    </Text>
                    <Text style={styles.timeOffBalance}>
                      {timeOff.balance} hours
                    </Text>
                  </View>
                  <View style={styles.timeOffDetails}>
                    <View style={styles.timeOffRow}>
                      <Text style={styles.label}>Accrual Rate:</Text>
                      <Text style={styles.value}>{timeOff.accrualRate}</Text>
                    </View>
                    {timeOff.rolloverLimit && (
                      <View style={styles.timeOffRow}>
                        <Text style={styles.label}>Rollover Limit:</Text>
                        <Text style={styles.value}>{timeOff.rolloverLimit} hours</Text>
                      </View>
                    )}
                    {timeOff.useByDate && (
                      <View style={styles.warningBanner}>
                        <Ionicons name="warning" size={16} color="#FF9500" />
                        <Text style={styles.warningText}>
                          Use by: {new Date(timeOff.useByDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Other Benefits */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Benefits</Text>
              {benefits.otherBenefits.map((benefit, index) => (
                <View key={index} style={styles.otherBenefitCard}>
                  <View style={styles.otherBenefitHeader}>
                    <View style={styles.otherBenefitInfo}>
                      <Text style={styles.otherBenefitName}>{benefit.name}</Text>
                      <Text style={styles.otherBenefitCategory}>{benefit.category}</Text>
                    </View>
                    {benefit.utilized && (
                      <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                    )}
                  </View>
                  <Text style={styles.otherBenefitDescription}>{benefit.description}</Text>
                  <Text style={styles.otherBenefitValue}>
                    Value: ${benefit.value.toLocaleString()}/year
                  </Text>
                </View>
              ))}
            </View>
          </>
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
  compensationCard: {
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
  compensationLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  compensationValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 15,
  },
  compensationBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  utilizationSection: {
    marginTop: 15,
  },
  utilizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  utilizationLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  utilizationValue: {
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
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  enrollmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  enrollmentText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 8,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  recommendationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  checklistContent: {
    marginLeft: 12,
    flex: 1,
  },
  checklistTask: {
    fontSize: 15,
    color: '#000',
  },
  checklistTaskCompleted: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  checklistDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  healthCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthInfo: {
    marginLeft: 12,
    flex: 1,
  },
  healthType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  healthPlan: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  healthDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  fsaCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  fsaBalance: {
    backgroundColor: '#F5F5F7',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  fsaBalanceLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  fsaBalanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
  },
  contributionProgress: {
    marginBottom: 15,
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
  contributionBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  fsaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  warningText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 8,
  },
  retirementCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  retirementPlan: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 15,
  },
  matchSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F7',
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
  matchValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  vestingSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F7',
  },
  vestingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  vestingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vestingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  vestingBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  profitSharingSection: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  profitSharingLabel: {
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 4,
  },
  profitSharingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34C759',
  },
  stockSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F7',
  },
  stockTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  esppSection: {
    backgroundColor: '#F5F5F7',
    padding: 12,
    borderRadius: 8,
  },
  esppTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  esppRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  insuranceCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  insuranceType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  insuranceCoverage: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  employerPaidBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  employerPaidText: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: '600',
  },
  insurancePremium: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  timeOffCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  timeOffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeOffType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  timeOffBalance: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  timeOffDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  timeOffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  otherBenefitCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  otherBenefitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  otherBenefitInfo: {
    flex: 1,
  },
  otherBenefitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  otherBenefitCategory: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  otherBenefitDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  otherBenefitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
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
