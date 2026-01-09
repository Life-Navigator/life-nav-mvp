'use client';

/**
 * Extracted Fields Review Component
 * Shows extracted fields grouped by category with approval UI
 */

import { useState, useEffect } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';

interface ExtractedField {
  id: string;
  field_key: string;
  field_value: string;
  field_type: string;
  confidence_score: number;
  source_page: number | null;
  source_text: string | null;
  was_redacted: boolean;
  redaction_reason: string | null;
}

interface FieldGroup {
  category: string;
  fields: ExtractedField[];
}

interface FieldApproval {
  extracted_field_id: string;
  goal_id: string;
  field_name: string;
  approved_value?: string;
}

interface ExtractedFieldsReviewProps {
  documentId: string;
  versionId: string;
  onClose: () => void;
  onApproved: () => void;
}

export default function ExtractedFieldsReview({
  documentId,
  versionId,
  onClose,
  onApproved,
}: ExtractedFieldsReviewProps) {
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [editedValues, setEditedValues] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchFields();
  }, [documentId]);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/scenario-lab/documents/${documentId}/fields`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error fetching fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (fieldId: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFields(newSelected);
  };

  const updateFieldValue = (fieldId: string, value: string) => {
    const newEdited = new Map(editedValues);
    newEdited.set(fieldId, value);
    setEditedValues(newEdited);
  };

  const handleApprove = async () => {
    if (selectedFields.size === 0) {
      alert('Please select at least one field to approve');
      return;
    }

    try {
      setApproving(true);

      // Build approvals array
      const approvals: FieldApproval[] = [];

      for (const group of groups) {
        for (const field of group.fields) {
          if (selectedFields.has(field.id)) {
            approvals.push({
              extracted_field_id: field.id,
              goal_id: 'default', // In a real implementation, user would select goal
              field_name: field.field_key,
              approved_value: editedValues.get(field.id) || undefined,
            });
          }
        }
      }

      const headers = getAuthHeaders();
      const response = await fetch(
        `/api/scenario-lab/versions/${versionId}/fields/approve`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields: approvals }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(`${data.inputs_created} fields approved and added to scenario!`);
        onApproved();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to approve fields');
      }
    } catch (error) {
      console.error('Error approving fields:', error);
      alert('Failed to approve fields');
    } finally {
      setApproving(false);
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded">High</span>;
    }
    if (score >= 0.6) {
      return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded">Medium</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 rounded">Low</span>;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading fields...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Review Extracted Fields
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Select fields to approve. Only approved fields affect simulations.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {groups.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">No fields extracted</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.category}>
                  {/* Category Header */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {group.category}
                  </h3>

                  {/* Fields */}
                  <div className="space-y-3">
                    {group.fields.map((field) => (
                      <div
                        key={field.id}
                        className={`border rounded-lg p-4 ${
                          selectedFields.has(field.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedFields.has(field.id)}
                            onChange={() => toggleField(field.id)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                          />

                          <div className="flex-1">
                            {/* Field Key */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {field.field_key.replace(/_/g, ' ')}
                              </span>
                              {getConfidenceBadge(field.confidence_score)}
                              {field.was_redacted && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded">
                                  Redacted
                                </span>
                              )}
                            </div>

                            {/* Field Value (Editable) */}
                            <input
                              type="text"
                              value={editedValues.get(field.id) || field.field_value}
                              onChange={(e) => updateFieldValue(field.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />

                            {/* Source Context */}
                            {field.source_text && (
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                <span className="font-medium">Source{field.source_page ? ` (page ${field.source_page})` : ''}:</span>{' '}
                                {field.source_text}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || selectedFields.size === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approving ? 'Approving...' : `Approve ${selectedFields.size} Field${selectedFields.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
