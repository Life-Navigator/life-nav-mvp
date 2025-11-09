/**
 * Life Navigator - Opportunities Screen
 *
 * Comprehensive job board and freelance platform integrations
 * Features: Jobs from LinkedIn/Indeed, Gigs from Upwork/Fiverr/Freelancer,
 * Application tracking, and Market insights
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import {
  useAllJobs,
  useRecommendedJobs,
  useAllGigs,
  useRecommendedGigs,
  useJobApplications,
  useApplicationStats,
  useJobMarketInsights,
  useSaveJob,
  useSaveGig,
} from '../../hooks/useCareer';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatDate } from '../../utils/formatters';

type Tab = 'jobs' | 'gigs' | 'applications' | 'insights';

export function OpportunitiesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [refreshing, setRefreshing] = useState(false);

  // Job filters
  const [jobFilters, setJobFilters] = useState({
    platform: 'all',
    sortBy: 'relevance',
    page: 1,
    limit: 20,
  });

  // Gig filters
  const [gigFilters, setGigFilters] = useState({
    platform: 'all',
    sortBy: 'relevance',
    page: 1,
    limit: 20,
  });

  // Fetch data
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useAllJobs(jobFilters);
  const { data: recommendedJobsData } = useRecommendedJobs();
  const { data: gigsData, isLoading: gigsLoading, refetch: refetchGigs } = useAllGigs(gigFilters);
  const { data: recommendedGigsData } = useRecommendedGigs();
  const { data: applications, refetch: refetchApplications } = useJobApplications();
  const { data: appStats } = useApplicationStats();
  const { data: marketInsights } = useJobMarketInsights();

  const saveJobMutation = useSaveJob();
  const saveGigMutation = useSaveGig();

  const tabs = [
    { id: 'jobs' as Tab, label: 'Jobs', icon: '💼' },
    { id: 'gigs' as Tab, label: 'Gigs', icon: '🚀' },
    { id: 'applications' as Tab, label: 'Tracker', icon: '📊' },
    { id: 'insights' as Tab, label: 'Insights', icon: '📈' },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'jobs') await refetchJobs();
      else if (activeTab === 'gigs') await refetchGigs();
      else if (activeTab === 'applications') await refetchApplications();
    } finally {
      setRefreshing(false);
    }
  };

  const getMatchScoreColor = (score?: number) => {
    if (!score) return colors.gray[400];
    if (score >= 70) return colors.semantic.success;
    if (score >= 50) return colors.charts.yellow;
    return colors.gray[400];
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'linkedin': return colors.charts.blue;
      case 'indeed': return colors.charts.indigo;
      case 'upwork': return colors.semantic.success;
      case 'fiverr': return colors.charts.green;
      case 'freelancer': return colors.charts.blue;
      default: return colors.gray[500];
    }
  };

  const renderJobCard = ({ item: job }: any) => (
    <TouchableOpacity style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>{job.title}</Text>
          <Text style={styles.cardCompany}>{job.company}</Text>
        </View>
        {job.matchScore !== undefined && (
          <View style={[styles.matchBadge, { backgroundColor: getMatchScoreColor(job.matchScore) + '20' }]}>
            <Text style={[styles.matchText, { color: getMatchScoreColor(job.matchScore) }]}>
              {job.matchScore}%
            </Text>
          </View>
        )}
      </View>

      {/* Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: getPlatformColor(job.platform) }]}>
          <Text style={styles.badgeText}>{job.platform}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{job.employmentType}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{job.locationType}</Text>
        </View>
      </View>

      {/* Location and Salary */}
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>{job.location}</Text>
        {job.salaryRange && (
          <Text style={styles.salaryText}>
            {job.salaryRange.currency}{job.salaryRange.min.toLocaleString()} -
            {job.salaryRange.currency}{job.salaryRange.max.toLocaleString()}
          </Text>
        )}
      </View>

      {/* Skills */}
      {job.skills && job.skills.length > 0 && (
        <View style={styles.skillsRow}>
          {job.skills.slice(0, 3).map((skill: string, index: number) => (
            <View key={index} style={styles.skillTag}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
          {job.skills.length > 3 && (
            <Text style={styles.moreText}>+{job.skills.length - 3} more</Text>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>{formatDate(job.postedDate)}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => saveJobMutation.mutate({ jobId: job.id, platform: job.platform })}
          >
            <Text style={styles.iconText}>{job.isSaved ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderGigCard = ({ item: gig }: any) => (
    <TouchableOpacity style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>{gig.title}</Text>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{gig.client.name}</Text>
            {gig.client.rating && (
              <Text style={styles.rating}>⭐ {gig.client.rating.toFixed(1)}</Text>
            )}
          </View>
        </View>
        {gig.matchScore !== undefined && (
          <View style={[styles.matchBadge, { backgroundColor: getMatchScoreColor(gig.matchScore) + '20' }]}>
            <Text style={[styles.matchText, { color: getMatchScoreColor(gig.matchScore) }]}>
              {gig.matchScore}%
            </Text>
          </View>
        )}
      </View>

      {/* Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: getPlatformColor(gig.platform) }]}>
          <Text style={styles.badgeText}>{gig.platform}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{gig.category}</Text>
        </View>
        {gig.budget && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{gig.budget.type}</Text>
          </View>
        )}
      </View>

      {/* Budget */}
      {gig.budget && (
        <View style={styles.infoRow}>
          <Text style={styles.budgetText}>
            {gig.budget.type === 'fixed'
              ? `${gig.budget.currency}${gig.budget.amount?.toLocaleString()} (Fixed)`
              : `${gig.budget.currency}${gig.budget.hourlyRate?.min}-${gig.budget.currency}${gig.budget.hourlyRate?.max}/hr`
            }
          </Text>
          {gig.proposals !== undefined && (
            <Text style={styles.proposalsText}>{gig.proposals} proposals</Text>
          )}
        </View>
      )}

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>{gig.description}</Text>

      {/* Skills */}
      {gig.skills && gig.skills.length > 0 && (
        <View style={styles.skillsRow}>
          {gig.skills.slice(0, 3).map((skill: string, index: number) => (
            <View key={index} style={styles.skillTag}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
          {gig.skills.length > 3 && (
            <Text style={styles.moreText}>+{gig.skills.length - 3} more</Text>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>{formatDate(gig.postedDate)}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => saveGigMutation.mutate({ gigId: gig.id, platform: gig.platform })}
          >
            <Text style={styles.iconText}>{gig.isSaved ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Propose</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderApplicationCard = ({ item: app }: any) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>{app.jobTitle}</Text>
          <Text style={styles.cardCompany}>{app.company}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getPlatformColor(app.status) }]}>
          <Text style={styles.badgeText}>{app.status}</Text>
        </View>
      </View>
      <Text style={styles.footerText}>Applied: {formatDate(app.appliedDate)}</Text>
      {app.notes && (
        <Text style={styles.notes} numberOfLines={2}>{app.notes}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Career Opportunities</Text>
        <Text style={styles.subtitle}>Jobs, gigs, and applications</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <>
            {recommendedJobsData && recommendedJobsData.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended for You</Text>
                <FlatList
                  data={recommendedJobsData.slice(0, 3)}
                  renderItem={renderJobCard}
                  keyExtractor={(item: any) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Jobs</Text>
              {jobsLoading ? (
                <ActivityIndicator size="large" color={colors.domains.career} />
              ) : jobsData?.jobs && jobsData.jobs.length > 0 ? (
                <FlatList
                  data={jobsData.jobs}
                  renderItem={renderJobCard}
                  keyExtractor={(item: any) => item.id}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No jobs found</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Gigs Tab */}
        {activeTab === 'gigs' && (
          <>
            {recommendedGigsData && recommendedGigsData.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended for You</Text>
                <FlatList
                  data={recommendedGigsData.slice(0, 3)}
                  renderItem={renderGigCard}
                  keyExtractor={(item: any) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Gigs</Text>
              {gigsLoading ? (
                <ActivityIndicator size="large" color={colors.domains.career} />
              ) : gigsData?.gigs && gigsData.gigs.length > 0 ? (
                <FlatList
                  data={gigsData.gigs}
                  renderItem={renderGigCard}
                  keyExtractor={(item: any) => item.id}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No gigs found</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <>
            {appStats && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{appStats.totalApplications}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{appStats.interviewing}</Text>
                  <Text style={styles.statLabel}>Interviewing</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{appStats.offered}</Text>
                  <Text style={styles.statLabel}>Offers</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{appStats.responseRate}%</Text>
                  <Text style={styles.statLabel}>Response</Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Applications</Text>
              {applications && applications.length > 0 ? (
                <FlatList
                  data={applications}
                  renderItem={renderApplicationCard}
                  keyExtractor={(item: any) => item.id}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No applications yet</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <>
            {marketInsights?.trendingSkills && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trending Skills</Text>
                {marketInsights.trendingSkills.map((skill: any, index: number) => (
                  <View key={index} style={styles.insightCard}>
                    <View style={styles.insightLeft}>
                      <Text style={styles.insightTitle}>{skill.skill}</Text>
                      <Text style={styles.insightSubtitle}>{skill.demand} jobs</Text>
                    </View>
                    <Text style={[styles.growthText, { color: skill.growth > 0 ? colors.semantic.success : colors.semantic.error }]}>
                      {skill.growth > 0 ? '+' : ''}{skill.growth}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {marketInsights?.averageSalaries && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Average Salaries</Text>
                {marketInsights.averageSalaries.map((item: any, index: number) => (
                  <View key={index} style={styles.insightCard}>
                    <Text style={styles.insightTitle}>{item.role}</Text>
                    <Text style={styles.salaryText}>
                      {item.currency}{item.salary.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  header: {
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    paddingHorizontal: spacing[2],
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.domains.career,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: spacing[1],
  },
  tabLabel: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  tabLabelActive: {
    color: colors.domains.career,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  card: {
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing[2],
  },
  cardTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  cardCompany: {
    ...textStyles.body,
    color: colors.text.light.secondary,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  clientName: {
    ...textStyles.body,
    color: colors.text.light.secondary,
  },
  rating: {
    ...textStyles.bodySmall,
    color: colors.charts.yellow,
  },
  matchBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  matchText: {
    ...textStyles.label,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  badge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...textStyles.caption,
    color: colors.text.light.inverse,
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  infoText: {
    ...textStyles.bodySmall,
    color: colors.text.light.tertiary,
  },
  salaryText: {
    ...textStyles.body,
    color: colors.semantic.success,
    fontWeight: '600',
  },
  budgetText: {
    ...textStyles.body,
    color: colors.domains.career,
    fontWeight: '600',
  },
  proposalsText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  description: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  skillTag: {
    backgroundColor: colors.light.tertiary,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  skillText: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  moreText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  footerText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  iconButton: {
    padding: spacing[2],
  },
  iconText: {
    fontSize: 20,
  },
  applyButton: {
    backgroundColor: colors.domains.career,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  applyButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  notes: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    fontStyle: 'italic',
    marginTop: spacing[2],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyText: {
    ...textStyles.body,
    color: colors.text.light.tertiary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    padding: spacing[4],
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...textStyles.h3,
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  insightCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  insightLeft: {
    flex: 1,
  },
  insightTitle: {
    ...textStyles.body,
    color: colors.text.light.primary,
    fontWeight: '600',
    marginBottom: spacing[1],
  },
  insightSubtitle: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  growthText: {
    ...textStyles.body,
    fontWeight: '600',
  },
});

export default OpportunitiesScreen;
