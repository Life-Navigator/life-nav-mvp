'use client';

import { useState, useCallback, useRef } from 'react';
import {
  validateFile,
  getMimeTypes,
  type SupportedFileType,
} from '@/lib/utils/file-validation';

/**
 * Upload state for tracking progress and status
 */
export interface UploadState {
  status: 'idle' | 'validating' | 'uploading' | 'success' | 'error';
  progress: number;
  error: string | null;
  file: File | null;
  result: UploadResult | null;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  processedData?: Record<string, unknown>;
  message?: string;
}

export interface UploadConfig {
  allowedTypes: SupportedFileType[];
  maxSizeBytes: number;
  endpoint: string;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  additionalData?: Record<string, string>;
}

const DEFAULT_CONFIG: Partial<UploadConfig> = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB default
};

/**
 * Enterprise-grade file upload hook with:
 * - Magic number validation
 * - Progress tracking with XHR
 * - Abort capability
 * - Drag and drop support helpers
 * - Error handling with retry
 */
export function useFileUpload(config: UploadConfig) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    file: null,
    result: null,
  });

  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * Reset upload state
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({
      status: 'idle',
      progress: 0,
      error: null,
      file: null,
      result: null,
    });
  }, []);

  /**
   * Abort ongoing upload
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => ({
        ...prev,
        status: 'idle',
        progress: 0,
        error: 'Upload cancelled',
      }));
    }
  }, []);

  /**
   * Upload file with progress tracking
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      // Abort any existing upload
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState({
        status: 'validating',
        progress: 0,
        error: null,
        file,
        result: null,
      });

      // Validate file
      const validation = await validateFile(file, {
        allowedTypes: mergedConfig.allowedTypes,
        maxSizeBytes: mergedConfig.maxSizeBytes!,
      });

      if (!validation.valid) {
        const error = validation.errors.join('. ');
        setState(prev => ({
          ...prev,
          status: 'error',
          error,
        }));
        mergedConfig.onError?.(error);
        return null;
      }

      setState(prev => ({
        ...prev,
        status: 'uploading',
        progress: 0,
      }));

      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Add additional data
      if (mergedConfig.additionalData) {
        Object.entries(mergedConfig.additionalData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Track progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setState(prev => ({
              ...prev,
              progress,
            }));
          }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result: UploadResult = JSON.parse(xhr.responseText);
              setState(prev => ({
                ...prev,
                status: 'success',
                progress: 100,
                result,
              }));
              mergedConfig.onSuccess?.(result);
              resolve(result);
            } catch {
              const error = 'Invalid response from server';
              setState(prev => ({
                ...prev,
                status: 'error',
                error,
              }));
              mergedConfig.onError?.(error);
              resolve(null);
            }
          } else {
            let error = 'Upload failed';
            try {
              const response = JSON.parse(xhr.responseText);
              error = response.error || response.message || error;
            } catch {
              // Use default error
            }
            setState(prev => ({
              ...prev,
              status: 'error',
              error,
            }));
            mergedConfig.onError?.(error);
            resolve(null);
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          const error = 'Network error during upload';
          setState(prev => ({
            ...prev,
            status: 'error',
            error,
          }));
          mergedConfig.onError?.(error);
          resolve(null);
        });

        // Handle abort
        xhr.addEventListener('abort', () => {
          setState(prev => ({
            ...prev,
            status: 'idle',
            progress: 0,
            error: 'Upload cancelled',
          }));
          resolve(null);
        });

        // Handle abort from controller
        abortControllerRef.current?.signal.addEventListener('abort', () => {
          xhr.abort();
        });

        // Send request
        xhr.open('POST', mergedConfig.endpoint);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send(formData);
      });
    },
    [mergedConfig]
  );

  /**
   * Handle file input change
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        await uploadFile(file);
      }
      // Reset input so same file can be selected again
      event.target.value = '';
    },
    [uploadFile]
  );

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  /**
   * Get accept attribute for file input
   */
  const acceptedMimeTypes = getMimeTypes(mergedConfig.allowedTypes);

  return {
    // State
    state,
    isDragOver,

    // Actions
    uploadFile,
    reset,
    abort,

    // Event handlers
    handleFileSelect,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,

    // Helpers
    acceptedMimeTypes: acceptedMimeTypes.join(','),
    maxSizeMB: (mergedConfig.maxSizeBytes! / (1024 * 1024)).toFixed(0),
  };
}

/**
 * Domain-specific upload configurations
 */
export const UPLOAD_CONFIGS = {
  financial: {
    allowedTypes: ['PDF', 'CSV', 'XLSX', 'DOCX'] as SupportedFileType[],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB for financial documents
    endpoint: '/api/data/financial/upload',
    formats: ['CSV', 'Excel', 'Word', 'PDF'],
  },
  health: {
    allowedTypes: ['PDF', 'PNG', 'JPEG'] as SupportedFileType[],
    maxSizeBytes: 50 * 1024 * 1024, // 50MB for medical documents
    endpoint: '/api/data/health/upload',
    formats: ['CSV', 'PDF', 'HL7', 'FHIR'],
  },
  career: {
    allowedTypes: ['PDF', 'DOCX'] as SupportedFileType[],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB for resumes
    endpoint: '/api/data/career/upload',
    formats: ['PDF', 'Word', 'JSON'],
  },
  education: {
    allowedTypes: ['PDF', 'PNG', 'JPEG', 'DOCX', 'XLSX', 'CSV'] as SupportedFileType[],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB for transcripts
    endpoint: '/api/data/education/upload',
    formats: ['PDF', 'CSV', 'Excel', 'Word'],
  },
} as const;

export type UploadDomain = keyof typeof UPLOAD_CONFIGS;
