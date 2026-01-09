'use client';

/**
 * Document Upload Component
 * Handles file selection, upload to Supabase Storage, and document creation
 */

import { useState, useRef } from 'react';
import { getAuthHeaders } from '@/hooks/useAuth';

interface DocumentUploadProps {
  scenarioId: string;
  onUploadComplete: () => void;
}

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function DocumentUpload({ scenarioId, onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`Invalid file type. Allowed: PDF, PNG, JPG, WEBP`);
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      setError(`File too large. Maximum size: 10MB`);
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      setProgress(10);

      const headers = getAuthHeaders();

      // Step 1: Get signed upload URL
      const uploadResponse = await fetch(`/api/scenario-lab/scenarios/${scenarioId}/documents`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          document_type: inferDocumentType(file.name),
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { upload_url, document_id } = await uploadResponse.json();
      setProgress(30);

      // Step 2: Upload file to Supabase Storage using signed URL
      const formData = new FormData();
      formData.append('file', file);

      const storageResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!storageResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      setProgress(100);

      // Success!
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        onUploadComplete();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 500);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  const inferDocumentType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes('bank') || lower.includes('statement')) return 'bank_statement';
    if (lower.includes('pay') || lower.includes('stub') || lower.includes('paystub')) return 'pay_stub';
    if (lower.includes('tuition') || lower.includes('bill')) return 'tuition_bill';
    if (lower.includes('loan')) return 'loan_statement';
    if (lower.includes('insurance')) return 'insurance';
    if (lower.includes('lease') || lower.includes('rent')) return 'lease';
    return 'other';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-8">
      <div className="text-center">
        {/* Upload Icon */}
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {/* Title */}
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          Upload Document
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          PDF, PNG, JPG, or WEBP up to 10MB
        </p>

        {/* Upload Button */}
        <div className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white ${
              uploading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            } transition-colors`}
          >
            {uploading ? 'Uploading...' : 'Choose File'}
          </label>
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{progress}%</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Supported Documents */}
        <div className="mt-6 text-xs text-gray-500 dark:text-gray-500">
          <p className="font-medium mb-1">Supported documents:</p>
          <p>Bank statements, pay stubs, tuition bills, loan statements, etc.</p>
        </div>
      </div>
    </div>
  );
}
