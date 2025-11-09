/**
 * Life Navigator - Analytics API
 *
 * API service for analytics dashboard data
 */

import { api } from './client';
import { AnalyticsDashboardData } from '../types/analytics';

export interface AnalyticsParams {
  startDate?: string;
  endDate?: string;
  domains?: string[];
}

/**
 * Fetch analytics dashboard data
 */
export const getAnalyticsDashboard = async (
  params?: AnalyticsParams
): Promise<AnalyticsDashboardData> => {
  return api.get<AnalyticsDashboardData>('/api/v1/analytics/dashboard', {
    params,
  });
};

/**
 * Fetch domain-specific analytics
 */
export const getDomainAnalytics = async (
  domain: string,
  params?: AnalyticsParams
) => {
  return api.get(`/api/v1/analytics/domains/${domain}`, {
    params,
  });
};

/**
 * Fetch trend data for specific period
 */
export const getTrendData = async (period: 'week' | 'month' | 'quarter' | 'year') => {
  return api.get(`/api/v1/analytics/trends`, {
    params: { period },
  });
};

/**
 * Fetch predictive analytics
 */
export const getPredictiveAnalytics = async (domain?: string) => {
  return api.get('/api/v1/analytics/predictions', {
    params: domain ? { domain } : undefined,
  });
};

/**
 * Export analytics to PDF
 */
export const exportAnalyticsPDF = async (params?: AnalyticsParams) => {
  return api.post('/api/v1/analytics/export/pdf', params, {
    responseType: 'blob',
  });
};

/**
 * Export analytics to CSV
 */
export const exportAnalyticsCSV = async (params?: AnalyticsParams) => {
  return api.post('/api/v1/analytics/export/csv', params, {
    responseType: 'blob',
  });
};

/**
 * Schedule analytics report
 */
export interface ScheduleReportParams {
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv';
  email?: string;
  domains?: string[];
}

export const scheduleReport = async (params: ScheduleReportParams) => {
  return api.post('/api/v1/analytics/reports/schedule', params);
};
