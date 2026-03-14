'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'manual' | 'upload' | 'linkedin';

export default function AddCareerDataPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual entry form state
  const [profile, setProfile] = useState({
    title: '',
    company: '',
    industry: '',
    years_of_experience: '',
    skills: '',
    desired_salary: '',
    work_arrangement: 'hybrid',
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null);

  if (!isAuthenticated) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/career/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          years_of_experience: profile.years_of_experience
            ? Number(profile.years_of_experience)
            : null,
          desired_salary: profile.desired_salary ? Number(profile.desired_salary) : null,
          skills: profile.skills
            ? profile.skills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) throw new Error('Failed to save profile');
      setMessage({ type: 'success', text: 'Career profile saved successfully!' });
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
      const res = await fetch('/api/data/career/upload', {
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

  const handleLinkedInConnect = () => {
    window.location.href = '/api/integrations/oauth/linkedin?redirect=/dashboard/career/add';
  };

  const handleLinkedInSync = async () => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/integrations/linkedin/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      setMessage({
        type: 'success',
        text: `Profile synced: ${data.profile?.first_name || ''} ${data.profile?.last_name || ''}`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'manual' as const, label: 'Manual Input' },
    { id: 'upload' as const, label: 'Document Upload' },
    { id: 'linkedin' as const, label: 'LinkedIn Import' },
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Add Career Data</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Choose how you want to add your career information
        </p>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={profile.title}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    placeholder="e.g., Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    placeholder="e.g., Acme Corp"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={profile.industry}
                    onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                    placeholder="e.g., Technology"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    value={profile.years_of_experience}
                    onChange={(e) =>
                      setProfile({ ...profile, years_of_experience: e.target.value })
                    }
                    placeholder="e.g., 5"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={profile.skills}
                  onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                  placeholder="e.g., React, TypeScript, Node.js"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Desired Salary
                  </label>
                  <input
                    type="number"
                    value={profile.desired_salary}
                    onChange={(e) => setProfile({ ...profile, desired_salary: e.target.value })}
                    placeholder="e.g., 120000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Work Arrangement
                  </label>
                  <select
                    value={profile.work_arrangement}
                    onChange={(e) => setProfile({ ...profile, work_arrangement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Career Profile'}
              </button>
            </form>
          )}

          {/* Document Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload your resume or certificate (PDF, DOCX). We will extract key information using
                OCR.
              </p>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
                    setUploadProgress('idle');
                    setExtractedData(null);
                  }}
                  className="hidden"
                  id="career-file-input"
                />
                <label
                  htmlFor="career-file-input"
                  className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {uploadFile ? uploadFile.name : 'Click to select a file'}
                </label>
                <p className="text-xs text-gray-500 mt-2">PDF or DOCX, max 20MB</p>
              </div>
              {uploadFile && uploadProgress === 'idle' && (
                <button
                  onClick={handleFileUpload}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

          {/* LinkedIn Import Tab */}
          {activeTab === 'linkedin' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your LinkedIn account to import your professional profile. LinkedIn provides
                limited data (name, headline) — supplement with manual entry or document upload.
              </p>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleLinkedInConnect}
                  className="px-6 py-3 bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182] transition-colors"
                >
                  Connect LinkedIn
                </button>
                <button
                  onClick={handleLinkedInSync}
                  disabled={isSubmitting}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Syncing...' : 'Sync Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
