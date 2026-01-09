'use client';

/**
 * Document List Component
 * Shows uploaded documents with status and actions
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  document_type: string;
  ocr_status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
  ocr_job_id: string | null;
}

interface DocumentListProps {
  scenarioId: string;
  onRefresh?: () => void;
  onExtractFields: (documentId: string) => void;
  onReviewFields: (documentId: string) => void;
}

export default function DocumentList({
  scenarioId,
  onRefresh,
  onExtractFields,
  onReviewFields,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [scenarioId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/scenario-lab/scenarios/${scenarioId}/documents`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', label: 'Uploaded' },
      queued: { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Queued' },
      processing: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', label: 'Processing' },
      completed: { bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Ready' },
      failed: { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Failed' },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex items-start justify-between">
            {/* Document Info */}
            <div className="flex items-start gap-3 flex-1">
              {/* File Icon */}
              <div className="flex-shrink-0">
                {doc.file_type === 'pdf' ? (
                  <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatFileSize(doc.file_size_bytes)} • {doc.document_type.replace('_', ' ')}
                </p>
                <div className="mt-2">{getStatusBadge(doc.ocr_status)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 ml-4">
              {doc.ocr_status === 'pending' && (
                <button
                  onClick={() => onExtractFields(doc.id)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  Extract Fields
                </button>
              )}

              {doc.ocr_status === 'completed' && (
                <button
                  onClick={() => onReviewFields(doc.id)}
                  className="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                >
                  Review Fields
                </button>
              )}

              {(doc.ocr_status === 'queued' || doc.ocr_status === 'processing') && (
                <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-500">
                  Processing...
                </div>
              )}

              {doc.ocr_status === 'failed' && (
                <button
                  onClick={() => onExtractFields(doc.id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
