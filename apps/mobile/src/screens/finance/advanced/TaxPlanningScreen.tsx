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
import * as DocumentPicker from 'expo-document-picker';
import {
  useTaxPlan,
  useTaxProjections,
  useTaxDocuments,
  useAddTaxDocument,
  useDeductions,
  useAddDeduction,
  useQuarterlyEstimates,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface TaxDocument {
  id: string;
  type: string;
  year: number;
  uploadedDate: string;
  fileName: string;
}

interface TaxProjection {
  year: number;
  estimatedIncome: number;
  estimatedTax: number;
  effectiveRate: number;
}

interface QuarterlyEstimate {
  quarter: number;
  dueDate: string;
  amount: number;
  paid: boolean;
  paymentDate?: string;
}

interface TaxPlan {
  currentYear: number;
  estimatedTaxLiability: number;
  effectiveTaxRate: number;
  taxBracket: string;
  withholdingsToDate: number;
  estimatedRefundOwed: number;
  income: {
    w2Income: number;
    income1099: number;
    sideIncome: number;
    investmentIncome: number;
    rentalIncome: number;
    otherIncome: number;
  };
  deductions: {
    standard: number;
    itemized: {
      mortgageInterest: number;
      propertyTax: number;
      charitableContributions: number;
      medicalExpenses: number;
      studentLoanInterest: number;
      stateLocalTax: number;
      other: number;
    };
    usingItemized: boolean;
  };
  optimizationStrategies: Array<{
    id: string;
    strategy: string;
    description: string;
    potentialSavings: number;
    implemented: boolean;
  }>;
  documents: TaxDocument[];
  quarterlyEstimates?: QuarterlyEstimate[];
  projections: TaxProjection[];
  taxCredits: Array<{
    name: string;
    amount: number;
    eligible: boolean;
  }>;
  stateBreakdown?: {
    federalTax: number;
    stateTax: number;
    localTax: number;
  };
}

export default function TaxPlanningScreen() {
  const [selectedTab, setSelectedTab] = useState<'summary' | 'optimization' | 'documents' | 'projections'>('summary');

  const { data: taxPlan, isLoading, error, refetch, isRefresching } = useTaxPlan();
  const { mutate: uploadDocument } = useAddTaxDocument();

  const isRefreshing = isRefresching || false;

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        uploadDocument(result.assets[0], {
          onSuccess: () => {
            Alert.alert('Success', 'Tax document uploaded successfully');
          },
          onError: () => {
            Alert.alert('Error', 'Failed to upload document');
          },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleExportReport = () => {
    Alert.alert('Export', 'Tax planning report exported successfully');
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading tax plan...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load tax plan</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!taxPlan) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="calculator-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No tax plan found</Text>
      </View>
    );
  }

  const totalIncome = Object.values(taxPlan.income).reduce((sum, val) => sum + val, 0);
  const totalItemizedDeductions = Object.values(taxPlan.deductions.itemized).reduce(
    (sum, val) => sum + val,
    0
  );

  const projectionData = {
    labels: taxPlan.projections.map(p => p.year.toString()),
    datasets: [
      {
        data: taxPlan.projections.map(p => p.estimatedTax),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tax Planning</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tax Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{taxPlan.currentYear} Est. Tax</Text>
            <Text style={styles.summaryValue}>
              ${taxPlan.estimatedTaxLiability.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Effective Rate</Text>
            <Text style={styles.summaryValue}>{taxPlan.effectiveTaxRate}%</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tax Bracket</Text>
            <Text style={styles.summaryValue}>{taxPlan.taxBracket}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Refund/Owed</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color: taxPlan.estimatedRefundOwed > 0 ? '#34C759' : '#FF3B30',
                },
              ]}
            >
              {taxPlan.estimatedRefundOwed > 0 ? '+' : ''}$
              {Math.abs(taxPlan.estimatedRefundOwed).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Withholdings Progress</Text>
            <Text style={styles.progressValue}>
              ${taxPlan.withholdingsToDate.toLocaleString()} / $
              {taxPlan.estimatedTaxLiability.toLocaleString()}
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(
                    (taxPlan.withholdingsToDate / taxPlan.estimatedTaxLiability) * 100,
                    100
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'summary' && styles.tabActive]}
          onPress={() => setSelectedTab('summary')}
        >
          <Text style={[styles.tabText, selectedTab === 'summary' && styles.tabTextActive]}>
            Summary
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'optimization' && styles.tabActive]}
          onPress={() => setSelectedTab('optimization')}
        >
          <Text style={[styles.tabText, selectedTab === 'optimization' && styles.tabTextActive]}>
            Optimize
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'documents' && styles.tabActive]}
          onPress={() => setSelectedTab('documents')}
        >
          <Text style={[styles.tabText, selectedTab === 'documents' && styles.tabTextActive]}>
            Documents
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'projections' && styles.tabActive]}
          onPress={() => setSelectedTab('projections')}
        >
          <Text style={[styles.tabText, selectedTab === 'projections' && styles.tabTextActive]}>
            Projections
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
        {selectedTab === 'summary' && (
          <>
            {/* Income Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Income Sources</Text>
              <View style={styles.card}>
                {Object.entries(taxPlan.income).map(([key, value]) => (
                  <View key={key} style={styles.cardRow}>
                    <Text style={styles.label}>
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())}
                      :
                    </Text>
                    <Text style={styles.value}>${value.toLocaleString()}</Text>
                  </View>
                ))}
                <View style={[styles.cardRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Income:</Text>
                  <Text style={styles.totalValue}>${totalIncome.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Deductions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deductions</Text>
              <View style={styles.deductionToggle}>
                <TouchableOpacity
                  style={[
                    styles.deductionOption,
                    !taxPlan.deductions.usingItemized && styles.deductionOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.deductionOptionText,
                      !taxPlan.deductions.usingItemized && styles.deductionOptionTextActive,
                    ]}
                  >
                    Standard
                  </Text>
                  <Text style={styles.deductionAmount}>
                    ${taxPlan.deductions.standard.toLocaleString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deductionOption,
                    taxPlan.deductions.usingItemized && styles.deductionOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.deductionOptionText,
                      taxPlan.deductions.usingItemized && styles.deductionOptionTextActive,
                    ]}
                  >
                    Itemized
                  </Text>
                  <Text style={styles.deductionAmount}>
                    ${totalItemizedDeductions.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              </View>

              {taxPlan.deductions.usingItemized && (
                <View style={styles.card}>
                  {Object.entries(taxPlan.deductions.itemized).map(([key, value]) => (
                    <View key={key} style={styles.cardRow}>
                      <Text style={styles.label}>
                        {key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())}
                        :
                      </Text>
                      <Text style={styles.value}>${value.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Tax Credits */}
            {taxPlan.taxCredits.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tax Credits</Text>
                {taxPlan.taxCredits.map((credit, index) => (
                  <View key={index} style={styles.creditCard}>
                    <View style={styles.creditHeader}>
                      <Text style={styles.creditName}>{credit.name}</Text>
                      <View
                        style={[
                          styles.eligibilityBadge,
                          credit.eligible ? styles.eligibleBadge : styles.notEligibleBadge,
                        ]}
                      >
                        <Text style={styles.eligibilityText}>
                          {credit.eligible ? 'Eligible' : 'Not Eligible'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.creditAmount}>${credit.amount.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* State Breakdown */}
            {taxPlan.stateBreakdown && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tax Breakdown</Text>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Federal Tax:</Text>
                    <Text style={styles.value}>
                      ${taxPlan.stateBreakdown.federalTax.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>State Tax:</Text>
                    <Text style={styles.value}>
                      ${taxPlan.stateBreakdown.stateTax.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Local Tax:</Text>
                    <Text style={styles.value}>
                      ${taxPlan.stateBreakdown.localTax.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quarterly Estimates */}
            {taxPlan.quarterlyEstimates && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quarterly Estimated Payments</Text>
                {taxPlan.quarterlyEstimates.map(estimate => (
                  <View key={estimate.quarter} style={styles.quarterlyCard}>
                    <View style={styles.quarterlyHeader}>
                      <View>
                        <Text style={styles.quarterlyTitle}>Q{estimate.quarter} Payment</Text>
                        <Text style={styles.quarterlyDate}>
                          Due: {new Date(estimate.dueDate).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.quarterlyAmount}>
                        ${estimate.amount.toLocaleString()}
                      </Text>
                    </View>
                    {estimate.paid ? (
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                        <Text style={styles.paidText}>
                          Paid {new Date(estimate.paymentDate!).toLocaleDateString()}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.payButton}
                      >
                        <Text style={styles.payButtonText}>Mark as Paid</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {selectedTab === 'optimization' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tax Optimization Strategies</Text>
            <View style={styles.savingsCard}>
              <Text style={styles.savingsLabel}>Total Potential Savings</Text>
              <Text style={styles.savingsValue}>
                $
                {taxPlan.optimizationStrategies
                  .reduce((sum, s) => sum + s.potentialSavings, 0)
                  .toLocaleString()}
              </Text>
            </View>

            {taxPlan.optimizationStrategies.map(strategy => (
              <View key={strategy.id} style={styles.strategyCard}>
                <View style={styles.strategyHeader}>
                  <Ionicons
                    name={strategy.implemented ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={strategy.implemented ? '#34C759' : '#8E8E93'}
                  />
                  <View style={styles.strategyInfo}>
                    <Text style={styles.strategyName}>{strategy.strategy}</Text>
                    <Text style={styles.strategyDescription}>{strategy.description}</Text>
                  </View>
                </View>
                <View style={styles.strategyFooter}>
                  <Text style={styles.strategySavings}>
                    Save ${strategy.potentialSavings.toLocaleString()}/year
                  </Text>
                  {!strategy.implemented && (
                    <TouchableOpacity
                      style={styles.implementButton}
                    >
                      <Text style={styles.implementButtonText}>Implement</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'documents' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tax Documents</Text>
              <TouchableOpacity style={styles.addButton} onPress={handleUploadDocument}>
                <Ionicons name="cloud-upload" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {taxPlan.documents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={48} color="#999" />
                <Text style={styles.emptyText}>No documents uploaded</Text>
              </View>
            ) : (
              taxPlan.documents.map(doc => (
                <View key={doc.id} style={styles.documentCard}>
                  <View style={styles.documentHeader}>
                    <Ionicons name="document" size={24} color="#007AFF" />
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentName}>{doc.fileName}</Text>
                      <Text style={styles.documentType}>
                        {doc.type} - {doc.year}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.documentDate}>
                    Uploaded: {new Date(doc.uploadedDate).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {selectedTab === 'projections' && (
          <>
            {/* Projection Chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Multi-Year Tax Projections</Text>
              <View style={styles.chartCard}>
                <LineChart
                  data={projectionData}
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
                    propsForDots: {
                      r: '6',
                      strokeWidth: '2',
                      stroke: '#007AFF',
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            </View>

            {/* Projection Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Yearly Breakdown</Text>
              {taxPlan.projections.map(projection => (
                <View key={projection.year} style={styles.projectionCard}>
                  <Text style={styles.projectionYear}>{projection.year}</Text>
                  <View style={styles.projectionRow}>
                    <Text style={styles.label}>Estimated Income:</Text>
                    <Text style={styles.value}>
                      ${projection.estimatedIncome.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.projectionRow}>
                    <Text style={styles.label}>Estimated Tax:</Text>
                    <Text style={styles.value}>
                      ${projection.estimatedTax.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.projectionRow}>
                    <Text style={styles.label}>Effective Rate:</Text>
                    <Text style={styles.value}>{projection.effectiveRate}%</Text>
                  </View>
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
  summaryCard: {
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  progressSection: {
    marginTop: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#E5E5EA',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 5,
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
  deductionToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
  },
  deductionOption: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deductionOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deductionOptionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  deductionOptionTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  deductionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  creditCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  creditName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  eligibilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eligibleBadge: {
    backgroundColor: '#E8F5E9',
  },
  notEligibleBadge: {
    backgroundColor: '#FFEBEE',
  },
  eligibilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  creditAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
  },
  quarterlyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  quarterlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quarterlyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  quarterlyDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  quarterlyAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
  },
  paidText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginLeft: 8,
  },
  payButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  savingsCard: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  savingsLabel: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  savingsValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#34C759',
  },
  strategyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  strategyHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  strategyInfo: {
    marginLeft: 12,
    flex: 1,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  strategyDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  strategyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  strategySavings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  implementButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  implementButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  documentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  documentType: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  documentDate: {
    fontSize: 13,
    color: '#8E8E93',
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
  projectionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  projectionYear: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
  },
  projectionRow: {
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
