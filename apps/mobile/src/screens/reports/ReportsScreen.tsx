/**
 * Life Navigator - Reports Screen
 *
 * Elite-level report generation and management
 * Custom report builder, templates, export formats, scheduled reports
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Card } from '../../components/common/Card';

// Types
interface Report {
  id: string;
  name: string;
  type: 'custom' | 'template';
  template?: ReportTemplate;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  domains: string[];
  format: 'pdf' | 'csv' | 'json' | 'excel';
  status: 'generating' | 'ready' | 'failed';
  createdAt: string;
  fileUrl?: string;
  fileSize?: string;
  scheduled?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    nextRun?: string;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  defaultDomains: string[];
  metrics: string[];
}

interface DateRangeOption {
  label: string;
  start: string;
  end: string;
}

export function ReportsScreen() {
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeOption>(dateRangeOptions[0]);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'json' | 'excel'>('pdf');
  const [reportName, setReportName] = useState('');

  // Fetch reports history
  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return mockReports;
    },
  });

  // Fetch report templates
  const { data: templates } = useQuery<ReportTemplate[]>({
    queryKey: ['report-templates'],
    queryFn: async () => {
      return mockTemplates;
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (reportConfig: Partial<Report>) => {
      // TODO: API call to generate report
      console.log('Generating report:', reportConfig);
      return { id: 'new-report-id', status: 'generating' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowBuilder(false);
      resetBuilder();
    },
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      // TODO: API call to delete report
      console.log('Deleting report:', reportId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  // Download report mutation
  const downloadReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      // TODO: Implement actual download
      console.log('Downloading report:', reportId);
    },
  });

  const resetBuilder = () => {
    setSelectedTemplate(null);
    setSelectedDomains([]);
    setSelectedDateRange(dateRangeOptions[0]);
    setSelectedFormat('pdf');
    setReportName('');
  };

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setSelectedDomains(template.defaultDomains);
    setReportName(template.name);
  };

  const handleDomainToggle = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleGenerateReport = () => {
    const reportConfig: Partial<Report> = {
      name: reportName || selectedTemplate?.name || 'Custom Report',
      type: selectedTemplate ? 'template' : 'custom',
      template: selectedTemplate || undefined,
      dateRange: selectedDateRange,
      domains: selectedDomains,
      format: selectedFormat,
      status: 'generating',
    };
    generateReportMutation.mutate(reportConfig);
  };

  const handleShareReport = async (report: Report) => {
    if (!report.fileUrl) return;
    try {
      await Share.share({
        message: `Report: ${report.name}`,
        url: report.fileUrl,
      });
    } catch (error) {
      console.error('Error sharing report:', error);
    }
  };

  const getFormatIcon = (format: string) => {
    const icons: Record<string, string> = {
      pdf: '📄',
      csv: '📊',
      json: '📋',
      excel: '📈',
    };
    return icons[format] || '📄';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return colors.success;
      case 'generating':
        return colors.warning;
      case 'failed':
        return colors.error;
      default:
        return colors.gray[500];
    }
  };

  const renderTemplateCard = (template: ReportTemplate) => (
    <TouchableOpacity
      key={template.id}
      onPress={() => {
        handleTemplateSelect(template);
        setShowBuilder(true);
      }}
    >
      <Card style={styles.templateCard} shadow="sm">
        <Text style={styles.templateIcon}>{template.icon}</Text>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templateDescription} numberOfLines={2}>
          {template.description}
        </Text>
        <View style={styles.templateMeta}>
          <Text style={styles.templateCategory}>{template.category}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderReportCard = (report: Report) => (
    <Card key={report.id} style={styles.reportCard} shadow="sm">
      <View style={styles.reportHeader}>
        <Text style={styles.formatIcon}>{getFormatIcon(report.format)}</Text>
        <View style={styles.reportInfo}>
          <Text style={styles.reportName}>{report.name}</Text>
          <Text style={styles.reportDate}>
            {report.dateRange.label} • {formatDate(report.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
            {report.status}
          </Text>
        </View>
      </View>

      <View style={styles.reportDomains}>
        {report.domains.map((domain) => (
          <View key={domain} style={styles.domainChip}>
            <Text style={styles.domainChipText}>{domain}</Text>
          </View>
        ))}
      </View>

      {report.fileSize && (
        <Text style={styles.fileSize}>Size: {report.fileSize}</Text>
      )}

      {report.scheduled?.enabled && (
        <View style={styles.scheduledBadge}>
          <Text style={styles.scheduledIcon}>🔄</Text>
          <Text style={styles.scheduledText}>
            {report.scheduled.frequency} • Next: {report.scheduled.nextRun}
          </Text>
        </View>
      )}

      {report.status === 'ready' && (
        <View style={styles.reportActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => downloadReportMutation.mutate(report.id)}
          >
            <Text style={styles.actionButtonText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareReport(report)}
          >
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteReportMutation.mutate(report.id)}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  const renderReportBuilder = () => (
    <Modal
      visible={showBuilder}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowBuilder(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowBuilder(false)}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {selectedTemplate ? selectedTemplate.name : 'Custom Report'}
          </Text>
          <TouchableOpacity
            onPress={handleGenerateReport}
            disabled={selectedDomains.length === 0}
          >
            <Text
              style={[
                styles.generateButton,
                selectedDomains.length === 0 && styles.disabledButton,
              ]}
            >
              Generate
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Date Range */}
          <Card style={styles.builderSection}>
            <Text style={styles.builderSectionTitle}>Date Range</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dateRangeOptions.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionChip,
                    selectedDateRange.label === option.label && styles.optionChipActive,
                  ]}
                  onPress={() => setSelectedDateRange(option)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      selectedDateRange.label === option.label && styles.optionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>

          {/* Domains */}
          <Card style={styles.builderSection}>
            <Text style={styles.builderSectionTitle}>Domains</Text>
            <View style={styles.domainGrid}>
              {availableDomains.map((domain) => (
                <TouchableOpacity
                  key={domain.id}
                  style={[
                    styles.domainCard,
                    selectedDomains.includes(domain.id) && styles.domainCardActive,
                  ]}
                  onPress={() => handleDomainToggle(domain.id)}
                >
                  <Text style={styles.domainIcon}>{domain.icon}</Text>
                  <Text style={styles.domainLabel}>{domain.label}</Text>
                  {selectedDomains.includes(domain.id) && (
                    <View style={styles.selectedCheck}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Export Format */}
          <Card style={styles.builderSection}>
            <Text style={styles.builderSectionTitle}>Export Format</Text>
            <View style={styles.formatGrid}>
              {(['pdf', 'csv', 'json', 'excel'] as const).map((format) => (
                <TouchableOpacity
                  key={format}
                  style={[
                    styles.formatCard,
                    selectedFormat === format && styles.formatCardActive,
                  ]}
                  onPress={() => setSelectedFormat(format)}
                >
                  <Text style={styles.formatCardIcon}>{getFormatIcon(format)}</Text>
                  <Text style={styles.formatCardText}>{format.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Metrics Preview */}
          {selectedTemplate && (
            <Card style={styles.builderSection}>
              <Text style={styles.builderSectionTitle}>Included Metrics</Text>
              {selectedTemplate.metrics.map((metric) => (
                <View key={metric} style={styles.metricItem}>
                  <Text style={styles.metricIcon}>✓</Text>
                  <Text style={styles.metricText}>{metric}</Text>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <Text style={styles.headerSubtitle}>Generate and manage custom reports</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Create Report</Text>
          </View>
          <TouchableOpacity
            style={styles.customReportButton}
            onPress={() => {
              resetBuilder();
              setShowBuilder(true);
            }}
          >
            <Text style={styles.customReportIcon}>✨</Text>
            <View style={styles.customReportInfo}>
              <Text style={styles.customReportTitle}>Custom Report</Text>
              <Text style={styles.customReportDescription}>
                Build a report with your own parameters
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Templates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {templates?.map(renderTemplateCard)}
          </ScrollView>
        </View>

        {/* Recent Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          {reports && reports.length > 0 ? (
            reports.map(renderReportCard)
          ) : (
            <Card style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyDescription}>
                Create your first report to get started
              </Text>
            </Card>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Report Builder Modal */}
      {renderReportBuilder()}
    </View>
  );
}

// Helper functions
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Mock data and constants
const dateRangeOptions: DateRangeOption[] = [
  { label: 'Last 7 days', start: '2025-10-31', end: '2025-11-07' },
  { label: 'Last 30 days', start: '2025-10-08', end: '2025-11-07' },
  { label: 'Last 3 months', start: '2025-08-07', end: '2025-11-07' },
  { label: 'Last 6 months', start: '2025-05-07', end: '2025-11-07' },
  { label: 'This year', start: '2025-01-01', end: '2025-11-07' },
  { label: 'All time', start: '2020-01-01', end: '2025-11-07' },
];

const availableDomains = [
  { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'career', label: 'Career', icon: '💼' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
];

const mockTemplates: ReportTemplate[] = [
  {
    id: 't1',
    name: 'Health Summary',
    description: 'Comprehensive overview of medications, appointments, and health metrics',
    icon: '🏥',
    category: 'Healthcare',
    defaultDomains: ['healthcare'],
    metrics: [
      'Medication adherence rate',
      'Upcoming appointments',
      'Health screening status',
      'Vital signs trends',
      'Medical conditions summary',
    ],
  },
  {
    id: 't2',
    name: 'Financial Overview',
    description: 'Income, expenses, budgets, and savings analysis',
    icon: '💰',
    category: 'Finance',
    defaultDomains: ['finance'],
    metrics: [
      'Total income vs expenses',
      'Budget performance by category',
      'Savings rate',
      'Investment performance',
      'Debt summary',
    ],
  },
  {
    id: 't3',
    name: 'Career Progress',
    description: 'Job applications, skills, and career development tracking',
    icon: '💼',
    category: 'Career',
    defaultDomains: ['career', 'education'],
    metrics: [
      'Job applications status',
      'Interview success rate',
      'Skills acquired',
      'Certifications completed',
      'Salary progression',
    ],
  },
  {
    id: 't4',
    name: 'Goals Dashboard',
    description: 'Progress tracking across all life domains',
    icon: '🎯',
    category: 'Goals',
    defaultDomains: ['goals', 'healthcare', 'finance', 'career'],
    metrics: [
      'Goals completion rate',
      'Milestones achieved',
      'At-risk goals',
      'Average time to completion',
      'Goal category breakdown',
    ],
  },
  {
    id: 't5',
    name: 'Complete Life Report',
    description: 'Holistic view across all domains and metrics',
    icon: '📊',
    category: 'Comprehensive',
    defaultDomains: ['healthcare', 'finance', 'career', 'education', 'family', 'goals'],
    metrics: [
      'All healthcare data',
      'Complete financial summary',
      'Career and education progress',
      'Family activities and events',
      'Goals across all domains',
      'AI insights and recommendations',
    ],
  },
];

const mockReports: Report[] = [
  {
    id: 'r1',
    name: 'Health Summary',
    type: 'template',
    template: mockTemplates[0],
    dateRange: { start: '2025-10-08', end: '2025-11-07', label: 'Last 30 days' },
    domains: ['healthcare'],
    format: 'pdf',
    status: 'ready',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    fileUrl: 'https://example.com/report1.pdf',
    fileSize: '2.4 MB',
  },
  {
    id: 'r2',
    name: 'Financial Overview',
    type: 'template',
    template: mockTemplates[1],
    dateRange: { start: '2025-08-07', end: '2025-11-07', label: 'Last 3 months' },
    domains: ['finance'],
    format: 'excel',
    status: 'ready',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    fileUrl: 'https://example.com/report2.xlsx',
    fileSize: '1.8 MB',
    scheduled: {
      enabled: true,
      frequency: 'monthly',
      nextRun: 'Dec 1, 2025',
    },
  },
  {
    id: 'r3',
    name: 'Q4 Goals Report',
    type: 'custom',
    dateRange: { start: '2025-10-01', end: '2025-12-31', label: 'Q4 2025' },
    domains: ['goals', 'career'],
    format: 'pdf',
    status: 'generating',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  header: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    paddingTop: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.gray[900],
  },
  headerSubtitle: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[1],
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  customReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  customReportIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  customReportInfo: {
    flex: 1,
  },
  customReportTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  customReportDescription: {
    ...textStyles.body,
    color: colors.gray[600],
  },
  chevron: {
    fontSize: 32,
    color: colors.gray[400],
  },
  templateCard: {
    width: 200,
    marginRight: spacing[3],
    padding: spacing[4],
  },
  templateIcon: {
    fontSize: 40,
    marginBottom: spacing[2],
  },
  templateName: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  templateDescription: {
    ...textStyles.body,
    color: colors.gray[600],
    marginBottom: spacing[2],
    lineHeight: 20,
  },
  templateMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing[2],
  },
  templateCategory: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  reportCard: {
    marginBottom: spacing[3],
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  formatIcon: {
    fontSize: 24,
    marginRight: spacing[2],
  },
  reportInfo: {
    flex: 1,
  },
  reportName: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  reportDate: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginTop: spacing[1],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...textStyles.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  reportDomains: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  domainChip: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  domainChipText: {
    ...textStyles.caption,
    color: colors.gray[700],
    textTransform: 'capitalize',
  },
  fileSize: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginBottom: spacing[2],
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    padding: spacing[2],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  scheduledIcon: {
    fontSize: 16,
    marginRight: spacing[2],
  },
  scheduledText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  reportActions: {
    flexDirection: 'row',
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing[2],
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing[2],
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: {
    ...textStyles.body,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.error + '10',
  },
  deleteButtonText: {
    color: colors.error,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyDescription: {
    ...textStyles.body,
    color: colors.gray[600],
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    paddingTop: spacing[6],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
  },
  cancelButton: {
    ...textStyles.body,
    color: colors.gray[600],
    fontWeight: '600',
  },
  generateButton: {
    ...textStyles.body,
    color: colors.primary,
    fontWeight: '700',
  },
  disabledButton: {
    color: colors.gray[400],
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  builderSection: {
    marginBottom: spacing[3],
  },
  builderSectionTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  optionChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
  },
  optionChipActive: {
    backgroundColor: colors.primary,
  },
  optionChipText: {
    ...textStyles.body,
    color: colors.gray[700],
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: colors.light.primary,
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  domainCard: {
    width: '48%',
    backgroundColor: colors.gray[100],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    position: 'relative',
  },
  domainCardActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  domainIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  domainLabel: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
  },
  selectedCheck: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 20,
    height: 20,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: colors.light.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  formatGrid: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  formatCard: {
    flex: 1,
    backgroundColor: colors.gray[100],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  formatCardActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  formatCardIcon: {
    fontSize: 32,
    marginBottom: spacing[1],
  },
  formatCardText: {
    ...textStyles.caption,
    color: colors.gray[900],
    fontWeight: '600',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  metricIcon: {
    fontSize: 16,
    color: colors.success,
    marginRight: spacing[2],
  },
  metricText: {
    ...textStyles.body,
    color: colors.gray[700],
  },
  bottomPadding: {
    height: spacing[8],
  },
});
