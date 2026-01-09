/**
 * Scenario Lab - PDF Report Renderer
 * Generates executive-quality PDF reports for committed scenarios
 * Using @react-pdf/renderer
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// ============================================================================
// Types
// ============================================================================

interface PDFReportData {
  scenario: {
    name: string;
    description: string | null;
    status: string;
    committed_at: string;
  };
  version: {
    version_number: number;
    name: string;
    created_at: string;
  };
  inputs: Array<{
    field_name: string;
    field_value: any;
    category: string;
    source: string;
  }>;
  simulation: {
    goals: Array<{
      goal_name: string;
      p10: number;
      p50: number;
      p90: number;
      status: string;
      top_drivers: Array<{ field: string; impact: number }>;
      top_risks: Array<{ field: string; impact: number }>;
    }>;
  } | null;
  plan: {
    name: string;
    description: string;
    created_at: string;
  };
  phases: Array<{
    phase_number: number;
    name: string;
    description: string;
    start_date: string | null;
    end_date: string | null;
  }>;
  tasks: Array<{
    phase_number: number;
    task_number: number;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    due_date: string | null;
    estimated_hours: number | null;
    rationale: string | null;
  }>;
  metadata: {
    reportId: string;
    generatedAt: string;
  };
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 30,
    textAlign: 'center',
  },
  coverBadge: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  coverDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 40,
  },
  coverBrand: {
    position: 'absolute',
    bottom: 50,
    fontSize: 10,
    color: '#CCCCCC',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1F2937',
    borderBottom: '2 solid #E5E7EB',
    paddingBottom: 6,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#374151',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#4B5563',
    marginBottom: 6,
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #E5E7EB',
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottom: '2 solid #D1D5DB',
    paddingVertical: 8,
    fontWeight: 'bold',
  },
  tableCell: {
    fontSize: 10,
    padding: 4,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold',
  },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  badgeYellow: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  badgeBlue: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  badgeGray: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
  },
  taskList: {
    marginLeft: 10,
    marginTop: 6,
  },
  taskItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  taskBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6B7280',
    marginTop: 6,
    marginRight: 8,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  taskDesc: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  taskMeta: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9CA3AF',
    borderTop: '1 solid #E5E7EB',
    paddingTop: 10,
  },
  pageNumber: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderLeft: '3 solid #F59E0B',
    padding: 10,
    marginVertical: 10,
  },
  warningText: {
    fontSize: 10,
    color: '#92400E',
  },
});

// ============================================================================
// Component: PDF Document
// ============================================================================

export const ScenarioReportPDF: React.FC<{ data: PDFReportData }> = ({ data }) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadgeStyle = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('ahead') || statusLower.includes('track')) {
      return styles.badgeGreen;
    }
    if (statusLower.includes('behind')) {
      return styles.badgeYellow;
    }
    if (statusLower.includes('risk')) {
      return styles.badgeRed;
    }
    return styles.badgeBlue;
  };

  const getPriorityBadgeStyle = (priority: string) => {
    if (priority === 'P0') return styles.badgeRed;
    if (priority === 'P1') return styles.badgeYellow;
    return styles.badgeBlue;
  };

  const getTaskStatusBadgeStyle = (status: string) => {
    if (status === 'done') return styles.badgeGreen;
    if (status === 'in_progress') return styles.badgeBlue;
    if (status === 'blocked') return styles.badgeRed;
    return styles.badgeGray;
  };

  // Group inputs by category
  const inputsByCategory = data.inputs.reduce((acc, input) => {
    const category = input.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(input);
    return acc;
  }, {} as Record<string, typeof data.inputs>);

  // Group tasks by phase
  const tasksByPhase = data.phases.map((phase) => ({
    phase,
    tasks: data.tasks.filter((t) => t.phase_number === phase.phase_number),
  }));

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.coverTitle}>{data.scenario.name}</Text>
          {data.scenario.description && (
            <Text style={styles.coverSubtitle}>{data.scenario.description}</Text>
          )}
          <View style={styles.coverBadge}>
            <Text>COMMITTED SCENARIO</Text>
          </View>
          <Text style={styles.coverSubtitle}>Decision Snapshot</Text>
          <Text style={styles.coverDate}>
            Generated: {formatDate(data.metadata.generatedAt)}
          </Text>
          <Text style={styles.coverDate}>
            Version {data.version.version_number} • Committed{' '}
            {formatDate(data.scenario.committed_at)}
          </Text>
          <Text style={styles.coverBrand}>LifeNavigator Scenario Lab</Text>
        </View>
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.text}>
            This report captures a committed scenario for {data.scenario.name}, representing
            a decision snapshot in time. The scenario includes {data.inputs.length} approved
            input{data.inputs.length !== 1 ? 's' : ''}, {data.phases.length} planned phase
            {data.phases.length !== 1 ? 's' : ''}, and {data.tasks.length} actionable task
            {data.tasks.length !== 1 ? 's' : ''}.
          </Text>

          {data.simulation && data.simulation.goals.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Primary Goals</Text>
              {data.simulation.goals.map((goal, idx) => (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <Text style={styles.text}>
                    <Text style={{ fontWeight: 'bold' }}>{goal.goal_name}:</Text> P50 outcome{' '}
                    {formatCurrency(goal.p50)} (range: {formatCurrency(goal.p10)} -{' '}
                    {formatCurrency(goal.p90)})
                  </Text>
                  <View style={[styles.badge, getStatusBadgeStyle(goal.status)]}>
                    <Text>{goal.status}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={styles.subsectionTitle}>Timeline</Text>
          <Text style={styles.text}>
            Roadmap spans {data.phases.length} phases, starting{' '}
            {data.phases[0]?.start_date
              ? formatDate(data.phases[0].start_date)
              : 'immediately'}
            .
          </Text>
        </View>

        <Footer reportId={data.metadata.reportId} pageNumber={2} />
      </Page>

      {/* Key Assumptions */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Assumptions</Text>
          <Text style={styles.text}>
            All inputs below have been reviewed and approved by the user. Values are either
            manually entered or extracted from uploaded documents.
          </Text>

          {Object.entries(inputsByCategory).map(([category, inputs]) => (
            <View key={category} style={{ marginTop: 16 }}>
              <Text style={styles.subsectionTitle}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, { width: '35%' }]}>Field</Text>
                  <Text style={[styles.tableCell, { width: '40%' }]}>Value</Text>
                  <Text style={[styles.tableCell, { width: '25%' }]}>Source</Text>
                </View>
                {inputs.map((input, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '35%' }]}>
                      {input.field_name.replace(/_/g, ' ')}
                    </Text>
                    <Text style={[styles.tableCell, { width: '40%' }]}>
                      {formatFieldValue(input.field_value)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '25%', fontSize: 9 }]}>
                      {input.source}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Footer reportId={data.metadata.reportId} pageNumber={3} />
      </Page>

      {/* Outcome Probabilities */}
      {data.simulation && data.simulation.goals.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Outcome Probabilities</Text>
            <Text style={styles.text}>
              Based on Monte Carlo simulation with {data.inputs.length} input variables.
              Probabilities represent likelihood of achieving goals under stated assumptions.
            </Text>

            {data.simulation.goals.map((goal, idx) => (
              <View key={idx} style={{ marginTop: 20, marginBottom: 20 }}>
                <Text style={styles.subsectionTitle}>{goal.goal_name}</Text>

                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCell, { width: '25%' }]}>Percentile</Text>
                    <Text style={[styles.tableCell, { width: '35%' }]}>Outcome</Text>
                    <Text style={[styles.tableCell, { width: '40%' }]}>Status</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '25%' }]}>P10 (Pessimistic)</Text>
                    <Text style={[styles.tableCell, { width: '35%' }]}>
                      {formatCurrency(goal.p10)}
                    </Text>
                    <View style={[styles.badge, getStatusBadgeStyle(goal.status)]}>
                      <Text>{goal.status}</Text>
                    </View>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '25%' }]}>P50 (Expected)</Text>
                    <Text style={[styles.tableCell, { width: '35%', fontWeight: 'bold' }]}>
                      {formatCurrency(goal.p50)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '40%' }]}>-</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '25%' }]}>P90 (Optimistic)</Text>
                    <Text style={[styles.tableCell, { width: '35%' }]}>
                      {formatCurrency(goal.p90)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '40%' }]}>-</Text>
                  </View>
                </View>

                {goal.top_drivers.length > 0 && (
                  <>
                    <Text style={[styles.text, { marginTop: 10, fontWeight: 'bold' }]}>
                      Top Positive Drivers:
                    </Text>
                    {goal.top_drivers.slice(0, 3).map((driver, dIdx) => (
                      <Text key={dIdx} style={[styles.text, { marginLeft: 10 }]}>
                        • {driver.field.replace(/_/g, ' ')} (impact: +
                        {(driver.impact * 100).toFixed(1)}%)
                      </Text>
                    ))}
                  </>
                )}

                {goal.top_risks.length > 0 && (
                  <>
                    <Text style={[styles.text, { marginTop: 10, fontWeight: 'bold' }]}>
                      Top Risks:
                    </Text>
                    {goal.top_risks.slice(0, 3).map((risk, rIdx) => (
                      <Text key={rIdx} style={[styles.text, { marginLeft: 10 }]}>
                        • {risk.field.replace(/_/g, ' ')} (impact:{' '}
                        {(risk.impact * 100).toFixed(1)}%)
                      </Text>
                    ))}
                  </>
                )}
              </View>
            ))}
          </View>

          <Footer reportId={data.metadata.reportId} pageNumber={4} />
        </Page>
      )}

      {/* Roadmap */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roadmap</Text>
          <Text style={styles.text}>
            The following phases and tasks were generated based on your committed scenario.
            Tasks are prioritized and include mitigation steps for identified risks.
          </Text>

          {tasksByPhase.map(({ phase, tasks }) => (
            <View key={phase.phase_number} style={{ marginTop: 20, marginBottom: 20 }} wrap={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#3B82F6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                    {phase.phase_number}
                  </Text>
                </View>
                <Text style={styles.subsectionTitle}>{phase.name}</Text>
              </View>

              <Text style={[styles.text, { marginLeft: 32, marginBottom: 10 }]}>
                {phase.description}
              </Text>

              {phase.start_date && phase.end_date && (
                <Text style={[styles.text, { marginLeft: 32, fontSize: 9, color: '#6B7280' }]}>
                  {formatDate(phase.start_date)} → {formatDate(phase.end_date)}
                </Text>
              )}

              <View style={styles.taskList}>
                {tasks.map((task) => (
                  <View key={task.task_number} style={styles.taskItem}>
                    <View style={styles.taskBullet} />
                    <View style={styles.taskContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <View style={[styles.badge, getPriorityBadgeStyle(task.priority)]}>
                          <Text>{task.priority}</Text>
                        </View>
                        <View style={[styles.badge, getTaskStatusBadgeStyle(task.status)]}>
                          <Text>{task.status.replace('_', ' ')}</Text>
                        </View>
                      </View>
                      <Text style={styles.taskDesc}>{task.description}</Text>
                      {task.rationale && (
                        <Text style={[styles.taskDesc, { fontStyle: 'italic' }]}>
                          Why: {task.rationale}
                        </Text>
                      )}
                      <Text style={styles.taskMeta}>
                        {task.category} • {task.estimated_hours ? `~${task.estimated_hours}h` : ''}
                        {task.due_date ? ` • Due ${formatDate(task.due_date)}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Footer reportId={data.metadata.reportId} pageNumber={5} />
      </Page>

      {/* Risk & Resilience */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk & Resilience Notes</Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ This report reflects a snapshot in time based on assumptions as of{' '}
              {formatDate(data.scenario.committed_at)}. Market conditions, personal
              circumstances, and other factors may change.
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Recommended Safeguards</Text>
          <Text style={styles.text}>
            • Maintain emergency fund (3-6 months expenses)
          </Text>
          <Text style={styles.text}>
            • Review insurance coverage annually (health, life, disability)
          </Text>
          <Text style={styles.text}>
            • Schedule quarterly scenario reviews to update assumptions
          </Text>
          <Text style={styles.text}>
            • Track task progress weekly to stay on roadmap
          </Text>
          <Text style={styles.text}>
            • Reassess if major life events occur (job change, relocation, etc.)
          </Text>

          <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>
            How to Use This Report
          </Text>
          <Text style={styles.text}>
            This report is designed to be shared with trusted advisors, family members, or
            decision-makers who need to understand your planned path. It provides:
          </Text>
          <Text style={styles.text}>
            • A clear record of your assumptions and inputs
          </Text>
          <Text style={styles.text}>
            • Probability-based outcomes to inform risk tolerance
          </Text>
          <Text style={styles.text}>
            • A structured roadmap with actionable next steps
          </Text>
          <Text style={styles.text}>
            • Transparency into key drivers and risks
          </Text>

          <View style={{ marginTop: 30 }}>
            <Text style={[styles.text, { fontSize: 9, color: '#9CA3AF', textAlign: 'center' }]}>
              Report ID: {data.metadata.reportId}
            </Text>
            <Text style={[styles.text, { fontSize: 9, color: '#9CA3AF', textAlign: 'center' }]}>
              Generated by LifeNavigator Scenario Lab
            </Text>
            <Text style={[styles.text, { fontSize: 9, color: '#9CA3AF', textAlign: 'center' }]}>
              {formatDate(data.metadata.generatedAt)}
            </Text>
          </View>
        </View>

        <Footer reportId={data.metadata.reportId} pageNumber={6} />
      </Page>
    </Document>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

const Footer: React.FC<{ reportId: string; pageNumber: number }> = ({
  reportId,
  pageNumber,
}) => (
  <View style={styles.footer}>
    <Text>Report ID: {reportId.slice(0, 8)}</Text>
    <Text>Page {pageNumber}</Text>
  </View>
);

// ============================================================================
// Helper Functions
// ============================================================================

function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // If it looks like currency (large number), format as such
    if (value >= 1000 || value <= -1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toString();
  }
  if (typeof value === 'string') {
    // Check if it's a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleDateString('en-US');
    }
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// ============================================================================
// Export Render Function
// ============================================================================

export async function renderScenarioReportPDF(data: PDFReportData): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const buffer = await renderToBuffer(<ScenarioReportPDF data={data} />);
  return Buffer.from(buffer);
}

export type { PDFReportData };
