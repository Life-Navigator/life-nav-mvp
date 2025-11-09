/**
 * Life Navigator - Reports Hooks
 *
 * React Query hooks for report generation and management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Report {
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

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  defaultDomains: string[];
  metrics: string[];
}

export interface ReportGenerateRequest {
  name: string;
  type: 'custom' | 'template';
  templateId?: string;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  domains: string[];
  format: 'pdf' | 'csv' | 'json' | 'excel';
  scheduled?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
  };
}

/**
 * Query Keys for cache management
 */
export const reportsKeys = {
  all: ['reports'] as const,
  list: () => [...reportsKeys.all, 'list'] as const,
  templates: () => [...reportsKeys.all, 'templates'] as const,
  detail: (id: string) => [...reportsKeys.all, 'detail', id] as const,
  scheduled: () => [...reportsKeys.all, 'scheduled'] as const,
};

/**
 * Fetch all reports
 */
export const useReports = () => {
  return useQuery<Report[]>({
    queryKey: reportsKeys.list(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });
};

/**
 * Fetch report templates
 */
export const useReportTemplates = () => {
  return useQuery<ReportTemplate[]>({
    queryKey: reportsKeys.templates(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/reports/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });
};

/**
 * Fetch single report
 */
export const useReport = (reportId: string) => {
  return useQuery<Report>({
    queryKey: reportsKeys.detail(reportId),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/reports/${reportId}`);
      if (!response.ok) throw new Error('Failed to fetch report');
      return response.json();
    },
    enabled: !!reportId,
  });
};

/**
 * Fetch scheduled reports
 */
export const useScheduledReports = () => {
  return useQuery<Report[]>({
    queryKey: reportsKeys.scheduled(),
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/reports/scheduled');
      if (!response.ok) throw new Error('Failed to fetch scheduled reports');
      return response.json();
    },
  });
};

/**
 * Generate new report
 */
export const useGenerateReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportRequest: ReportGenerateRequest) => {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportRequest),
      });
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKeys.list() });
    },
  });
};

/**
 * Download report
 */
export const useDownloadReport = () => {
  return useMutation({
    mutationFn: async (reportId: string) => {
      // TODO: Replace with actual API call and file download logic
      const response = await fetch(`/api/v1/reports/${reportId}/download`);
      if (!response.ok) throw new Error('Failed to download report');

      // Get the blob
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'report.pdf';

      // Create download link (for web)
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);

      return { success: true };
    },
  });
};

/**
 * Share report
 */
export const useShareReport = () => {
  return useMutation({
    mutationFn: async ({
      reportId,
      recipients,
      message,
    }: {
      reportId: string;
      recipients: string[];
      message?: string;
    }) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/reports/${reportId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message }),
      });
      if (!response.ok) throw new Error('Failed to share report');
      return response.json();
    },
  });
};

/**
 * Delete report
 */
export const useDeleteReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/reports/${reportId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKeys.list() });
    },
  });
};

/**
 * Update report schedule
 */
export const useUpdateReportSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      schedule,
    }: {
      reportId: string;
      schedule: {
        enabled: boolean;
        frequency: 'daily' | 'weekly' | 'monthly';
      };
    }) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/reports/${reportId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      if (!response.ok) throw new Error('Failed to update schedule');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: reportsKeys.detail(variables.reportId) });
      queryClient.invalidateQueries({ queryKey: reportsKeys.list() });
      queryClient.invalidateQueries({ queryKey: reportsKeys.scheduled() });
    },
  });
};

/**
 * Export report to different format
 */
export const useExportReport = () => {
  return useMutation({
    mutationFn: async ({
      reportId,
      format,
    }: {
      reportId: string;
      format: 'pdf' | 'csv' | 'json' | 'excel';
    }) => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/reports/${reportId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!response.ok) throw new Error('Failed to export report');
      return response.json();
    },
  });
};

/**
 * Get report preview
 */
export const useReportPreview = (reportId: string) => {
  return useQuery({
    queryKey: [...reportsKeys.detail(reportId), 'preview'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/reports/${reportId}/preview`);
      if (!response.ok) throw new Error('Failed to fetch preview');
      return response.json();
    },
    enabled: !!reportId,
  });
};

export default {
  useReports,
  useReportTemplates,
  useReport,
  useScheduledReports,
  useGenerateReport,
  useDownloadReport,
  useShareReport,
  useDeleteReport,
  useUpdateReportSchedule,
  useExportReport,
  useReportPreview,
};
