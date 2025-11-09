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
import * as DocumentPicker from 'expo-document-picker';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import {
  useLegacyPlan,
  useEstateDocuments,
  useUploadEstateDocument,
  useAddBeneficiary,
  useUpdateBeneficiary,
  useDeleteBeneficiary,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
  percentage: number;
  type: 'primary' | 'contingent';
  contact: string;
}

interface Document {
  id: string;
  type: string;
  name: string;
  uploadedDate: string;
  status: 'current' | 'outdated' | 'missing';
  location?: string;
}

interface EstatePlan {
  totalEstateValue: number;
  will?: {
    lastUpdated: string;
    executor: string;
    location: string;
    status: string;
  };
  trusts: Array<{
    id: string;
    name: string;
    type: 'revocable' | 'irrevocable';
    value: number;
    trustees: string[];
    beneficiaries: string[];
  }>;
  powerOfAttorney?: {
    type: string;
    agent: string;
    date: string;
  };
  healthcareDirective?: {
    hasLivingWill: boolean;
    healthcareProxy: string;
    date: string;
  };
  beneficiaries: Beneficiary[];
  assetDistribution: Array<{
    category: string;
    value: number;
    color: string;
  }>;
  documents: Document[];
  advisors: Array<{
    id: string;
    name: string;
    type: string;
    contact: string;
    firm?: string;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: string;
  }>;
  digitalAssets: Array<{
    id: string;
    type: string;
    platform: string;
    accessInfo: string;
  }>;
  charitableGiving?: {
    annualTarget: number;
    organizations: Array<{
      name: string;
      amount: number;
      type: string;
    }>;
  };
  estateTaxEstimate: number;
}

export default function LegacyPlanningScreen() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'beneficiaries' | 'documents' | 'advisors'>('overview');
  const [showAddBeneficiary, setShowAddBeneficiary] = useState(false);

  const { data: estatePlan, isLoading, error, refetch, isRefresching } = useLegacyPlan();
  const { mutate: uploadDocument } = useUploadEstateDocument();
  const { mutate: addBeneficiary } = useAddBeneficiary();

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
            Alert.alert('Success', 'Document uploaded successfully');
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

  const handleExportReport = async () => {
    Alert.alert('Export', 'Estate planning report exported successfully');
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading estate plan...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load estate plan</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!estatePlan) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No estate plan found</Text>
        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>Start Estate Planning</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const chartData = estatePlan.assetDistribution.map(item => ({
    name: item.category,
    value: item.value,
    color: item.color,
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estate & Legacy Planning</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Estate Overview Card */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Total Estate Value</Text>
            <Text style={styles.overviewValue}>
              ${estatePlan.totalEstateValue.toLocaleString()}
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Beneficiaries</Text>
            <Text style={styles.overviewValue}>{estatePlan.beneficiaries.length}</Text>
          </View>
        </View>
        <View style={styles.overviewRow}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Documents</Text>
            <Text style={styles.overviewValue}>
              {estatePlan.documents.filter(d => d.status === 'current').length}/
              {estatePlan.documents.length}
            </Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Est. Estate Tax</Text>
            <Text style={styles.overviewValue}>
              ${estatePlan.estateTaxEstimate.toLocaleString()}
            </Text>
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
          style={[styles.tab, selectedTab === 'beneficiaries' && styles.tabActive]}
          onPress={() => setSelectedTab('beneficiaries')}
        >
          <Text style={[styles.tabText, selectedTab === 'beneficiaries' && styles.tabTextActive]}>
            Beneficiaries
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
          style={[styles.tab, selectedTab === 'advisors' && styles.tabActive]}
          onPress={() => setSelectedTab('advisors')}
        >
          <Text style={[styles.tabText, selectedTab === 'advisors' && styles.tabTextActive]}>
            Advisors
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
            {/* Will & Trust Management */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Will & Trust Management</Text>

              {estatePlan.will && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="document-text" size={24} color="#007AFF" />
                    <Text style={styles.cardTitle}>Last Will & Testament</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Last Updated:</Text>
                    <Text style={styles.value}>
                      {new Date(estatePlan.will.lastUpdated).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Executor:</Text>
                    <Text style={styles.value}>{estatePlan.will.executor}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Location:</Text>
                    <Text style={styles.value}>{estatePlan.will.location}</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{estatePlan.will.status}</Text>
                  </View>
                </View>
              )}

              {estatePlan.trusts.map(trust => (
                <View key={trust.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="shield-checkmark" size={24} color="#34C759" />
                    <Text style={styles.cardTitle}>{trust.name}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Type:</Text>
                    <Text style={styles.value}>{trust.type}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Value:</Text>
                    <Text style={styles.value}>${trust.value.toLocaleString()}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Trustees:</Text>
                    <Text style={styles.value}>{trust.trustees.join(', ')}</Text>
                  </View>
                </View>
              ))}

              {estatePlan.powerOfAttorney && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person" size={24} color="#FF9500" />
                    <Text style={styles.cardTitle}>Power of Attorney</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Type:</Text>
                    <Text style={styles.value}>{estatePlan.powerOfAttorney.type}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Agent:</Text>
                    <Text style={styles.value}>{estatePlan.powerOfAttorney.agent}</Text>
                  </View>
                </View>
              )}

              {estatePlan.healthcareDirective && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="medical" size={24} color="#FF3B30" />
                    <Text style={styles.cardTitle}>Healthcare Directive</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Living Will:</Text>
                    <Text style={styles.value}>
                      {estatePlan.healthcareDirective.hasLivingWill ? 'Yes' : 'No'}
                    </Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Healthcare Proxy:</Text>
                    <Text style={styles.value}>
                      {estatePlan.healthcareDirective.healthcareProxy}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Asset Distribution */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Asset Distribution Plan</Text>
              <View style={styles.chartCard}>
                <PieChart
                  data={chartData}
                  width={screenWidth - 60}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  }}
                  accessor="value"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>
            </View>

            {/* Digital Assets */}
            {estatePlan.digitalAssets.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Digital Asset Inventory</Text>
                {estatePlan.digitalAssets.map(asset => (
                  <View key={asset.id} style={styles.listItem}>
                    <Ionicons name="globe-outline" size={20} color="#007AFF" />
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>{asset.platform}</Text>
                      <Text style={styles.listItemSubtitle}>{asset.type}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Charitable Giving */}
            {estatePlan.charitableGiving && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Charitable Giving Plan</Text>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Annual Target:</Text>
                    <Text style={styles.value}>
                      ${estatePlan.charitableGiving.annualTarget.toLocaleString()}
                    </Text>
                  </View>
                  {estatePlan.charitableGiving.organizations.map((org, index) => (
                    <View key={index} style={styles.cardRow}>
                      <Text style={styles.label}>{org.name}:</Text>
                      <Text style={styles.value}>${org.amount.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Action Items */}
            {estatePlan.actionItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Action Items</Text>
                {estatePlan.actionItems.map(item => (
                  <View key={item.id} style={styles.actionItem}>
                    <View style={[
                      styles.priorityBadge,
                      item.priority === 'high' && styles.priorityHigh,
                      item.priority === 'medium' && styles.priorityMedium,
                      item.priority === 'low' && styles.priorityLow,
                    ]}>
                      <Text style={styles.priorityText}>{item.priority}</Text>
                    </View>
                    <View style={styles.actionItemContent}>
                      <Text style={styles.actionItemTitle}>{item.title}</Text>
                      {item.dueDate && (
                        <Text style={styles.actionItemDate}>
                          Due: {new Date(item.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {selectedTab === 'beneficiaries' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Beneficiaries</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddBeneficiary(true)}
              >
                <Ionicons name="add-circle" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.subsectionTitle}>Primary Beneficiaries</Text>
            {estatePlan.beneficiaries
              .filter(b => b.type === 'primary')
              .map(beneficiary => (
                <View key={beneficiary.id} style={styles.beneficiaryCard}>
                  <View style={styles.beneficiaryHeader}>
                    <View>
                      <Text style={styles.beneficiaryName}>{beneficiary.name}</Text>
                      <Text style={styles.beneficiaryRelation}>{beneficiary.relationship}</Text>
                    </View>
                    <Text style={styles.beneficiaryPercentage}>{beneficiary.percentage}%</Text>
                  </View>
                  <Text style={styles.beneficiaryContact}>{beneficiary.contact}</Text>
                </View>
              ))}

            <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>
              Contingent Beneficiaries
            </Text>
            {estatePlan.beneficiaries
              .filter(b => b.type === 'contingent')
              .map(beneficiary => (
                <View key={beneficiary.id} style={styles.beneficiaryCard}>
                  <View style={styles.beneficiaryHeader}>
                    <View>
                      <Text style={styles.beneficiaryName}>{beneficiary.name}</Text>
                      <Text style={styles.beneficiaryRelation}>{beneficiary.relationship}</Text>
                    </View>
                    <Text style={styles.beneficiaryPercentage}>{beneficiary.percentage}%</Text>
                  </View>
                  <Text style={styles.beneficiaryContact}>{beneficiary.contact}</Text>
                </View>
              ))}
          </View>
        )}

        {selectedTab === 'documents' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Document Vault</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleUploadDocument}
              >
                <Ionicons name="cloud-upload" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {estatePlan.documents.map(doc => (
              <View key={doc.id} style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <Ionicons
                    name="document"
                    size={24}
                    color={
                      doc.status === 'current'
                        ? '#34C759'
                        : doc.status === 'outdated'
                        ? '#FF9500'
                        : '#FF3B30'
                    }
                  />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{doc.name}</Text>
                    <Text style={styles.documentType}>{doc.type}</Text>
                  </View>
                  <View style={[
                    styles.documentStatus,
                    doc.status === 'current' && styles.statusCurrent,
                    doc.status === 'outdated' && styles.statusOutdated,
                    doc.status === 'missing' && styles.statusMissing,
                  ]}>
                    <Text style={styles.documentStatusText}>{doc.status}</Text>
                  </View>
                </View>
                <Text style={styles.documentDate}>
                  Uploaded: {new Date(doc.uploadedDate).toLocaleDateString()}
                </Text>
                {doc.location && (
                  <Text style={styles.documentLocation}>Location: {doc.location}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'advisors' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Advisors</Text>
            {estatePlan.advisors.map(advisor => (
              <View key={advisor.id} style={styles.advisorCard}>
                <View style={styles.advisorHeader}>
                  <Ionicons name="briefcase" size={24} color="#007AFF" />
                  <View style={styles.advisorInfo}>
                    <Text style={styles.advisorName}>{advisor.name}</Text>
                    <Text style={styles.advisorType}>{advisor.type}</Text>
                    {advisor.firm && (
                      <Text style={styles.advisorFirm}>{advisor.firm}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity style={styles.contactButton}>
                  <Ionicons name="call" size={16} color="#007AFF" />
                  <Text style={styles.contactButtonText}>{advisor.contact}</Text>
                </TouchableOpacity>
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
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 10,
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
  statusBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  listItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
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
  actionItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  actionItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  actionItemDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  beneficiaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  beneficiaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  beneficiaryRelation: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  beneficiaryPercentage: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  beneficiaryContact: {
    fontSize: 14,
    color: '#666',
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
  documentStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusCurrent: {
    backgroundColor: '#E8F5E9',
  },
  statusOutdated: {
    backgroundColor: '#FFF3E0',
  },
  statusMissing: {
    backgroundColor: '#FFEBEE',
  },
  documentStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  documentDate: {
    fontSize: 13,
    color: '#8E8E93',
  },
  documentLocation: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
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
    color: '#007AFF',
    marginTop: 2,
  },
  advisorFirm: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    padding: 10,
    borderRadius: 8,
  },
  contactButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  addButton: {
    padding: 5,
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
  createButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
