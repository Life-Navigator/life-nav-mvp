'use client';

/**
 * Report Row Component
 * Individual report with status and download link
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';

interface Report {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  report_type: string;
  file_size: number | null;
  page_count: number | null;
  error_text: string | null;
  created_at: string;
  updated_at: string;
  signed_download_url?: string | null;
}

interface ReportRowProps {
  report: Report;
  onRefresh: () => void;
}

export default function ReportRow({ report, onRefresh }: ReportRowProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(
    report.signed_download_url || null
  );
  const [loading, setLoading] = useState(false);

  // Poll for report status if queued or processing
  useEffect(() => {
    if (report.status === 'queued' || report.status === 'processing') {
      const interval = setInterval(() => {
        onRefresh();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [report.status, onRefresh]);

  const handleDownload = async () => {
    if (report.status !== 'completed') return;

    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Fetch fresh signed URL
      const response = await fetch(`/api/scenario-lab/reports/${report.id}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.report.signed_download_url) {
          setDownloadUrl(data.report.signed_download_url);
          // Open in new tab
          window.open(data.report.signed_download_url, '_blank');
        }
      }
    } catch (err) {
      console.error('Error downloading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (report.status) {
      case 'queued':
        return (
          <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 rounded-full">
            Queued
          </span>
        );
      case 'processing':
        return (
          <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            Generating
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
            Ready
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full">
            Failed
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-gray-400 dark:text-gray-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Scenario Report
                </h4>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Generated {formatDate(report.created_at)}
                {report.page_count && ` • ${report.page_count} pages`}
                {report.file_size && ` • ${formatFileSize(report.file_size)}`}
              </p>
              {report.error_text && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Error: {report.error_text}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          {report.status === 'completed' && (
            <button
              onClick={handleDownload}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          )}

          {report.status === 'queued' && (
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Waiting in queue...
            </div>
          )}

          {report.status === 'processing' && (
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Generating PDF...
            </div>
          )}

          {report.status === 'failed' && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
