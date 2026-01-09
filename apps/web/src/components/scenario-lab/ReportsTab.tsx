'use client';

/**
 * Reports Tab Component
 * Shows report generation history and download links
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';
import ReportRow from './ReportRow';

interface Report {
  id: string;
  scenario_id: string;
  version_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  report_type: string;
  file_size: number | null;
  page_count: number | null;
  error_text: string | null;
  created_at: string;
  updated_at: string;
  signed_download_url?: string | null;
}

interface ReportsTabProps {
  scenarioId: string;
  versionId: string | null;
  scenarioStatus: string;
}

export default function ReportsTab({
  scenarioId,
  versionId,
  scenarioStatus,
}: ReportsTabProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scenarioId) {
      fetchReports();
    }
  }, [scenarioId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Fetch reports for this scenario
      const response = await fetch(`/api/scenario-lab/scenarios/${scenarioId}/reports`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        console.error('Failed to fetch reports');
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!versionId) {
      setError('No version available');
      return;
    }

    if (scenarioStatus !== 'committed') {
      setError('PDF reports can only be generated for committed scenarios');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const headers = getAuthHeaders();
      const response = await fetch('/api/scenario-lab/reports/generate', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId,
          versionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Report generation queued! Report ID: ${data.reportId}`);
        fetchReports(); // Reload reports
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate report');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              PDF Reports
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Generate and download PDF reports for this scenario.
            </p>
          </div>
          <div>
            {scenarioStatus === 'committed' ? (
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-500 text-right">
                Commit scenario to generate reports
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Note:</strong> Reports are immutable snapshots. Each generation creates
            a new report with current data. You can generate up to 10 reports per day.
          </p>
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <div className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600 mb-4">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Reports Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Generate your first PDF report to share with advisors, family, or decision-makers.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} onRefresh={fetchReports} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
