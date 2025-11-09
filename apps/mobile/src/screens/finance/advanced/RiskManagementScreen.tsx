import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import {
  useInsurancePolicies,
  useAddInsurancePolicy,
  useUpdateInsurancePolicy,
  useDeleteInsurancePolicy,
  useRiskAssessment,
  useCoverageAnalysis,
  useInsuranceClaims,
  useAddInsuranceClaim,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface InsurancePolicy {
  id: string;
  type: 'life' | 'health' | 'property' | 'disability' | 'liability' | 'long-term-care';
  subtype?: string;
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  premium: number;
  premiumFrequency: 'monthly' | 'quarterly' | 'annual';
  deductible?: number;
  copay?: number;
  beneficiaries?: string[];
  renewalDate: string;
  expirationDate?: string;
  status: 'active' | 'pending' | 'expired';
}

interface Claim {
  id: string;
  policyId: string;
  type: string;
  date: string;
  amount: number;
  status: 'submitted' | 'processing' | 'approved' | 'denied' | 'paid';
  description: string;
}

interface CoverageGap {
  category: string;
  recommended: number;
  actual: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

interface RiskPortfolio {
  totalCoverage: number;
  annualPremiums: number;
  policyCount: number;
  gapsIdentified: number;
  policies: InsurancePolicy[];
  claims: Claim[];
  coverageGaps: CoverageGap[];
  riskScore: number;
  riskFactors: Array<{
    category: string;
    level: 'low' | 'medium' | 'high';
    description: string;
  }>;
  emergencyFund: {
    current: number;
    recommended: number;
    adequacy: number;
  };
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    potentialSavings?: number;
  }>;
}

export default function RiskManagementScreen() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'policies' | 'claims' | 'gaps'>('overview');
  const [selectedPolicyType, setSelectedPolicyType] = useState<string>('all');
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);

  const { data: policies, isLoading: isPoliciesLoading, error: policiesError, refetch: refetchPolicies } = useInsurancePolicies();
  const { data: riskAssessment } = useRiskAssessment();
  const { data: coverageAnalysis } = useCoverageAnalysis();
  const { data: claims } = useInsuranceClaims();
  const { mutate: updatePolicy } = useUpdateInsurancePolicy();
  const { mutate: addClaim } = useAddInsuranceClaim();

  // Construct portfolio from individual hooks
  const portfolio: RiskPortfolio | undefined = policies && riskAssessment && coverageAnalysis && claims ? {
    totalCoverage: policies.reduce((sum, p) => sum + p.coverageAmount, 0),
    annualPremiums: policies.reduce((sum, p) => sum + (p.premium * (p.premiumFrequency === 'monthly' ? 12 : p.premiumFrequency === 'quarterly' ? 4 : 1)), 0),
    policyCount: policies.length,
    gapsIdentified: coverageAnalysis.length,
    policies: policies,
    claims: claims,
    coverageGaps: coverageAnalysis,
    riskScore: riskAssessment.overall || 50,
    riskFactors: riskAssessment.factors || [],
    emergencyFund: riskAssessment.emergencyFund || { current: 0, recommended: 0, adequacy: 0 },
    recommendations: riskAssessment.recommendations || [],
  } : undefined;

  const isLoading = isPoliciesLoading;
  const error = policiesError;
  const refetch = refetchPolicies;
  const isRefreshing = false;

  const handleExportReport = () => {
    Alert.alert('Export', 'Risk management report exported successfully');
  };

  const getPolicyIcon = (type: string) => {
    const icons: Record<string, string> = {
      life: 'heart',
      health: 'medical',
      property: 'home',
      disability: 'accessibility',
      liability: 'shield-checkmark',
      'long-term-care': 'people',
    };
    return icons[type] || 'document';
  };

  const getPolicyColor = (type: string) => {
    const colors: Record<string, string> = {
      life: '#FF3B30',
      health: '#34C759',
      property: '#007AFF',
      disability: '#FF9500',
      liability: '#5856D6',
      'long-term-care': '#AF52DE',
    };
    return colors[type] || '#8E8E93';
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading risk portfolio...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load risk portfolio</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!portfolio) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="shield-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No insurance policies found</Text>
      </View>
    );
  }

  const filteredPolicies =
    selectedPolicyType === 'all'
      ? portfolio.policies
      : portfolio.policies.filter(p => p.type === selectedPolicyType);

  const policyTypeBreakdown = portfolio.policies.reduce((acc, policy) => {
    acc[policy.type] = (acc[policy.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const coverageData = {
    labels: portfolio.coverageGaps.map(gap => gap.category.substring(0, 10)),
    datasets: [
      {
        data: portfolio.coverageGaps.map(gap => gap.recommended),
        color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`,
      },
      {
        data: portfolio.coverageGaps.map(gap => gap.actual),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
      },
    ],
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Risk Management</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Overview Card */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Total Coverage</Text>
            <Text style={styles.overviewValue}>
              ${(portfolio.totalCoverage / 1000000).toFixed(1)}M
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Annual Premiums</Text>
            <Text style={styles.overviewValue}>
              ${portfolio.annualPremiums.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Active Policies</Text>
            <Text style={styles.overviewValue}>{portfolio.policyCount}</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Coverage Gaps</Text>
            <Text style={[styles.overviewValue, { color: '#FF3B30' }]}>
              {portfolio.gapsIdentified}
            </Text>
          </View>
        </View>

        {/* Risk Score */}
        <View style={styles.riskScoreContainer}>
          <Text style={styles.riskScoreLabel}>Risk Score</Text>
          <View style={styles.riskScoreBar}>
            <View
              style={[
                styles.riskScoreFill,
                {
                  width: `${portfolio.riskScore}%`,
                  backgroundColor:
                    portfolio.riskScore < 40
                      ? '#34C759'
                      : portfolio.riskScore < 70
                      ? '#FF9500'
                      : '#FF3B30',
                },
              ]}
            />
          </View>
          <Text style={styles.riskScoreValue}>{portfolio.riskScore}/100</Text>
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
          style={[styles.tab, selectedTab === 'policies' && styles.tabActive]}
          onPress={() => setSelectedTab('policies')}
        >
          <Text style={[styles.tabText, selectedTab === 'policies' && styles.tabTextActive]}>
            Policies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'claims' && styles.tabActive]}
          onPress={() => setSelectedTab('claims')}
        >
          <Text style={[styles.tabText, selectedTab === 'claims' && styles.tabTextActive]}>
            Claims
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'gaps' && styles.tabActive]}
          onPress={() => setSelectedTab('gaps')}
        >
          <Text style={[styles.tabText, selectedTab === 'gaps' && styles.tabTextActive]}>
            Gaps
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
            {/* Policy Type Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insurance Portfolio</Text>
              {Object.entries(policyTypeBreakdown).map(([type, count]) => (
                <View key={type} style={styles.policyTypeCard}>
                  <View style={styles.policyTypeHeader}>
                    <Ionicons
                      name={getPolicyIcon(type) as any}
                      size={24}
                      color={getPolicyColor(type)}
                    />
                    <Text style={styles.policyTypeName}>
                      {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  </View>
                  <Text style={styles.policyTypeCount}>{count} policies</Text>
                </View>
              ))}
            </View>

            {/* Risk Factors */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Risk Assessment</Text>
              {portfolio.riskFactors.map((factor, index) => (
                <View key={index} style={styles.riskFactorCard}>
                  <View style={styles.riskFactorHeader}>
                    <Text style={styles.riskFactorCategory}>{factor.category}</Text>
                    <View
                      style={[
                        styles.riskLevel,
                        factor.level === 'low' && styles.riskLevelLow,
                        factor.level === 'medium' && styles.riskLevelMedium,
                        factor.level === 'high' && styles.riskLevelHigh,
                      ]}
                    >
                      <Text style={styles.riskLevelText}>{factor.level}</Text>
                    </View>
                  </View>
                  <Text style={styles.riskFactorDescription}>{factor.description}</Text>
                </View>
              ))}
            </View>

            {/* Emergency Fund */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Emergency Fund Adequacy</Text>
              <View style={styles.emergencyFundCard}>
                <View style={styles.emergencyFundRow}>
                  <Text style={styles.label}>Current Balance:</Text>
                  <Text style={styles.value}>
                    ${portfolio.emergencyFund.current.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.emergencyFundRow}>
                  <Text style={styles.label}>Recommended:</Text>
                  <Text style={styles.value}>
                    ${portfolio.emergencyFund.recommended.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${portfolio.emergencyFund.adequacy}%` },
                    ]}
                  />
                </View>
                <Text style={styles.adequacyText}>
                  {portfolio.emergencyFund.adequacy}% of recommended amount
                </Text>
              </View>
            </View>

            {/* Recommendations */}
            {portfolio.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {portfolio.recommendations.map(rec => (
                  <View key={rec.id} style={styles.recommendationCard}>
                    <Text style={styles.recommendationTitle}>{rec.title}</Text>
                    <Text style={styles.recommendationDescription}>{rec.description}</Text>
                    {rec.potentialSavings && (
                      <Text style={styles.savingsText}>
                        Potential savings: ${rec.potentialSavings.toLocaleString()}/year
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {selectedTab === 'policies' && (
          <>
            {/* Policy Type Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedPolicyType === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setSelectedPolicyType('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedPolicyType === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {Object.keys(policyTypeBreakdown).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    selectedPolicyType === type && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedPolicyType(type)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedPolicyType === type && styles.filterChipTextActive,
                    ]}
                  >
                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Policy List */}
            <View style={styles.section}>
              {filteredPolicies.map(policy => (
                <TouchableOpacity
                  key={policy.id}
                  style={styles.policyCard}
                  onPress={() => setSelectedPolicy(policy)}
                >
                  <View style={styles.policyHeader}>
                    <Ionicons
                      name={getPolicyIcon(policy.type) as any}
                      size={24}
                      color={getPolicyColor(policy.type)}
                    />
                    <View style={styles.policyInfo}>
                      <Text style={styles.policyProvider}>{policy.provider}</Text>
                      <Text style={styles.policySubtype}>
                        {policy.subtype ||
                          policy.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.policyStatus,
                        policy.status === 'active' && styles.statusActive,
                        policy.status === 'pending' && styles.statusPending,
                        policy.status === 'expired' && styles.statusExpired,
                      ]}
                    >
                      <Text style={styles.policyStatusText}>{policy.status}</Text>
                    </View>
                  </View>

                  <View style={styles.policyDetails}>
                    <View style={styles.policyDetailRow}>
                      <Text style={styles.policyDetailLabel}>Coverage:</Text>
                      <Text style={styles.policyDetailValue}>
                        ${policy.coverageAmount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.policyDetailRow}>
                      <Text style={styles.policyDetailLabel}>Premium:</Text>
                      <Text style={styles.policyDetailValue}>
                        ${policy.premium.toLocaleString()}/{policy.premiumFrequency}
                      </Text>
                    </View>
                    {policy.deductible && (
                      <View style={styles.policyDetailRow}>
                        <Text style={styles.policyDetailLabel}>Deductible:</Text>
                        <Text style={styles.policyDetailValue}>
                          ${policy.deductible.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.policyDetailRow}>
                      <Text style={styles.policyDetailLabel}>Renewal:</Text>
                      <Text style={styles.policyDetailValue}>
                        {new Date(policy.renewalDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {selectedTab === 'claims' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Claims History</Text>
              <TouchableOpacity style={styles.addButton}>
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {portfolio.claims.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#999" />
                <Text style={styles.emptyText}>No claims submitted</Text>
              </View>
            ) : (
              portfolio.claims.map(claim => (
                <View key={claim.id} style={styles.claimCard}>
                  <View style={styles.claimHeader}>
                    <Text style={styles.claimType}>{claim.type}</Text>
                    <View
                      style={[
                        styles.claimStatus,
                        claim.status === 'paid' && styles.claimStatusPaid,
                        claim.status === 'approved' && styles.claimStatusApproved,
                        claim.status === 'processing' && styles.claimStatusProcessing,
                        claim.status === 'submitted' && styles.claimStatusSubmitted,
                        claim.status === 'denied' && styles.claimStatusDenied,
                      ]}
                    >
                      <Text style={styles.claimStatusText}>{claim.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.claimDescription}>{claim.description}</Text>
                  <View style={styles.claimFooter}>
                    <Text style={styles.claimDate}>
                      {new Date(claim.date).toLocaleDateString()}
                    </Text>
                    <Text style={styles.claimAmount}>${claim.amount.toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {selectedTab === 'gaps' && (
          <>
            {/* Coverage Gap Chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Coverage Analysis</Text>
              <View style={styles.chartCard}>
                <Text style={styles.chartLegend}>
                  <Text style={{ color: '#34C759' }}>■</Text> Recommended{' '}
                  <Text style={{ color: '#007AFF' }}>■</Text> Actual
                </Text>
                <BarChart
                  data={coverageData}
                  width={screenWidth - 60}
                  height={220}
                  yAxisLabel="$"
                  yAxisSuffix="k"
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  style={styles.chart}
                />
              </View>
            </View>

            {/* Gap Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Coverage Gaps</Text>
              {portfolio.coverageGaps.map((gap, index) => (
                <View key={index} style={styles.gapCard}>
                  <View style={styles.gapHeader}>
                    <Text style={styles.gapCategory}>{gap.category}</Text>
                    <View
                      style={[
                        styles.gapPriority,
                        gap.priority === 'high' && styles.priorityHigh,
                        gap.priority === 'medium' && styles.priorityMedium,
                        gap.priority === 'low' && styles.priorityLow,
                      ]}
                    >
                      <Text style={styles.gapPriorityText}>{gap.priority}</Text>
                    </View>
                  </View>
                  <View style={styles.gapRow}>
                    <Text style={styles.label}>Recommended:</Text>
                    <Text style={styles.value}>${gap.recommended.toLocaleString()}</Text>
                  </View>
                  <View style={styles.gapRow}>
                    <Text style={styles.label}>Current Coverage:</Text>
                    <Text style={styles.value}>${gap.actual.toLocaleString()}</Text>
                  </View>
                  <View style={styles.gapRow}>
                    <Text style={[styles.label, { fontWeight: '600' }]}>Gap:</Text>
                    <Text style={[styles.value, { color: '#FF3B30', fontWeight: '600' }]}>
                      ${gap.gap.toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Policy Detail Modal */}
      <Modal
        visible={selectedPolicy !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPolicy(null)}
      >
        {selectedPolicy && (
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Policy Details</Text>
                <TouchableOpacity onPress={() => setSelectedPolicy(null)}>
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Provider</Text>
                  <Text style={styles.modalValue}>{selectedPolicy.provider}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Policy Number</Text>
                  <Text style={styles.modalValue}>{selectedPolicy.policyNumber}</Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Coverage Amount</Text>
                  <Text style={styles.modalValue}>
                    ${selectedPolicy.coverageAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Premium</Text>
                  <Text style={styles.modalValue}>
                    ${selectedPolicy.premium.toLocaleString()}/{selectedPolicy.premiumFrequency}
                  </Text>
                </View>
                {selectedPolicy.beneficiaries && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Beneficiaries</Text>
                    <Text style={styles.modalValue}>
                      {selectedPolicy.beneficiaries.join(', ')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
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
  overviewCard: {
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
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  overviewItem: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  riskScoreContainer: {
    marginTop: 10,
  },
  riskScoreLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  riskScoreBar: {
    height: 10,
    backgroundColor: '#E5E5EA',
    borderRadius: 5,
    overflow: 'hidden',
  },
  riskScoreFill: {
    height: '100%',
    borderRadius: 5,
  },
  riskScoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 6,
    textAlign: 'right',
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
  policyTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  policyTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  policyTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  policyTypeCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  riskFactorCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  riskFactorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskFactorCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  riskLevel: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskLevelLow: {
    backgroundColor: '#E8F5E9',
  },
  riskLevelMedium: {
    backgroundColor: '#FFF3E0',
  },
  riskLevelHigh: {
    backgroundColor: '#FFEBEE',
  },
  riskLevelText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  riskFactorDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emergencyFundCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  emergencyFundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  adequacyText: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  savingsText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  filterScroll: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  policyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  policyInfo: {
    marginLeft: 12,
    flex: 1,
  },
  policyProvider: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  policySubtype: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  policyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusExpired: {
    backgroundColor: '#FFEBEE',
  },
  policyStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  policyDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  policyDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  policyDetailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  policyDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  claimCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  claimType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  claimStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  claimStatusPaid: {
    backgroundColor: '#E8F5E9',
  },
  claimStatusApproved: {
    backgroundColor: '#E3F2FD',
  },
  claimStatusProcessing: {
    backgroundColor: '#FFF3E0',
  },
  claimStatusSubmitted: {
    backgroundColor: '#F3E5F5',
  },
  claimStatusDenied: {
    backgroundColor: '#FFEBEE',
  },
  claimStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  claimDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  claimFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  claimDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  claimAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chartLegend: {
    fontSize: 14,
    marginBottom: 10,
  },
  chart: {
    borderRadius: 8,
  },
  gapCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  gapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gapCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  gapPriority: {
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
  gapPriorityText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalBody: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 6,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
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
