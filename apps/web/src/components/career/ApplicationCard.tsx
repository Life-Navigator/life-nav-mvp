"use client";

import React, { useState } from 'react';
import { JobApplicationTracking } from '@/types/career';
import { useTrackJobApplication } from '@/hooks/useCareer';

interface ApplicationCardProps {
  application: JobApplicationTracking & {
    id?: string;
    jobTitle?: string;
    company?: string;
  };
  onUpdate?: () => void;
}

const statusOptions = [
  { value: 'applied', label: 'Applied', color: 'bg-blue-100 text-blue-700' },
  { value: 'screening', label: 'Screening', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'interviewing', label: 'Interviewing', color: 'bg-purple-100 text-purple-700' },
  { value: 'offered', label: 'Offered', color: 'bg-green-100 text-green-700' },
  { value: 'accepted', label: 'Accepted', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'declined', label: 'Declined', color: 'bg-gray-100 text-gray-700' },
];

export default function ApplicationCard({ application, onUpdate }: ApplicationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(application.notes || '');
  const trackMutation = useTrackJobApplication();

  const currentStatus = statusOptions.find(s => s.value === application.status);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await trackMutation.mutateAsync({
        ...application,
        status: newStatus as any,
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await trackMutation.mutateAsync({
        ...application,
        notes,
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusProgress = () => {
    const statusIndex = statusOptions.findIndex(s => s.value === application.status);
    return ((statusIndex + 1) / statusOptions.length) * 100;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {application.jobTitle || 'Job Application'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {application.company || 'Company'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Applied on {formatDate(application.appliedDate)}
          </p>
        </div>

        {/* Platform Badge */}
        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-full text-xs font-medium">
          {application.platform.charAt(0).toUpperCase() + application.platform.slice(1)}
        </span>
      </div>

      {/* Status Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Application Status
        </label>
        <select
          value={application.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={trackMutation.isPending}
          className={`w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${currentStatus?.color}`}
        >
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>{Math.round(getStatusProgress())}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              application.status === 'rejected' || application.status === 'declined'
                ? 'bg-red-500'
                : application.status === 'accepted'
                ? 'bg-green-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${getStatusProgress()}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {statusOptions.slice(0, -2).map((status, index) => {
            const isActive = statusOptions.findIndex(s => s.value === application.status) >= index;
            return (
              <div key={status.value} className="flex items-center min-w-fit">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < statusOptions.slice(0, -2).length - 1 && (
                  <div
                    className={`w-8 h-1 ${
                      isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto text-xs text-gray-600 dark:text-gray-400 mt-1">
          {statusOptions.slice(0, -2).map((status, index) => (
            <div key={status.value} className="flex items-center min-w-fit">
              <span className="w-8 text-center">{status.label.split(' ')[0]}</span>
              {index < statusOptions.slice(0, -2).length - 1 && <div className="w-8" />}
            </div>
          ))}
        </div>
      </div>

      {/* Notes Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Notes
          </label>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              Edit
            </button>
          )}
        </div>
        {isEditing ? (
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Add notes about this application..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveNotes}
                disabled={trackMutation.isPending}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setNotes(application.notes || '');
                }}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {application.notes || 'No notes added yet.'}
          </p>
        )}
      </div>

      {/* Additional Info */}
      {(application.resumeVersion || application.coverLetter) && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
            {application.resumeVersion && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Resume: {application.resumeVersion}</span>
              </div>
            )}
            {application.coverLetter && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Cover Letter Attached</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
