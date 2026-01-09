'use client';

/**
 * Decisions Tab Component
 * Document upload + OCR + field review
 */

import { useState } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import ExtractedFieldsReview from './ExtractedFieldsReview';

interface DecisionsTabProps {
  scenarioId: string;
  versionId: string | null;
}

export default function DecisionsTab({ scenarioId, versionId }: DecisionsTabProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(null);

  const handleUploadComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleExtractFields = async (documentId: string) => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/scenario-lab/documents/${documentId}/ocr`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(`OCR job enqueued! Job ID: ${data.job_id}. Refresh in a few seconds to see results.`);
        setRefreshKey(prev => prev + 1);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to start OCR');
      }
    } catch (error) {
      console.error('Error starting OCR:', error);
      alert('Failed to start OCR');
    }
  };

  const handleReviewFields = (documentId: string) => {
    setReviewingDocumentId(documentId);
  };

  const handleFieldsApproved = () => {
    setReviewingDocumentId(null);
    setRefreshKey(prev => prev + 1);
    alert('Fields approved! You can now run a simulation to see updated results.');
  };

  if (!versionId) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <p className="text-yellow-800 dark:text-yellow-200">
          No version available. Please create a version first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Decisions
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload documents or add manual inputs. Only approved fields affect simulations.
        </p>
      </div>

      {/* Document Upload */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Upload Document
        </h3>
        <DocumentUpload scenarioId={scenarioId} onUploadComplete={handleUploadComplete} />
      </div>

      {/* Document Library */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Document Library
          </h3>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
        <DocumentList
          key={refreshKey}
          scenarioId={scenarioId}
          onExtractFields={handleExtractFields}
          onReviewFields={handleReviewFields}
        />
      </div>

      {/* Field Review Modal */}
      {reviewingDocumentId && (
        <ExtractedFieldsReview
          documentId={reviewingDocumentId}
          versionId={versionId}
          onClose={() => setReviewingDocumentId(null)}
          onApproved={handleFieldsApproved}
        />
      )}
    </div>
  );
}
