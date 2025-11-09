/**
 * Life Navigator - Preventive Care Screen
 *
 * Preventive care reminders and health recommendations
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles, typography } from '../../utils/typography';

interface PreventiveCareTask {
  id: string;
  title: string;
  category: 'checkup' | 'vaccine' | 'screening' | 'dental' | 'vision' | 'other';
  description: string;
  dueDate?: string;
  frequency?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'overdue' | 'scheduled';
  completedDate?: string;
  nextDueDate?: string;
  educationalContent?: {
    title: string;
    description: string;
    learnMoreUrl?: string;
  };
}

interface HealthRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  ageGroup?: string;
  gender?: string;
  priority: 'high' | 'medium' | 'low';
}

type FilterType = 'all' | 'pending' | 'completed' | 'overdue';

export function PreventiveScreen() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<FilterType>('pending');
  const [selectedTask, setSelectedTask] = useState<PreventiveCareTask | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);

  // Fetch preventive care tasks
  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['preventive-care-tasks'],
    queryFn: async () => {
      const response = await api.get<PreventiveCareTask[]>('/api/v1/health/preventive');
      return response;
    },
  });

  // Fetch health recommendations
  const {
    data: recommendations,
    isLoading: recommendationsLoading,
  } = useQuery({
    queryKey: ['health-recommendations'],
    queryFn: async () => {
      const response = await api.get<HealthRecommendation[]>('/api/v1/health/recommendations');
      return response;
    },
  });

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.post(`/api/v1/health/preventive/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-care-tasks'] });
      Alert.alert('Success', 'Task marked as completed');
      setDetailModalVisible(false);
      setSelectedTask(null);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to complete task');
    },
  });

  // Schedule task mutation
  const scheduleMutation = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      return await api.post(`/api/v1/health/preventive/${id}/schedule`, { date });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-care-tasks'] });
      Alert.alert('Success', 'Task scheduled successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to schedule task');
    },
  });

  const categories = [
    { value: 'checkup', label: 'Checkups', icon: '🏥' },
    { value: 'vaccine', label: 'Vaccines', icon: '💉' },
    { value: 'screening', label: 'Screenings', icon: '🔬' },
    { value: 'dental', label: 'Dental', icon: '🦷' },
    { value: 'vision', label: 'Vision', icon: '👁️' },
    { value: 'other', label: 'Other', icon: '📋' },
  ];

  const filterTasks = () => {
    if (!tasks) return [];

    let filtered = tasks;

    switch (filterType) {
      case 'pending':
        filtered = tasks.filter(task => task.status === 'pending' || task.status === 'scheduled');
        break;
      case 'completed':
        filtered = tasks.filter(task => task.status === 'completed');
        break;
      case 'overdue':
        filtered = tasks.filter(task => task.status === 'overdue');
        break;
      default:
        filtered = tasks;
    }

    // Sort by priority and due date
    return filtered.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });
  };

  const getCategoryInfo = (category: PreventiveCareTask['category']) => {
    return categories.find(c => c.value === category) || { icon: '📋', label: category };
  };

  const getPriorityColor = (priority: PreventiveCareTask['priority']) => {
    switch (priority) {
      case 'high':
        return colors.semantic.error;
      case 'medium':
        return colors.semantic.warning;
      case 'low':
        return colors.semantic.info;
      default:
        return colors.gray[500];
    }
  };

  const getStatusInfo = (status: PreventiveCareTask['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: colors.gray[500] };
      case 'completed':
        return { label: 'Completed', color: colors.semantic.success };
      case 'overdue':
        return { label: 'Overdue', color: colors.semantic.error };
      case 'scheduled':
        return { label: 'Scheduled', color: colors.charts.blue };
      default:
        return { label: status, color: colors.gray[500] };
    }
  };

  const handleTaskPress = (task: PreventiveCareTask) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  const handleCompleteTask = (id: string) => {
    Alert.alert(
      'Complete Task',
      'Mark this preventive care task as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => completeMutation.mutate(id) },
      ]
    );
  };

  const handleScheduleTask = (task: PreventiveCareTask) => {
    // In production, show a date picker
    Alert.alert('Schedule Task', `Scheduling: ${task.title} (date picker would appear here)`);
  };

  const renderTaskCard = (task: PreventiveCareTask) => {
    const categoryInfo = getCategoryInfo(task.category);
    const statusInfo = getStatusInfo(task.status);

    return (
      <TouchableOpacity
        key={task.id}
        style={styles.taskCard}
        onPress={() => handleTaskPress(task)}
        activeOpacity={0.7}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskIconContainer}>
            <Text style={styles.taskIcon}>{categoryInfo.icon}</Text>
          </View>
          <View style={styles.taskInfo}>
            <View style={styles.taskTitleRow}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(task.priority) },
                ]}
              >
                <Text style={styles.priorityText}>{task.priority}</Text>
              </View>
            </View>
            <Text style={styles.taskCategory}>{categoryInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.taskDescription} numberOfLines={2}>
          {task.description}
        </Text>

        <View style={styles.taskMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>

          {task.dueDate && (
            <View style={styles.dueDateContainer}>
              <Text style={styles.dueDateLabel}>Due:</Text>
              <Text style={styles.dueDateValue}>
                {new Date(task.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}

          {task.frequency && (
            <Text style={styles.frequency}>🔄 {task.frequency}</Text>
          )}
        </View>

        {task.status !== 'completed' && (
          <View style={styles.taskActions}>
            {task.status !== 'scheduled' && (
              <TouchableOpacity
                style={[styles.taskActionButton, styles.scheduleButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleScheduleTask(task);
                }}
              >
                <Text style={styles.taskActionText}>Schedule</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.taskActionButton, styles.completeButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleCompleteTask(task.id);
              }}
            >
              <Text style={styles.taskActionText}>Complete</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderRecommendation = (recommendation: HealthRecommendation) => {
    return (
      <View key={recommendation.id} style={styles.recommendationCard}>
        <View style={styles.recommendationHeader}>
          <View
            style={[
              styles.recommendationPriority,
              { backgroundColor: getPriorityColor(recommendation.priority) },
            ]}
          />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
            <Text style={styles.recommendationDescription}>{recommendation.description}</Text>
            {recommendation.category && (
              <Text style={styles.recommendationCategory}>{recommendation.category}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>✅</Text>
      <Text style={styles.emptyStateTitle}>All caught up!</Text>
      <Text style={styles.emptyStateText}>
        You have no {filterType} preventive care tasks
      </Text>
    </View>
  );

  if (tasksLoading && !tasks) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.healthcare} />
        <Text style={styles.loadingText}>Loading preventive care...</Text>
      </View>
    );
  }

  if (tasksError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load preventive care</Text>
        <Text style={styles.errorText}>{(tasksError as any).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetchTasks()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredTasks = filterTasks();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Preventive Care</Text>
        <Text style={styles.headerSubtitle}>Stay on top of your health</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['pending', 'overdue', 'completed', 'all'] as FilterType[]).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, filterType === filter && styles.filterTabActive]}
            onPress={() => setFilterType(filter)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === filter && styles.filterTabTextActive,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={tasksLoading}
            onRefresh={refetchTasks}
            tintColor={colors.domains.healthcare}
          />
        }
      >
        {/* Health Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <TouchableOpacity
              style={styles.recommendationsHeader}
              onPress={() => setRecommendationsExpanded(!recommendationsExpanded)}
            >
              <View style={styles.recommendationsTitleRow}>
                <Text style={styles.recommendationsIcon}>💡</Text>
                <Text style={styles.recommendationsTitle}>Health Recommendations</Text>
              </View>
              <Text style={styles.expandIcon}>
                {recommendationsExpanded ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {recommendationsExpanded && (
              <View style={styles.recommendationsList}>
                {recommendations.slice(0, 3).map(renderRecommendation)}
              </View>
            )}
          </View>
        )}

        {/* Tasks List */}
        <View style={styles.tasksSection}>
          <Text style={styles.sectionTitle}>
            {filteredTasks.length} Task{filteredTasks.length !== 1 ? 's' : ''}
          </Text>
          {filteredTasks.length > 0 ? (
            filteredTasks.map(renderTaskCard)
          ) : (
            renderEmptyState()
          )}
        </View>
      </ScrollView>

      {/* Task Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setDetailModalVisible(false);
          setSelectedTask(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTask && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalIcon}>
                      {getCategoryInfo(selectedTask.category).icon}
                    </Text>
                    <View>
                      <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                      <Text style={styles.modalSubtitle}>
                        {getCategoryInfo(selectedTask.category).label}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setDetailModalVisible(false);
                      setSelectedTask(null);
                    }}
                  >
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailDescription}>{selectedTask.description}</Text>

                    <View style={styles.detailMeta}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <View
                          style={[
                            styles.detailStatusBadge,
                            { backgroundColor: getStatusInfo(selectedTask.status).color },
                          ]}
                        >
                          <Text style={styles.detailStatusText}>
                            {getStatusInfo(selectedTask.status).label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Priority</Text>
                        <View
                          style={[
                            styles.detailPriorityBadge,
                            { backgroundColor: getPriorityColor(selectedTask.priority) },
                          ]}
                        >
                          <Text style={styles.detailPriorityText}>
                            {selectedTask.priority}
                          </Text>
                        </View>
                      </View>

                      {selectedTask.dueDate && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Due Date</Text>
                          <Text style={styles.detailValue}>
                            {new Date(selectedTask.dueDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      )}

                      {selectedTask.frequency && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Frequency</Text>
                          <Text style={styles.detailValue}>{selectedTask.frequency}</Text>
                        </View>
                      )}

                      {selectedTask.completedDate && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Completed</Text>
                          <Text style={styles.detailValue}>
                            {new Date(selectedTask.completedDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      )}

                      {selectedTask.nextDueDate && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Next Due</Text>
                          <Text style={styles.detailValue}>
                            {new Date(selectedTask.nextDueDate).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {selectedTask.educationalContent && (
                    <View style={styles.educationalSection}>
                      <Text style={styles.educationalTitle}>
                        {selectedTask.educationalContent.title}
                      </Text>
                      <Text style={styles.educationalDescription}>
                        {selectedTask.educationalContent.description}
                      </Text>
                      {selectedTask.educationalContent.learnMoreUrl && (
                        <TouchableOpacity style={styles.learnMoreButton}>
                          <Text style={styles.learnMoreText}>Learn More →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {selectedTask.status !== 'completed' && (
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.modalActionButton, styles.modalScheduleButton]}
                        onPress={() => handleScheduleTask(selectedTask)}
                      >
                        <Text style={styles.modalActionText}>Schedule</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalActionButton, styles.modalCompleteButton]}
                        onPress={() => handleCompleteTask(selectedTask.id)}
                        disabled={completeMutation.isPending}
                      >
                        {completeMutation.isPending ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.modalActionText}>Complete</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginTop: spacing[4],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.light.secondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  errorTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  errorText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  retryButton: {
    backgroundColor: colors.domains.healthcare,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    ...textStyles.button,
    color: '#FFF',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text.light.primary,
  },
  headerSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: colors.domains.healthcare,
  },
  filterTabText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  filterTabTextActive: {
    color: colors.domains.healthcare,
    fontWeight: typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  recommendationsSection: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    ...shadows.md,
    overflow: 'hidden',
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
  },
  recommendationsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationsIcon: {
    fontSize: 24,
    marginRight: spacing[2],
  },
  recommendationsTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  recommendationsList: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  recommendationCard: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  recommendationHeader: {
    flexDirection: 'row',
  },
  recommendationPriority: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing[3],
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    ...textStyles.body,
    color: colors.text.light.primary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing[1],
  },
  recommendationDescription: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  recommendationCategory: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  tasksSection: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  taskCard: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  taskHeader: {
    flexDirection: 'row',
    marginBottom: spacing[3],
  },
  taskIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  taskIcon: {
    fontSize: 24,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[1],
  },
  taskTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    flex: 1,
    marginRight: spacing[2],
  },
  priorityBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  priorityText: {
    ...textStyles.labelSmall,
    color: '#FFF',
    textTransform: 'uppercase',
  },
  taskCategory: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
  },
  taskDescription: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...textStyles.labelSmall,
    color: '#FFF',
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDateLabel: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
    marginRight: spacing[1],
  },
  dueDateValue: {
    ...textStyles.labelSmall,
    color: colors.text.light.primary,
  },
  frequency: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  taskActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  taskActionButton: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  scheduleButton: {
    backgroundColor: colors.primary.blue,
  },
  completeButton: {
    backgroundColor: colors.semantic.success,
  },
  taskActionText: {
    ...textStyles.buttonSmall,
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[12],
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyStateTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.light,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  modalSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
  },
  modalClose: {
    fontSize: 24,
    color: colors.text.light.secondary,
    fontWeight: typography.weights.bold,
  },
  modalScroll: {
    padding: spacing[4],
  },
  detailSection: {
    marginBottom: spacing[4],
  },
  detailDescription: {
    ...textStyles.body,
    color: colors.text.light.primary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    marginBottom: spacing[4],
  },
  detailMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  detailLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  detailValue: {
    ...textStyles.body,
    color: colors.text.light.primary,
  },
  detailStatusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  detailStatusText: {
    ...textStyles.labelSmall,
    color: '#FFF',
  },
  detailPriorityBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  detailPriorityText: {
    ...textStyles.labelSmall,
    color: '#FFF',
    textTransform: 'uppercase',
  },
  educationalSection: {
    backgroundColor: colors.light.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  educationalTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  educationalDescription: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    marginBottom: spacing[3],
  },
  learnMoreButton: {
    alignSelf: 'flex-start',
  },
  learnMoreText: {
    ...textStyles.label,
    color: colors.primary.blue,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  modalScheduleButton: {
    backgroundColor: colors.primary.blue,
  },
  modalCompleteButton: {
    backgroundColor: colors.semantic.success,
  },
  modalActionText: {
    ...textStyles.button,
    color: '#FFF',
  },
});
