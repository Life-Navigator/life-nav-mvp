'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'manual' | 'upload' | 'credly';

export default function AddEducationDataPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual entry form state
  const [record, setRecord] = useState({
    institution: '',
    degree_type: 'bachelors',
    field_of_study: '',
    gpa: '',
    start_date: '',
    end_date: '',
    status: 'in_progress',
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null);

  // Credly state
  const [credlyUsername, setCredlyUsername] = useState('');
  const [syncResult, setSyncResult] = useState<{ total: number; synced: number } | null>(null);

  if (!isAuthenticated) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/education/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...record,
          gpa: record.gpa ? Number(record.gpa) : null,
          start_date: record.start_date || null,
          end_date: record.end_date || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save record');
      setMessage({ type: 'success', text: 'Education record saved!' });
      setRecord({
        institution: '',
        degree_type: 'bachelors',
        field_of_study: '',
        gpa: '',
        start_date: '',
        end_date: '',
        status: 'in_progress',
      });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    setUploadProgress('uploading');
    setMessage(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await fetch('/api/data/education/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setExtractedData(data.processedData);
      setUploadProgress('done');
      setMessage({ type: 'success', text: data.message });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
      setUploadProgress('idle');
    }
  };

  const handleCredlyConnect = async () => {
    if (!credlyUsername.trim()) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const connectRes = await fetch('/api/integrations/credly/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: credlyUsername.trim() }),
      });

      if (!connectRes.ok) {
        const err = await connectRes.json();
        throw new Error(err.error || 'Failed to connect');
      }

      const syncRes = await fetch('/api/integrations/credly/sync', { method: 'POST' });
      if (!syncRes.ok) throw new Error('Sync failed');
      const data = await syncRes.json();
      setSyncResult({ total: data.total, synced: data.synced });
      setMessage({ type: 'success', text: `Synced ${data.synced} new certifications from Credly` });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'manual' as const, label: 'Manual Input' },
    { id: 'upload' as const, label: 'Document Upload' },
    { id: 'credly' as const, label: 'Credly Import' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          &larr; Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Add Education Data
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Choose how you want to add your education information
        </p>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {/* Manual Input Tab */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Institution *
                </label>
                <input
                  type="text"
                  required
                  value={record.institution}
                  onChange={(e) => setRecord({ ...record, institution: e.target.value })}
                  placeholder="e.g., MIT, Stanford University"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Degree Type
                  </label>
                  <select
                    value={record.degree_type}
                    onChange={(e) => setRecord({ ...record, degree_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="high_school">High School</option>
                    <option value="associate">Associate</option>
                    <option value="bachelors">Bachelor&apos;s</option>
                    <option value="masters">Master&apos;s</option>
                    <option value="doctorate">Doctorate</option>
                    <option value="certificate">Certificate</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field of Study
                  </label>
                  <input
                    type="text"
                    value={record.field_of_study}
                    onChange={(e) => setRecord({ ...record, field_of_study: e.target.value })}
                    placeholder="e.g., Computer Science"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={record.gpa}
                    onChange={(e) => setRecord({ ...record, gpa: e.target.value })}
                    placeholder="e.g., 3.8"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={record.start_date}
                    onChange={(e) => setRecord({ ...record, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={record.end_date}
                    onChange={(e) => setRecord({ ...record, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={record.status}
                  onChange={(e) => setRecord({ ...record, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Education Record'}
              </button>
            </form>
          )}

          {/* Document Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload transcripts, diplomas, or certificates (PDF, DOCX, images). OCR will extract
                key information.
              </p>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
                    setUploadProgress('idle');
                    setExtractedData(null);
                  }}
                  className="hidden"
                  id="education-file-input"
                />
                <label
                  htmlFor="education-file-input"
                  className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {uploadFile ? uploadFile.name : 'Click to select a file'}
                </label>
                <p className="text-xs text-gray-500 mt-2">PDF, DOCX, PNG, or JPEG - max 20MB</p>
              </div>
              {uploadFile && uploadProgress === 'idle' && (
                <button
                  onClick={handleFileUpload}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Upload & Extract
                </button>
              )}
              {uploadProgress === 'uploading' && (
                <p className="text-sm text-gray-500">Uploading and processing...</p>
              )}
              {extractedData && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    Extracted Fields (review before saving)
                  </h3>
                  <pre className="text-xs text-gray-600 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(extractedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Credly Import Tab */}
          {activeTab === 'credly' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your Credly username to import your verified digital badges and
                certifications. No password needed — Credly badges are public.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={credlyUsername}
                  onChange={(e) => setCredlyUsername(e.target.value)}
                  placeholder="Your Credly username"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleCredlyConnect}
                  disabled={isSubmitting || !credlyUsername.trim()}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Syncing...' : 'Connect & Sync'}
                </button>
              </div>
              {syncResult && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Found <strong>{syncResult.total}</strong> badges, imported{' '}
                    <strong>{syncResult.synced}</strong> new certifications.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
